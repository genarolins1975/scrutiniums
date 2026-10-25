# Prompt para o Codex: Saneamento, Onda S1 (rótulos certos e bastidor fora da tela)

Data: 25/10/2026. Base: `main` em `e2487b49`. Origem: `docs/saneamento/AVALIACAO_ROADMAP_2026-10-25.md`, seção 7, Onda S1 (26/10 a 08/11/2026), na branch `claude/saneamento-roadmap-2026-10-25` até ser integrado.

## Como usar

Uma tarefa do Codex por pacote, cada uma com um PR. Cole o texto inteiro abaixo da linha e troque `PACOTE` na primeira linha pela letra.

| Pacote | Tema | Quando |
|---|---|---|
| A | Nome da edição do SINISA e frase da ressalva (achados S1 e S11) | já |
| B | Notas de curadoria fora das células do capítulo 15 (achado S2) | já |
| C | Número de custo na entrada (achado S8; decisão D-S1 pendente) | já; o merge espera a decisão |

A e B mexem em arquivos diferentes e podem rodar em paralelo. C mexe só na entrada; se A for integrado antes, C traz o `main` por merge.

Fica fora do Codex o item S4 (execução manual dos três workflows do domínio), que é do dono: passo a passo na seção 6.

---

**Execute somente o pacote PACOTE.**

## 1. Papel, objetivo e regras

Você vai executar um pacote da Onda S1 do roadmap do Observatório do Saneamento da Scrutiniums, plataforma de observatórios de dados públicos brasileiros (Next.js 14, TypeScript, pipeline em Python). A onda corrige rótulos que atribuem dado à edição errada da fonte, tira bastidor de pesquisa da interface e alinha a entrada com a pergunta do título.

Antes de começar, leia inteiros:

1. `AGENTS.md` e `CLAUDE.md` na raiz. O `CLAUDE.md` vale para qualquer agente.
2. O núcleo de `.claude/skills/observatorio-layout/SKILL.md` e os anexos `arquiteturas.md` e `componentes-e-graficos.md`.
3. As três skills de design obrigatórias, como arquivos: `.claude/skills/emil-design-eng/SKILL.md`, `.claude/skills/impeccable/SKILL.md` e `.claude/skills/design-taste-frontend/SKILL.md`. Em conflito, prevalece a `observatorio-layout`. Se algum arquivo faltar, diga isso no PR.
4. `docs/saneamento/README.md`, `docs/saneamento/METODOLOGIA.md` e `docs/saneamento/AVALIACAO_ROADMAP_2026-10-25.md` (se não estiver no seu checkout, está na branch `claude/saneamento-roadmap-2026-10-25`).

Preparação do ambiente: `bash scripts/preparar-sessao.sh` antes de qualquer teste. `npx tsc --noEmit` e `npm run build` precisam de `NODE_OPTIONS=--max-old-space-size=4096`; os scripts `verificar:*` já passam isso.

Regras sem exceção:

1. Nunca apagar, pular, afrouxar ou marcar como `skip`, `todo` ou `only` um teste para obter verde. Teste que fixa texto alterado por este pacote muda de propósito, com o motivo no comentário e no PR; nunca para esconder regressão.
2. Nenhum número, fórmula, gold ou seed muda neste trabalho. Só rótulos, texto exibido e apresentação. Se achar dado errado, descreva no PR e não corrija.
3. Ausência nunca vira zero nem estimativa.
4. Asserção de texto literal só para texto decidido pelo dono, com a decisão citada; teste novo prefere invariantes (rótulo lido de `meta.json`, ausência de padrão proibido no HTML, ausência de `undefined`, `NaN` e data crua).
5. Antes de abrir o PR: `npm run verificar:rapido` e `npm run verificar:pr`. Se o ambiente não tiver Chromium, rede ou memória para alguma etapa, diga no PR qual etapa não rodou e por quê; não declare verde o que não rodou.
6. Evidência de página: `npm run evidencias -- --rotas <rotas tocadas> --saida docs/ux-AAAA-MM-DD/saneamento-s1-<pacote>`, a 390 e 1440 px, com e sem sessão.
7. Um PR, com título em português e a descrição nesta ordem: "O que muda para o leitor", "Evidência antes e depois", "Comandos rodados e resultado", "Decisão do dono pendente" (se houver) e "O que não foi verificado".
8. **Não faça merge.** O merge é do dono.
9. Textos, comentários, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência. Sem travessão nem hífen como pontuação no texto exibido. Não alterar `CLAUDE.md`, `AGENTS.md`, a skill nem `src/lib/rotasPublicas.ts`.

## 2. Estado de partida (medido em 25/10/2026)

| Item | Estado |
|---|---|
| Edição do SINISA | `public/saneamento/gold/meta.json` registra `sinisa.edicao` = "SINISA 2025" e `sinisa.ano_referencia` = 2024. O código exibe "SINISA 2024" em 114 ocorrências (contra 48 de "SINISA 2025") em `src/app/saneamento`, `src/components/saneamento` e `src/lib/saneamento`, além de rótulos montados com o ano (ex.: `SINISA {sinisaAno}` em `src/app/saneamento/contratado/page.tsx`). O Ministério das Cidades chama de "SINISA 2024" a edição com ano de referência 2023 (página de resultados no gov.br, consultada em 25/10/2026) |
| Ressalva | A ficha municipal e a consulta aberta dizem "Não permite concluir. Água: Somar com o Censo, ... nem concluir que ..." |
| Capítulo 15 | `pipeline/saneamento_contratos/seed/leiloes.json` tem 24 linhas, todas com `observacoes`; 11 trazem notas de curadoria como "Linha extra (pedido: Goiás)", "DIVERGÊNCIA: ..." e "(provavelmente valor do contrato)". A página exibe o campo cru (`src/app/saneamento/contratado/page.tsx`, linhas 239, 391 e 559) e os graus como "(S)" e "(V)" |
| Entrada | H1 "Quem ainda está sem água e esgoto, e quanto custa?"; a escala traz três números (água, esgoto, tratamento), nenhum de custo |

## 3. Pacotes

### A. Nome da edição do SINISA e frase da ressalva

1. **Rótulo único.** Criar em `src/lib/saneamento/` uma função que lê `meta.json` e devolve o nome da edição e o ano de referência nas formas que a interface precisa: completa ("SINISA 2025, ano de referência 2024"), curta para fonte de número ("SINISA 2025 (ref. 2024)") e só o ano de referência quando o texto fala do ano dos dados ("em 2024"). Nada de ano escrito à mão.
2. **Substituir** todas as ocorrências de "SINISA 2024" e de rótulos montados com o ano de referência que nomeiam a edição: textos, fontes de `NumeroEscala`, legendas, metadados de página (`description`), CSV gerado na interface e `src/lib/saneamento/viabilidade.ts` com o `docs/saneamento/VIABILIDADE.md` que ele gera. Onde o texto fala do ano dos dados ("investido em 2024"), manter o ano. Na dúvida entre edição e ano, prefira a forma completa.
3. **Não mexer** na gold, no seed nem em `meta.json`. Arquivos de `pipeline/` que só gravam texto de proveniência ficam como estão; diga no PR quais encontrou.
4. **Teste novo** (`src/tests/saneamento-edicao-sinisa.test.ts`): sobre o HTML do build das rotas do Saneamento, nenhuma ocorrência de "SINISA 2024" enquanto `meta.json` disser edição 2025; o rótulo exibido na entrada e na ficha municipal é o lido de `meta.json`. Quando a edição mudar, o teste segue a gold sem edição de texto.
5. **Ressalva.** No componente que monta "Não permite concluir" da ficha municipal e da consulta aberta, a frase passa a "Não permite: somar com o Censo, que mede outra população em outro ano; nem concluir que a água chega todo dia ou é potável ..." (e o equivalente no esgoto). Procure o mesmo padrão "Não permite concluir. X: Verbo" nas demais páginas do Saneamento e corrija igual.
6. Rotas para evidência: `/saneamento`, `/saneamento/municipio/2611606`, `/saneamento/municipio` (sem sessão, com `?ibge=2611606`), `/saneamento/acesso`, `/saneamento/contratado`, `/saneamento/metodologia`.

### B. Notas de curadoria fora das células do capítulo 15

1. **Na célula da tabela de leilões, só o fato:** objeto, poder concedente e serviços. O grau vira palavras: "conferido na fonte oficial" para V e "só em fonte secundária" para S, com a regra explicada uma vez no cabeçalho da tabela.
2. **As observações vão para um detalhe por linha** (`<details>` com resumo "Notas desta linha"), no HTML, para auditoria. Dentro dele, o texto é reescrito para o leitor na apresentação, sem alterar o seed: "Linha extra", "pedido" e o nome de quem pediu não aparecem; "DIVERGÊNCIA:" vira "Fontes divergem:"; "(provavelmente ...)" vira "valor não confirmado na fonte". Faça isso por uma função de apresentação testada, não por edição do JSON.
3. **Mesma regra** nos outros dois lugares que exibem `observacoes` (linhas 391 e 559 de `contratado/page.tsx`) e na lista de documentos não lidos.
4. **No celular**, a tabela de leilões continua comparável: identificação e valores à vista, rolagem só na tabela com indicação perceptível, nunca rolagem da página. Meta: a página `/saneamento/contratado` a 390 px abaixo de 30.000 px de altura (hoje 38.739), sem retirar análise.
5. **Teste novo:** o HTML de `/saneamento/contratado` não contém "Linha extra", "pedido:", "provavelmente" nem "(S)" e "(V)" soltos; cada linha com observação tem o detalhe; a função de apresentação cobre as quatro trocas.
6. Rota para evidência: `/saneamento/contratado`.

### C. Número de custo na entrada (decisão do dono pendente, D-S1)

Implemente a recomendação do comitê; o PR diz que o merge espera a decisão D-S1.

1. **Quarto número da escala da entrada** (`src/app/saneamento/page.tsx`, com `NumeroEscala`): "Conta de água e esgoto de 10 m³ por mês, nas tabelas verificadas", com a faixa (menor e maior) e a mediana das contas residenciais de 10 m³ nas 12 tabelas, calculadas pela mesma função do simulador (`src/lib/saneamento/simulador.ts` e `src/lib/saneamento/conta.ts`), nunca escritas à mão.
2. **Rótulo de amostra obrigatório junto do número:** "Amostra: 12 tabelas de 8 prestadores, em 1.754 municípios; não é média do Brasil", com os números lidos de `src/lib/saneamento/dados/tarifas.json`. Fonte: "Atos dos reguladores; tabelas vigentes nas consultas de DD/MM/AAAA a DD/MM/AAAA", lidas do arquivo. "Ver no painel" leva ao simulador.
3. A faixa de quatro números continua dentro do orçamento de cromo e comprimento da entrada (`src/tests/ux-orcamentos-*.test.ts`) e o primeiro número acima de 900 px a 1440.
4. **Teste novo:** o número é o mesmo que o simulador devolve para as mesmas tabelas e consumo; o rótulo de amostra está presente; nada de `NaN` ou `undefined`.
5. Rotas para evidência: `/saneamento` (com sessão) e `/perguntas/energia-e-infraestrutura` (sem sessão, para conferir que nada mudou na camada aberta).

## 4. Critério de aceite do pacote

| Pacote | Critério |
|---|---|
| A | Zero "SINISA 2024" como nome de edição no HTML do Saneamento; rótulo lido de `meta.json`; ressalvas reescritas; evidência anexada |
| B | Nenhuma nota de curadoria nas células; detalhe por linha presente; `/saneamento/contratado` abaixo de 30.000 px a 390; nenhum valor perdido |
| C | Quarto número com faixa, mediana e rótulo de amostra, igual ao simulador; orçamentos da entrada verdes |

## 5. Entrega

Mensagem final curta: o que muda para o leitor, o estado real (PR aberto, verificações que passaram e que não rodaram), as rotas afetadas e a decisão que falta do dono, se houver.

## 6. Ação do dono (o Codex não executa)

**Item S4. Provar a agenda do Saneamento antes de 06/11/2026.** Os três workflows nunca rodaram. Eles não têm modo sem publicação: a execução manual faz o mesmo que a agenda, publicando só o grupo que passa nos testes.

1. GitHub → Actions → "Atualizar dados do Saneamento" (`atualizar-saneamento.yml`) → Run workflow, entradas padrão.
2. Repetir em "Vigiar os contratos de saneamento desde o novo marco" (`atualizar-saneamento-contratos.yml`) e "Atualizar dívida dos prestadores de saneamento" (`atualizar-saneamento-divida.yml`).
3. Anotar, para cada um: duração, grupos publicados, grupos retidos e issue aberta, se houver.
4. Registrar o resultado em `OPERACOES.md` (ou pedir ao Claude, que lê as execuções pelo GitHub).

**Decisão D-S1.** Responder no PR do pacote C se aceita o quarto número com rótulo de amostra ou se prefere ajustar o título da entrada.
