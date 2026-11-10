# Dados publicados fora do deploy: desenho e preparação

10/11/2026. Recomendação 7 do parecer estrutural. Decisão do dono: **preparar o desacoplamento sem ligá-lo**, porque o
armazenamento externo ainda não foi provisionado e ninguém tem credencial.

Estado desta entrega: desenho (este documento), leitor único em `src/lib/gold/` que nenhuma página usa, gerador de
manifesto em `scripts/gold-manifesto.mjs`, manifesto do piloto em `config/gold-manifestos/agro.json` e testes em
`src/tests/gold-leitor.test.ts`. Nada foi enviado a armazenamento nenhum, nenhum workflow mudou e nenhuma leitura
existente foi trocada. Com `GOLD_ORIGEM` ausente, o comportamento de produção é o de antes.

Separação usada no texto: **medido** (com o comando), **documentado** (com a página da Vercel consultada em 10/11/2026),
**inferência** e **recomendação**.

## 1. Estado atual, medido em 10/11/2026

Checkout do ramo `claude/friendly-cannon-8zeaoe`, árvore de trabalho com os derivados materializados por
`npm run preparar`. Os números de disco incluem 101 arquivos gerados e não versionados (4.886 no disco, 4.785 no git).

### 1.1 Tamanho por domínio e leitura em tempo de requisição

Comando: script de medição que percorre `public/`, soma os bytes de cada arquivo e expande contra o disco os padrões de
`outputFileTracingIncludes` de `next.config.mjs` (a lista que o projeto mantém à mão do que as funções leem em
requisição). `du -sm public` dá 687 MB porque conta blocos de disco; a soma dos bytes dos arquivos dá 675,36 MiB.

| Domínio (`public/<pasta>`) | Arquivos | MiB | Arquivos lidos em requisição | MiB | Rotas que os declaram |
|---|---:|---:|---:|---:|---:|
| energia | 306 | 206,17 | 5 | 1,24 | 6 |
| eficiencia | 243 | 181,02 | 8 | 13,73 | 7 |
| obs (Crédito) | 3.925 | 111,45 | 7 | 1,72 | 11 |
| educacao | 29 | 63,28 | 29 | 63,28 | 11 |
| saneamento | 77 | 58,75 | 42 | 52,28 | 11 |
| contas-estaduais | 187 | 32,61 | 0 | 0 | 0 |
| conectividade | 33 | 10,90 | 28 | 10,87 | 8 |
| previdencia | 28 | 4,17 | 28 | 4,17 | 9 |
| inflacao | 3 | 2,10 | 1 | 0,53 | 6 |
| estado (arte) | 3 | 1,58 | 0 | 0 | 0 |
| gas | 27 | 1,38 | 10 | 0,62 | 7 |
| home (arte) | 13 | 0,74 | 0 | 0 | 0 |
| territorio | 4 | 0,60 | 3 | 0,50 | 7 |
| agro | 6 | 0,56 | 1 | 0,33 | 6 |
| raiz de `public/` | 2 | 0,05 | 0 | 0 | 0 |
| **Total** | **4.886** | **675,36** | **162** | **149,28** | 28 rotas com lista |

As 28 rotas somam 158 padrões de `public/` declarados à mão (48 distintos). O total de 149,28 MiB é a união dos arquivos,
não o tamanho de uma função: cada função leva só os seus.

Composição por tipo (`find public -type f | sed 's/.*\.//' | sort | uniq -c`): 4.443 JSON, 302 CSV, 41 SVG, 25 Parquet,
23 PNG, 17 WebP e o resto código e fontes da SPA do Crédito. Dos 3.925 arquivos de `obs`, 3.825 são fichas em
subpastas de `public/obs/data/gold/` (`cmp`, `inst`, `pano`, `prod`) e 75 são golds de primeiro nível.

### 1.2 Os três modos de leitura

| Modo | O que foi medido | Resultado | Limite da medida |
|---|---|---|---|
| Servidor, em requisição | expansão de `outputFileTracingIncludes` contra o disco | 162 arquivos, 149,28 MiB, 11 domínios, 28 rotas | exata para o que está declarado; leitura não declarada falharia em produção e não aparece aqui |
| Build | `grep` de módulos de `src/` (fora de `src/tests`) que usam `fs` e citam `public` | 70 módulos, 11 deles em `src/lib/energia` | conta módulos, não arquivos; a lista de arquivos lidos no build exige instrumentar `npm run build`, que não foi rodado nesta tarefa |
| Navegador | `grep` de `fetch(` com endereço literal em `src/`; `fetch(` em `public/obs/app.js` | 39 componentes de cliente têm `fetch` e citam `.json`, `.csv`, `/gold/` ou `/series/`; 9 endereços literais fora de `/api` em `src/`; a SPA do Crédito tem 11 chamadas `fetch` e monta os endereços de `data/gold/` em tempo de execução | não há contagem por arquivo: os endereços são montados com variáveis. Todo arquivo de `public/` é alcançável pelo navegador |

Fato que condiciona o desenho (lido em `src/middleware.ts` e `next.config.mjs`): o `matcher` do middleware cobre tudo
menos `_next/static` e `_next/image`, então os arquivos de dado em `public/` passam pela exigência de sessão, e as golds
saem com `Cache-Control: private, max-age=3600`. **Dado lido pelo navegador hoje está atrás de conta.**

### 1.3 Acoplamento entre dado e código

- `git count-objects -vH`: pacote de 772,34 MiB num clone raso de 65 commits (27/10 a 10/11/2026). O histórico completo
  não foi medido.
- `git log --since="30 days ago" -- public`: 42 dos 65 commits visíveis tocam `public/`; 36 são do robô do pipeline.
  A janela real é de 14 dias, por causa do clone raso.
- 31 workflows; os 17 `atualizar-*.yml` têm agendamento (`grep -l "cron:"`); 8 workflows fazem `git push` e 7 deles
  citam `public/` (`grep -l "git push" .github/workflows/*.yml`). Cada push no `main` dispara um deploy (`OPERACOES.md`).

## 2. Desenho alvo

### 2.1 Objetos

Um armazenamento de objetos, uma árvore por domínio:

```
<base>/<dominio>/corrente.json                 ponteiro "edição corrente"; único objeto que muda
<base>/<dominio>/manifestos/<edicao>.json      manifesto de uma edição; nunca muda
<base>/<dominio>/objetos/<sha256>.<ext>        conteúdo; o nome é o hash, nunca muda
```

- **Manifesto** (`ManifestoGold` em `src/lib/gold/tipos.ts`): para cada arquivo, `caminho` relativo à pasta do domínio,
  `bytes` e `sha256`; mais `esquema`, `dominio`, `edicao` e totais.
- **Edição**: SHA-256 das linhas `caminho<TAB>bytes<TAB>sha256<LF>` em ordem de caminho. Sem data e sem máquina: os
  mesmos bytes dão a mesma edição, e publicar de novo o mesmo dado é operação nula.
- **Endereço imutável por hash**: arquivo que não mudou entre edições é um objeto só. Na publicação por grupo do
  Crédito (`docs/PUBLICACAO_GOLD_POR_GRUPO.md`), grupo retido mantém o mesmo sha256 e não é reenviado; a invariante
  "retidos preservam cada byte" (`conferir_retidos`) passa a ser igualdade de linhas entre dois manifestos.
- **Ponteiro** (`PonteiroGold`): edição, caminho, tamanho e sha256 do manifesto, data da troca e edição anterior.

### 2.2 Publicação atômica

1. Gerar o manifesto da árvore já aprovada pelos testes (`scripts/gold-manifesto.mjs`).
2. Enviar os objetos que ainda não existem. O envio sem sobrescrita falha quando o nome já existe, o que para um nome
   por hash significa "já está lá" (documentado: sobrescrever exige `allowOverwrite`).
3. Enviar o manifesto da edição.
4. Conferir: baixar manifesto e objetos novos e comparar sha256.
5. Trocar o ponteiro, com escrita condicional sobre o ETag lido no início (documentado: `ifMatch`). Substitui a
   conferência `BASE_GOLD` de `atualizar-dados.yml` ("a gold publicada mudou durante a execução").

Até o passo 5 o leitor não vê nada da edição nova. Falha em qualquer passo anterior deixa objetos órfãos e nenhum efeito.

### 2.3 Volta atrás

Regravar o ponteiro com a edição anterior (campo `anterior`). Os objetos e o manifesto dela continuam no lugar. Sem
commit, sem revert, sem build, no modo de leitura em requisição. Exige retenção: edições só podem ser apagadas depois
de um prazo (proposta: 30 edições ou 90 dias por domínio, o que for maior; decisão do dono).

### 2.4 Cache

| Objeto | Validade | Motivo |
|---|---|---|
| `objetos/<sha256>` | a máxima do armazenamento; no leitor, em memória, sem prazo, com teto de 64 MiB por instância | o conteúdo de um hash não muda |
| `manifestos/<edicao>.json` | idem | imutável |
| `corrente.json` | curta: 60 s no leitor (`GOLD_PONTEIRO_TTL_S`), e validade curta declarada no envio | é o que decide a edição |

Documentado (`https://vercel.com/docs/vercel-blob`): o cache da CDN guarda todo blob por até 1 mês por padrão,
configurável no envio, e a sobrescrita de um blob pode levar até 60 segundos para propagar. Inferência: a troca de
ponteiro chega ao leitor em até cerca de 2 minutos (propagação mais validade em memória). Para leitura imediata há a
leitura consistente do SDK em armazenamento privado (`useCache: false`,
`https://vercel.com/docs/vercel-blob/private-storage`), mais lenta e cobrada a cada vez.

### 2.5 Falha explícita

O leitor em modo externo nunca devolve: arquivo de `public/` como reserva, ponteiro vencido quando a nova leitura
falhou, conteúdo com tamanho ou sha256 diferente do manifesto, resposta parcial, vazio ou zero. Toda falha é `ErroGold`
com código, domínio e caminho. Conteúdo reprovado não entra no cache. Valor desconhecido em `GOLD_ORIGEM` é erro de
configuração, não escolha de origem.

## 3. Como cada modo de leitura passa a funcionar

| Modo | Hoje | Alvo | O que ainda precisa ser construído |
|---|---|---|---|
| Servidor, em requisição | `readFileSync` em `public/`, com o arquivo declarado em `outputFileTracingIncludes` | `await lerGold(dominio, caminho)`; a função não carrega dado no pacote e a entrada some de `next.config.mjs` | trocar as chamadas (viram assíncronas); credencial rotativa (seção 7) |
| Build (páginas estáticas) | `readFileSync` em `public/` durante `next build` | etapa A: materializar a edição em `public/` antes do build, conferindo sha256 pelo manifesto, sem mudar código de página. Etapa B: `lerGold` no build | script de materialização (não escrito); gatilho de novo build sem commit |
| Navegador | `fetch("/<dominio>/gold/...")`, arquivo estático atrás de sessão | rota autenticada que confere a sessão, resolve o caminho pelo manifesto e devolve o objeto, nos mesmos endereços de hoje (reescrita), com `Cache-Control: private` | a rota (não escrita: esta tarefa não podia tocar `src/app`) |

Três consequências que precisam de decisão, não de código:

1. **Página estática continua presa ao build.** Tirar o dado do repositório não faz a página estática atualizar sozinha.
   Opções: (a) Deploy Hook chamado pelo workflow depois da troca do ponteiro (documentado em
   `https://vercel.com/docs/deploy-hooks`: um POST na URL do hook cria um deploy do ramo, sem commit); (b) revalidação
   sob demanda das páginas. Recomendação: (a) primeiro. Mantém a semântica de hoje (um deploy por edição) e já tira o
   dado do git; (b) fica para depois do piloto.
2. **Edições misturadas na mesma página.** Com a página estática montada na edição N e a consulta em requisição lendo o
   ponteiro na edição N+1, o leitor vê dois retratos lado a lado. É o mesmo problema dos testes de coerência entre
   grupos do Crédito (`docs/ux-2026-11-03/credito-coerencia/README.md`). Saída: fixar a edição por deploy (o build grava
   a edição de cada domínio e as funções daquele deploy leem a mesma). O leitor atual segue só o ponteiro; a fixação é
   um acréscimo pequeno e **não foi implementada**.
3. **Dado atrás de conta.** Armazenamento público entrega o arquivo a quem tiver o endereço (documentado: "Anyone with
   the URL"), o que contraria "painéis só com conta" e o princípio do aperitivo. Recomendação: armazenamento privado,
   com entrega por rota própria que confere a sessão. O modo de acesso não pode ser trocado depois de criado o
   armazenamento (documentado em `https://vercel.com/docs/vercel-blob`).

## 4. O que muda nos workflows

Hoje (exemplo `atualizar-dados.yml`): coleta, gold, sentinela, testes e seleção por grupo, `git add public/obs/data`,
commit, rebase com conferência da base, push, deploy.

Alvo, por domínio migrado:

| Passo | Hoje | Alvo |
|---|---|---|
| Base da composição | `public/` do checkout | edição corrente materializada do armazenamento (mesma função da etapa A) |
| Testes | sobre `public/` | iguais, sobre a árvore materializada; os testes não mudam |
| Publicação | commit e push | passos 1 a 5 da seção 2.2 |
| Corrida entre execuções | `BASE_GOLD` e rebase | escrita condicional do ponteiro |
| Atualizar páginas estáticas | o push dispara o deploy | Deploy Hook depois da troca do ponteiro |
| Vigília de frescor | compara gold do `main` com produção | lê `publicado_em` do ponteiro e a edição que a produção serve |
| Volta atrás | revert de commit | regravar o ponteiro |
| CI de PR | dado vem no checkout | materializa a edição corrente antes dos testes; o CI passa a depender do armazenamento |

O credencial de escrita fica só nos workflows de atualização, como segredo do repositório. Workflow de PR vindo de fork
não recebe segredo: o CI precisa de credencial só de leitura ou de outra forma de obter o dado (ponto em aberto).

## 5. Migração, domínio por domínio

**Piloto: Agronegócio (`public/agro`).** É o menor domínio com leitura em tempo de requisição: 6 arquivos, 587.649
bytes (0,56 MiB), um deles (`gold/snapshot.json`) lido a cada instância pela página inicial (`src/lib/perguntas/portas.ts`,
lista `GOLDS_DAS_PORTAS`). Território vem logo depois (4 arquivos, 0,60 MiB). O Agro exercita os três modos (página
inicial dinâmica, páginas `force-static` do painel e os seis arquivos baixados pelo navegador na página de método) com o menor raio de dano, tem workflow próprio
(`atualizar-agro.yml`) e verificação própria (`npm run verificar:pr -- --agro`). O manifesto de 10/11/2026 está em
`config/gold-manifestos/agro.json` (edição `4722433ad6e3…`); é um retrato, envelhece na próxima atualização do dado e
nenhum teste depende dele.

Ordem proposta, cada passo com critério de saída:

| Passo | O que | Critério |
|---|---|---|
| 0 | Provisionar (seção 7) | credenciais nos segredos, armazenamento criado |
| 1 | Agro, escrita dupla: o workflow continua commitando e também publica no armazenamento | 14 dias com `--check` do manifesto externo igual ao do repositório |
| 2 | Agro, leitura em requisição pelo leitor num deploy de prévia com `GOLD_ORIGEM=externo` | bytes idênticos, latência e erro medidos; decisão de ligar em produção |
| 3 | Agro, etapa A: materialização antes do build; `public/agro` sai do git | build, CI e os três modos verdes sem o dado no repositório |
| 4 | Território, gás, inflação, previdência (pequenos, até 5 MiB) | mesmo critério |
| 5 | Conectividade, saneamento, educação (maior peso em requisição: 126 MiB dos 149 MiB) | idem; é aqui que `outputFileTracingIncludes` encolhe de verdade |
| 6 | Eficiência, energia, contas estaduais (maior peso total, quase todo de build e navegador) | idem |
| 7 | Crédito (`obs`): 3.925 arquivos, publicação por grupo, SPA própria | por último; exige a composição por grupo sobre manifestos |
| 8 | Decidir sobre o histórico do git | o pacote de 772 MiB não encolhe sem reescrita de histórico |

A chave é uma só para o processo (`GOLD_ORIGEM`). A adoção por domínio se faz trocando as chamadas de um domínio por
vez; enquanto um domínio não é adotado, ele não passa pelo leitor.

## 6. Riscos

| Risco | Efeito | Tratamento |
|---|---|---|
| Armazenamento fora do ar | páginas dinâmicas falham em vez de servir dado antigo | por decisão: falha explícita. Avaliar, na adoção, página de erro com a data da última edição lida, nunca o dado |
| Latência da primeira leitura por instância | requisição mais lenta que a leitura de disco | não medido; medir no passo 2. Cache em memória por instância; arquivos grandes (até 21,4 MB hoje) pesam |
| Memória da função | cache de objetos cresce | teto de 64 MiB (`GOLD_CACHE_MAX_MB`); objeto maior que o teto não é guardado |
| Edições misturadas | números de retratos diferentes na mesma tela | fixar edição por deploy (seção 3, item 2) |
| Credencial de longa duração vazada | leitura e escrita do armazenamento | preferir OIDC nas funções; token estático só nos workflows, como segredo |
| CI e build passam a depender de rede | PR vermelho por indisponibilidade | materialização com repetição e cache do runner por edição |
| Testes de PR de fork sem segredo | CI sem dado | credencial só de leitura, ou manter um retrato mínimo no repositório |
| Leitores hoje síncronos | `lerGold` é assíncrono; a troca atinge cerca de 70 módulos | adoção domínio por domínio; etapa A não exige a troca |
| Rastreamento de arquivos do Next | o `join(process.cwd(), "public", …)` do modo repositório pode fazer o Next incluir `public/` inteiro na função que importar o leitor | não verificado (o build não foi rodado); conferir o tamanho da função no passo 2 |
| Órfãos no armazenamento | custo cresce | coleta por retenção: apagar objetos sem referência em nenhum manifesto retido |
| Gerador e leitor divergirem | edição calculada diferente | teste compara os dois a cada execução |

Documentado (`https://vercel.com/docs/functions/limitations`): função acima de 250 MB sem compressão falha no build.
Não foi medido o tamanho real de nenhuma função do projeto.

## 7. Custo, por ordem de grandeza

Preços da página `https://vercel.com/docs/vercel-blob/usage-and-pricing` (atualizada em 23/09/2026), tirados do exemplo
de cálculo dela para a região `iad1`: armazenamento US$ 0,023 por GB-mês; operações simples US$ 0,40 por milhão;
operações avançadas (envio, cópia, listagem) US$ 5,00 por milhão; transferência de dados do Blob US$ 0,05 por GB;
Fast Origin Transfer US$ 0,06 por GB em falta de cache. A página diz que o preço é por região; **o preço de São Paulo
não foi confirmado.**

| Item | Premissa | Conta | US$ por mês |
|---|---|---|---:|
| Armazenamento | pior caso: 30 edições retidas sem nenhum arquivo repetido, 0,66 GB cada | 20 GB × 0,023 | 0,46 |
| Envios | pior caso: os 4.886 arquivos reenviados todo dia | 147 mil × 5,00 por milhão | 0,73 |
| Leitura | **premissa sem medida**: 100 GB por mês saindo do armazenamento, 30% em falta de cache | 100 × 0,05 + 30 × 0,06 | 6,80 |
| Entrega ao navegador por função (armazenamento privado) | Fast Data Transfer da resposta da função | tarifa não consultada | não estimado |

Ordem de grandeza: unidades a poucas dezenas de dólares por mês, dominada pela transferência, não pelo armazenamento.
O tráfego real do site não foi medido nesta tarefa; a linha de leitura é premissa, não estimativa.

Documentado na mesma página: no plano Hobby o incluído é 1 GB de armazenamento, 10.000 operações simples e 2.000
avançadas por mês, e ao exceder o Blob fica inacessível até passarem 30 dias. Uma única publicação completa do Crédito
(3.925 arquivos) excede as 2.000 operações avançadas. Inferência: o piloto cabe no Hobby; a migração inteira, não.
Limites de operação: 15 avançadas por segundo no Hobby e 75 no Pro. Tamanho máximo por arquivo: 5 TB; o maior arquivo
de hoje tem 21,4 MB (`public/eficiencia/assistencia-social/unidades.csv`).

## 8. O que o dono precisa provisionar e decidir

Provisionar:

1. Um armazenamento Vercel Blob para o projeto, com região escolhida (não muda depois) e modo de acesso escolhido (não
   muda depois).
2. Conexão do armazenamento ao projeto, que cria `BLOB_STORE_ID` e a autenticação OIDC para as funções.
3. Um token de leitura e escrita (`BLOB_READ_WRITE_TOKEN`) como segredo do repositório no GitHub, para os workflows.
4. Um Deploy Hook do ramo `main`, com a URL como segredo do repositório.
5. No projeto da Vercel, quando for ligar: `GOLD_ORIGEM=externo` e `GOLD_BASE_URL`, primeiro só no ambiente de prévia.

Decidir:

1. **Privado ou público.** Recomendação: privado. Público só se o dono aceitar que o dado completo fique legível por
   quem tiver o endereço.
2. **Fornecedor.** Vercel Blob é a referência; o desenho (manifesto, hash, ponteiro) serve a qualquer armazenamento de
   objetos com GET por HTTP. Não foi comparado com outros fornecedores.
3. **Plano da Vercel.** O plano atual do projeto não foi verificado; o Hobby não comporta a migração inteira.
4. **Região.** Proximidade das funções e dos leitores; preço regional a confirmar.
5. **Retenção de edições** (proposta: 30 edições ou 90 dias).
6. **Como as páginas estáticas atualizam**: Deploy Hook (recomendado para começar) ou revalidação sob demanda.
7. **Fixar edição por deploy** ou seguir o ponteiro ao vivo nas leituras em requisição.
8. **Histórico do git**: reescrever para encolher o repositório, ou conviver com o pacote atual.
9. **Autorização para o passo 1** (escrita dupla do Agro), que é a primeira mudança em workflow.

## 9. O que está pronto e como usar

```
node scripts/gold-manifesto.mjs agro            # escreve config/gold-manifestos/agro.json
node scripts/gold-manifesto.mjs agro --check    # confere o manifesto gravado contra public/agro (saída 1 se divergir)
node scripts/gold-manifesto.mjs agro --stdout   # imprime, sem gravar
npx vitest run src/tests/gold-leitor.test.ts
```

```ts
import { lerGold, lerGoldJson } from "@/lib/gold/leitor";
const bytes = await lerGold("agro", "gold/snapshot.json");
```

| Variável | Padrão | Efeito |
|---|---|---|
| `GOLD_ORIGEM` | ausente = `repositorio` | `externo` liga a leitura pelo manifesto; outro valor é erro |
| `GOLD_BASE_URL` | sem padrão | obrigatória em `externo`; `https`, ou `http` só em `localhost` |
| `GOLD_TOKEN` | ausente | enviado em `Authorization: Bearer` |
| `GOLD_PONTEIRO_TTL_S` | 60 | validade do ponteiro em memória |
| `GOLD_TEMPO_LIMITE_MS` | 10000 | limite por requisição |
| `GOLD_CACHE_MAX_MB` | 64 | teto do cache de objetos por instância |

Sobre a credencial: documentado em `https://vercel.com/docs/vercel-blob/private-storage`, o blob privado é lido por GET
em `https://<store-id>.private.blob.vercel-storage.com/<caminho>` com `Authorization: Bearer`, usando o token OIDC de
curta duração (a requisição passa a responder 403 quando ele vence, e quem não usa o SDK cuida da renovação) ou o
`BLOB_READ_WRITE_TOKEN` estático. O leitor de hoje envia um token fixo (`GOLD_TOKEN`). Para OIDC, a adoção troca o
transporte pelo SDK (`definirTransporteGold`); o pacote `@vercel/blob` (versão 2.3 ou superior para armazenamento
privado, segundo a mesma página) **não está instalado** no projeto.

## 10. Limites desta entrega

- Nada foi testado contra um armazenamento real: não há armazenamento nem credencial. Os testes usam um servidor HTTP
  local.
- Não existem ainda: o script de envio, o script de materialização, a rota autenticada para o navegador, a fixação de
  edição por deploy e qualquer mudança de workflow.
- Não foi rodado `npm run build`; nenhuma afirmação deste documento sobre tamanho de função ou sobre o que o build lê
  vem de medida de build.
- Tráfego, latência e custo de leitura não foram medidos.
- O manifesto percorre o que está no disco, inclusive derivados não versionados. No piloto não há nenhum; em
  `public/eficiencia` há 97 (243 no disco, 146 no git), e a adoção desse domínio precisa decidir se o derivado é
  publicado ou continua sendo gerado no build.
