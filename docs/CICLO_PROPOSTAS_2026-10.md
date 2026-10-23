# Propostas do ciclo de implementação, outubro de 2026

Data: 22/10/2026. Para decisão do dono. Nada aqui entra sem aprovação explícita; os pacotes que já viraram PR (CI em paralelo, comando antes do push, inventário de tradução, Vitest, sessão nova, evidências) seguem à parte.

| Proposta | Ganho medido | Custo principal | Decisão pedida |
|---|---|---|---|
| 1. Skill da casa em núcleo e anexos | 45 KB para 13,3 KB em tarefa de PR e produção | agente precisa carregar o anexo certo | aprovar ou manter |
| 2. Política para testes de texto literal | não medido; ver evidência | invariantes são mais difíceis de escrever | aprovar ou manter |
| 3. Dados pesados fora do git | clone raso de 1.243 MB para 601 MB; de 3 a 10 s a menos por clone | muda o deploy da Vercel e o pipeline diário | autorizar estudo ou manter |

## 1. Skill da casa em núcleo e anexos

**Evidência.** `.claude/skills/observatorio-layout/SKILL.md` tem 45.083 bytes e 222 linhas não vazias, com 17 datas e 19 caminhos de `src/` citados (22/10/2026). Só "Navegação e acesso" ocupa 11.985 bytes. Junto das três skills de design obrigatórias, toda sessão de interface carrega 122.570 bytes de instrução antes de começar.

**Proposta.** A branch `claude/ciclo-p7-skill-rascunho` traz a divisão pronta, sem PR:

- núcleo de 13.331 bytes: direção, prioridades do dono, contrato editorial, antes de desenhar, processo, rubrica, entrega, PR à produção e um índice que diz quando carregar cada anexo;
- oito anexos com o texto movido sem alteração e os mesmos números de seção: acesso, navegação, busca, decisões de 19/10, arquiteturas de página, identidade visual, componentes e gráficos, tema e acessibilidade;
- `node scripts/skill-cobertura.mjs` prova que as 222 linhas do original estão, idênticas, no núcleo ou num anexo (resultado: 0 ausentes, núcleo dentro do teto de 15 KB).

**Ganho.** Pedido de PR, merge ou "está no ar?" passa a carregar 13,3 KB em vez de 45,1 KB. Uma página de entrada carrega o núcleo com arquiteturas, componentes e gráficos e navegação: 29,0 KB em vez de 45,1 KB.

**Custo e risco.** O agente precisa ler o índice e abrir o anexo do tema; um anexo esquecido é uma regra esquecida. O índice fica no topo do núcleo, e o `CLAUDE.md` passaria a dizer o mesmo.

## 2. Política para testes de texto literal

**Evidência.** Há 3.122 asserções com texto literal em português de 20 caracteres ou mais, em 222 dos 362 arquivos de teste (contagem por expressão regular sobre `toContain`, `toMatch`, `toBe` e `toEqual`, 22/10/2026). Dos 172 commits sem merge, entre os 300 últimos do main, que mudaram `src/app` ou `src/components`, 128 mudaram também `src/tests`.

**Proposta.** Asserção de texto literal só para texto decidido pelo dono, com a decisão citada no comentário do teste. Teste novo prefere invariantes: natureza, período e prova de cada número, links válidos, estrutura declarada da página, ausência de `undefined`, `NaN` e data crua. Vale para o que nasce; nada do existente é reescrito.

**Ganho.** Não medido. A expectativa é menos edição de teste em redesenho pedido pelo dono, que hoje acompanha três de cada quatro commits de interface.

**Custo e risco.** Invariantes dão mais trabalho para escrever e deixam passar texto alterado sem decisão. A política protege só o texto que o dono decidiu.

## 3. Dados pesados fora do histórico do git

**Evidência.** No git (main `30c5d63`, 22/10/2026), `public/` guarda 531 MB de dados em 4.677 arquivos (JSON, CSV, Parquet, ZIP e GZ) e só 7 MB de ativos da aplicação; `docs/obee` guarda 113 MB, que o build lê (`src/components/eficiencia/IndiceResultados.tsx` e `src/app/eficiencia-estatal/laboratorio-cesta/route.ts`). O commit diário do pipeline altera cerca de 3.875 arquivos em `public/`. No CI, o checkout leva cerca de 30 s em cada job, e um PR roda de três a cinco jobs.

Clone raso, como o do `actions/checkout`, medido duas vezes nesta sessão (4 vCPU, via proxy, 23/10/2026), com o `.git` incluído no disco:

| Clone | Tempo | Disco |
|---|---|---|
| Completo | 33,0 s e 28,4 s | 1.243 MB |
| Sem os dados de `public/`, com `docs/obee` e os ativos | 22,7 s e 25,2 s | 601 MB |

A primeira versão deste documento tirava também os ativos de `public/` e todo o `docs/obee`, e dava 24 s e 663 MB de ganho. Como a primeira alternativa move só os dados e o build lê `docs/obee`, a medida acima é a que vale para ela (correção apontada na revisão do PR).

**Alternativas.**

- Golds publicadas como asset de release por data, baixadas por script no build, no CI e na sessão, com manifesto de hash no git.
- Repositório de dados próprio, clonado no build na revisão registrada no git.
- Git LFS, que a Vercel aceita quando habilitado no projeto; não reduz o tamanho do checkout, só o do histórico.

**Ganho projetado.** Cerca de 640 MB a menos em disco por clone, em cada sessão de agente e em cada job do CI. O tempo de clone cai de 3 a 10 s, dentro da oscilação da rede; o ganho principal é disco e histórico, não tempo. Tirar também `docs/obee` exigiria migrar os dois consumidores do build e os testes que o leem.

**Custo e risco.** Muda o deploy da Vercel (o build precisa baixar os dados), o pipeline diário (publica asset em vez de commit) e a forma como 165 arquivos de teste leem `public/`. Build sem dados vira um modo de falha novo, que o manifesto de hash precisa barrar.
