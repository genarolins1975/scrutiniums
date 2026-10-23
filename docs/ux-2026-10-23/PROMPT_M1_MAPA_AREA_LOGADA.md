# Prompt: Iniciativa M1, mapa da área logada, arquitetura e interação

Data: 23/10/2026. Origem: `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md`, seção 6, M1 (segunda por importância, primeira na ordem de execução). Base: `main` em `b825eb9e3`. Destinatário: o modelo que vai implantar. Cole o texto abaixo da linha inteiro, sem cortar as seções de guardrails, de testes e de aceite.

---

## 1. Papel e regra de ouro

Você vai refazer `/app/observatorios`, o mapa da área logada da Scrutiniums. É a página inicial de quem tem conta e o destino de todo login (a home com sessão redireciona para ela, `src/components/home/Home.tsx`). Hoje ela é um índice de 28 coleções e 140 páginas em texto de 12,5 px, que abre com três estados vazios, usa 43 formulários POST no lugar de links, quebra um observatório entre colunas e reintroduz os oito domínios antigos no fim. Ela passa a ser uma tela de decisão: quem acabou de entrar decide em uma olhada para onde vai; quem volta retoma de onde parou. O dono pediu que esta página fique perfeita.

Guardrails, sem exceção:

1. Ler inteiros, antes de qualquer código: `CLAUDE.md`, `AGENTS.md`, `.claude/skills/observatorio-layout/SKILL.md` e, com o PR #362 integrado, os anexos `navegacao.md`, `arquiteturas.md`, `acesso.md`, `identidade-visual.md` e `componentes-e-graficos.md`; `docs/observatorios/DESIGN_SYSTEM_OBSERVATORIOS.md`; `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md` (seções 3, 4 e 6); `docs/REVISAO_ABERTO_2026-10-20.md`, seção "Mapa logado". Carregar as skills `emil-design-eng`, `impeccable` (modo Operate) e `design-taste-frontend` (`references/app-screens.md`, tela de trabalho); em conflito, prevalece a `observatorio-layout`.
2. A página continua fechada (`/app/*`, regra própria no middleware); nada abre sem conta. Nenhuma mudança em `src/lib/rotasPublicas.ts`.
3. Nunca apagar, pular ou afrouxar teste. Teste que fixa o desenho anterior muda de propósito, com a justificativa no PR. Conteúdo não é apagado: o que sai da primeira tela vai para o método, no HTML.
4. Nada anunciado que não exista: estado vazio não é conteúdo de primeira tela; número só com fonte e período; ausência nunca vira zero.
5. Nada de card com ícone, sombra, gradiente, cor como único portador de significado, texto abaixo de 12 px, data em formato ISO. Links são `<a href>`; nenhuma navegação por `<button>` ou `<form method="post">`.
6. Merge só com autorização explícita do dono na conversa. Nunca rebase, amend ou force push em branch que não é sua. Antes de empurrar: `npm run verificar:pr` verde e `npm run evidencias` na rota.
7. Decisões pendentes do dono (seção 8) não se implementam sem resposta; o que já foi decidido não se reabre.
8. Comentários, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência.

## 2. Antes de começar

- Sessão nova: `bash scripts/preparar-sessao.sh`. Build para os testes de UX: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`.
- Comandos: `npm run verificar:rapido`, `npm run verificar:pr`, `npm run evidencias -- --rotas /app/observatorios --saida docs/ux-AAAA-MM-DD/mapa --larguras 390,1440 --modos com`.
- Capturas do estado atual, para comparar: `docs/ux-2026-10-23/evidencias/app_observatorios-1440-com-sessao.jpg` (2.256 px de altura), `app_observatorios-1440-com-sessao-primeira-tela.jpg`, `app_observatorios-390-com-sessao.jpg` (5.631 px), `app_observatorios-390-com-sessao-primeira-tela.jpg`. Medidas de 23/10/2026: cromo 151 px a 1440 e 102 a 390 (orçamento 230 e 200), axe 0, rolagem horizontal 0.

## 3. O que existe hoje

| Arquivo | Papel | Destino |
|---|---|---|
| `src/app/app/(foco)/observatorios/page.tsx` | a página: faixa "Seu lugar" (Continuar, Recortes salvos, Avisos), `DiretorioPaineis`, seção "Fontes e atualização" por domínio | reescrita |
| `src/app/app/(foco)/observatorios/escolha.module.css` | CSS da faixa e das fontes (corpos de 13 e 14 px fora da escala) | reduzido à grade |
| `src/components/observatorios/DiretorioPaineis.tsx` e `.module.css` | H1, busca, parágrafo de inventário, legenda dos selos, diretório em `columns: 3` com formulários POST e páginas inline de 12,5 px | substituído por `MapaDaConta` |
| `src/lib/observatorios/inventario.ts` | `inventario()`: por coleção, as páginas publicadas, parciais e previstas, lidas dos catálogos; `totais()` | mantido; é a fonte do diretório |
| `src/lib/observatorios/lista.ts` | os 6 observatórios, as 28 coleções (id, nome, href, dominio, metodo, glossario), `entrada` de cada observatório, `escolhaObservatorio()` | mantido; é a fonte da ordem e dos links |
| `src/lib/busca/indice.ts` | `indiceDeBusca()`: entradas com `tipo: "colecao"`, `href` e `resumo` (a pergunta curta de cada coleção) | mantido; dá a frase de cada coleção |
| `src/lib/frescor/entradas.ts`, `src/lib/frescor/dominios.ts`, `regras.ts` | `FRESCOR_DAS_COLECOES` (href da entrada → domínios de frescor), `dadosFrescor(ids)` (publicadoEm, referencia), `situacaoDominio`, `rotuloReferencia`, `dataPublicacao`, `textosDominio` | mantidos; dão "dados até" e a situação de cada coleção |
| `src/lib/atualizacaoObservatorios.ts` | `atualizacaoObservatorio(id de domínio)`: linhas "Fontes e cobertura" por domínio antigo | usado só no método, por coleção com domínio |
| `src/lib/opcoesObservatorios.ts` | `OPCOES_OBSERVATORIOS`: os oito domínios antigos mais "Justiça", `opcaoObservatorio()` | sai da página; removido no PR 2 |
| `src/app/app/(foco)/observatorios/entrar/route.ts` | POST que grava o cookie de último acesso e o evento, e redireciona (303) | sai da página; removido no PR 2 |
| `src/lib/dominios.ts` | `COOKIE_OBSERVATORIO = "scrutiniums_observatorio"` (valor: id de observatório ou de opção de domínio) | o cookie passa a ser gravado pelo middleware (seção 5) |
| `src/components/observatorios/ParaVoce.tsx`, `src/lib/observatorios/paraVoce.ts` | bloco "Para você" das entradas: `ParaVoce({ entrada })` lê `PARA_VOCE[entrada]` e monta `PerguntaParaVoce[]` (pergunta, resposta, href, numero com fonte e período ou `semNumero`) | ganha a lista do mapa (seção 4.3) |
| `src/lib/perguntas/portas.ts` | `CONSULTAS` (botijão, luz, município, capital, internet, INSS, escola: pergunta, resumo, href) | usado nos links "Minha cidade" |
| `src/lib/conta/recortes.ts`, `src/lib/conta/alertas.ts` | `listarRecortes(userId)` (titulo, caminho, observatorio, criadoEm), `listarAlertas(userId)` (dominio) | usados na fatia `retomar` |
| `src/components/busca/BuscaPlataforma.tsx` | `variante="pagina"`, `exemplo` | mantido |
| `src/components/observatorios/SeloProntidao.tsx`, `Recolhido.tsx`, `EntradaColecao.tsx` | selo de prontidão (glifo e texto), bloco recolhido, molde das entradas (`data-fatia`) | reutilizados |
| `src/components/telemetria/MarcaVisita.tsx`, `src/app/api/telemetria/route.ts` | `sendBeacon` com `{ secao }` (até 40 caracteres) | modelo do `LinkMedido` |
| `src/app/app/(foco)/layout.tsx` | barra comum sem observatório marcado, `NavegacaoColecao` da conta, "Sair", rodapé de uma linha | mantido |
| `src/components/layout/ParceriaTecnica.tsx` | marca do FGV CERI; o teste `parceria-ceri.test.ts` exige, na página do mapa, o literal `o.id === "energia-e-infraestrutura" && (` e exatamente um `<ParceriaTecnica` | mantido, sob o cabeçalho de Energia e Infraestrutura |

Testes que hoje tocam a página ou as suas peças (não quebrar; os que mudam de propósito estão na seção 6): `ux-orcamentos-cromo` (a rota está em `SUPERFICIES`), `ux-texto-minimo` (rota listada), `busca-barra-browser` (`COM_BARRA` inclui a rota: a barra com a busca continua), `vocabulario` (sem trilha na rota), `navegacao-colecao` (navegação da conta: "Encontre o painel", "Conta", "Admin"), `parceria-ceri` (literal acima), `judiciario-seletor` (o POST e as opções; muda de propósito no PR 2), `cadastro-destino`, `onboarding`, `state-machine`, `i18n-*-fluxo` (destino `/app/observatorios` após login: inalterado), `rotas-publicas`, `i18n-home-acesso-sitemap` (a rota leva ao login sem sessão: inalterado).

## 4. A página nova

Tarefa, em uma frase: quem acabou de entrar decide em uma tela para onde vai; quem volta retoma de onde parou.

Componente `src/components/observatorios/MapaDaConta.tsx` (servidor) com as fatias abaixo, nesta ordem, cada uma num elemento com `data-fatia`, dentro de `<main id="conteudo" data-mapa-conta="">` (a página é `force-dynamic`, como hoje: lê sessão, cookie, recortes e alertas). H1 único. Largura de página `max-w-page` (76 rem) e margens `px-6`, como as entradas.

### 4.1 `retomar` (só quando há algo; nunca estado vazio)

Renderizada apenas se existir pelo menos um de: último acesso, recorte salvo, alerta configurado. Sem nada, a fatia não existe no HTML (nem "ainda sem último acesso", nem "nenhum ainda", nem "nenhum configurado": essas frases saem do código).

- **Continuar**: um cartão com "Continuar em <nome>" como link (`<a href>`), o nome da coleção ou do observatório e a pergunta dela. O destino vem do cookie de último acesso (seção 5): `c:<colecaoId>` leva ao `href` da coleção em `lista.ts`; `o:<observatorioId>` leva à `entrada` do observatório; valor desconhecido ou no formato antigo (id de domínio, "judiciario") é ignorado, sem erro. A Iniciativa M2 troca o destino pela última página visitada; aqui é a coleção.
- **Recortes salvos**: até três, cada um com título (link para `caminho`, `prefetch={false}`) e a coleção; "Todos os recortes" leva a `/app/conta#recortes` quando há mais de três.
- **Avisos**: uma linha "Avisar quando atualizar: <n> fontes" com os nomes (`textosDominio(d).nome`) e o link para `/app/conta#alertas`. Sem aviso, nada.

Forma: três colunas a 1024 px ou mais, uma a 390; cada item com alvo de 44 px; `.t-corpo` e `.t-meta`; filete superior de 3 px na cor bronze (a conta).

### 4.2 `abertura`

- H1 "Encontre o painel" (mantido; o `<title>` já é esse). Uma frase: "Vinte e oito coleções em seis observatórios. Busque pelo tema, pelo lugar ou pela pergunta, ou escolha abaixo." (texto proposto; o dono pode trocar).
- `BuscaPlataforma` `variante="pagina"` com `exemplo={EXEMPLO_DO_CAMPO}`, largura total a 390 e até 44 rem no desktop, com o rótulo visível "Busca em toda a plataforma". Enter continua abrindo o primeiro resultado; na lista, o primeiro resultado ganha a marcação visível de "ativo" desde o início (o componente já tem `aria-activedescendant`; comece com `ativo = 0` quando há resultados).
- Sem o parágrafo de inventário e sem a legenda dos selos nesta fatia: ambos vão para o método (4.5).

### 4.3 `para-voce`

Mesmo componente `ParaVoce` das entradas, que ganha a prop alternativa `perguntas: PerguntaParaVoce[]` (quando presente, substitui `entrada`). A lista vem de `paraVoceDoMapa(uf: string | null)` em `src/lib/observatorios/paraVoce.ts`:

- **Com a UF da conta** (`user.uf`, `src/lib/schema.ts`; depende da decisão 1 da seção 8; sem resposta, fica atrás da constante `PARA_VOCE_POR_UF = false` em `paraVoce.ts`, com os leitores prontos e testados): quatro cartões com número, fonte e período lidos pelos mesmos leitores das consultas por estado, nunca por leitura própria:
  - "Quanto custa encher o tanque em <UF>?" → `dadosDoEstado` de `src/lib/combustiveis/dados.ts` (gasolina comum, `ufs.find(uf)`, `ultimoMes`, fonte "ANP, Levantamento de Preços de Combustíveis"), destino `/combustiveis/no-meu-estado?uf=<UF>`;
  - "Quanto custa o botijão em <UF>?" → `dadosBotijaoNoEstado` de `src/lib/gas/botijaoNoEstado.ts`, destino `/gas-natural/gas-de-cozinha?uf=<UF>`;
  - "Como está a violência em <UF>?" → `pacoteEstados` de `src/lib/eficiencia/seguranca/dados.ts` (o indicador principal do painel "Por estado", último ano, com o nome do indicador no rótulo), destino `/eficiencia-estatal/seguranca-publica/estados` com o parâmetro de UF que a página já aceita;
  - "Como estão as contas do estado de <UF>?" → a ficha de `/contas-publicas-estaduais` (conferir em `src/app/contas-publicas-estaduais` o parâmetro que escolhe o estado e o leitor do resultado primário; sem leitor pronto, o cartão vai sem número e com `semNumero: "a ficha mostra os números depois de escolher o estado"`).
  - Sem UF na conta (contas anteriores à obrigatoriedade), os quatro cartões saem sem número e com `semNumero` e com o destino sem parâmetro.
- **Minha cidade**, sempre: um cartão por consulta de `CONSULTAS` (`src/lib/perguntas/portas.ts`) que é por município (luz, município, internet, INSS, escola) mais "Teve fogo perto de mim?" (`/territorio/queimadas`) e "Quanto subiu o custo de vida na minha cidade?" (`/custo-de-vida`), sem número, com `semNumero: "o número aparece depois de escolher a cidade"`. A Iniciativa I3 traz o município da conta e os números.

Regras do bloco (já fixadas por `src/tests/para-voce.test.ts`): destino existente em `src/app`, número com fonte e período ou `semNumero`, número lido da mesma base do destino. O teste ganha o caso do mapa.

### 4.4 `destinos`

O diretório, em grade de verdade, nunca em `columns`:

- Seis seções `<section>` na ordem de `OBSERVATORIOS` (`lista.ts`), uma por observatório, cada uma inteira (nunca quebrada). A 1024 px ou mais, as seções ficam em duas colunas de grade (`grid-template-columns: repeat(2, minmax(0, 1fr))`, Famílias e Serviços Públicos na primeira linha, Contas Públicas e Energia na segunda, Economia e Território na terceira; alturas desiguais são aceitáveis, buracos não: a grade usa `align-items: start` e cada seção ocupa a própria célula). A 390 px, uma coluna.
- Cabeçalho da seção: `h2` com o `nomeCurto` como link para `o.entrada` (`.t-h2`, serifa), a `pergunta` abaixo (`.t-corpo`, `text-carvao-muted`), filete superior de 2 px na cor do acento do observatório (`ACENTO[o.acento].filete`). Sob o cabeçalho de Energia e Infraestrutura, a `ParceriaTecnica` compacta (mantendo o literal que o teste exige).
- Uma linha por coleção (`<article>`), com alvo de 44 px:
  - o nome como link (`<a href={c.href}>`, `prefetch={false}`), `.t-corpo` com peso 500;
  - a pergunta curta: o `resumo` da entrada `tipo: "colecao"` com o mesmo `href` em `indiceDeBusca()`; sem resumo, nada (nunca inventar);
  - a linha de estado em `.t-meta`: "<N> páginas · dados até <referência>" onde N é `1 + paginas.length` do inventário (a entrada conta; "1 página" quando a coleção só tem a entrada) e a referência vem de `FRESCOR_DAS_COLECOES[c.href]` → `dadosFrescor(ids)` → `rotuloReferencia(referencia)` (ou `dataPublicacao(publicadoEm)` quando não há referência); para coleção sem domínio de frescor (as da aplicação do Crédito e os temas da Eficiência), usar o domínio de origem (`c.dominio` ou a origem do painel no registro) e, sem data confiável, omitir a parte "dados até" (nunca estimar). Quando `situacaoDominio` dá `atrasado` ou `retida`, acrescentar o texto de `textoSituacao` ("atualização atrasada há N dias"), nunca cor sozinha;
  - `SeloProntidao` ao lado do nome só quando a coleção não é "publicado": `navegacaoDaColecao(c.id).estado` (hoje só "piloto" nas Contas Estaduais) ou "parcial" quando todas as páginas do inventário são parciais;
  - um `<details>` "As <N> páginas" com a lista vertical das páginas (`inventario().colecoes[].paginas`): link de 44 px por página, `SeloProntidao` "parcial" inline quando for o caso, página prevista como texto com o selo "em preparação" (nunca link, `title` com a pendência). Sem páginas além da entrada, sem `<details>`.
- "cobertura parcial" aparece uma vez por página, pelo selo, nunca em texto repetido; "só o painel de entrada" sai.

### 4.5 `metodo`

Um só `<details>` no fim, `summary` "Como este mapa é montado", com, nesta ordem: o inventário ("28 coleções em seis observatórios; 123 páginas publicadas, 13 com cobertura parcial, 4 previstas", lido de `totais()`); a legenda dos três selos (`SeloProntidao` com o texto de cada um); "Fontes e atualização" por coleção, na ordem do diretório, cada uma com o `FaixaFrescor` variante "metodo" dos seus domínios (`FRESCOR_DAS_COLECOES`) e, para as coleções sem domínio de frescor, as linhas de `atualizacaoObservatorio(dominio de origem)`; a nota "Ausência de dado é declarada, nunca estimada". Nada de domínio antigo como título: os nomes são os das coleções e dos observatórios.

### 4.6 Forma e medidas

- Tipografia só pela escala única: `.t-h1`, `.t-h2`, `.t-corpo`, `.t-meta`, `.rotulo`; nenhum `font-size` nos módulos CSS. O CSS próprio fica só com a grade, os filetes e os alvos de toque; `DiretorioPaineis.module.css` sai.
- Papel em todo `main`; superfícies brancas só na busca. Sem cartões com borda nas linhas de coleção: linhas separadas por filetes `linha`, como o diretório das entradas.
- Cromo: continua dentro de 230 e 200 px (nada muda na barra). Altura: até 3.500 px a 1440 e 7.000 a 390 (o mesmo orçamento das portas abertas). H1 na primeira tela. O primeiro cartão do "Para você" com o topo abaixo de 900 px a 1440.
- Celular (390 px): `retomar`, `abertura` e `para-voce` antes do diretório; seções empilhadas; linhas de 44 px; `<details>` das páginas fechados. A busca da página é a mesma da barra, sem segunda folha.
- Movimento: nenhuma animação de entrada; só a transição de cor dos links (`motion-safe`), como no resto da plataforma.
- Acessibilidade: cada seção com `aria-labelledby`; `<details>` com `summary` de 44 px; foco visível na cor do acento; axe 0.

### 4.7 Esboço, a 1440 px

```
[barra comum | Encontre o painel · Conta · Sair]
retomar      Continuar em Setor Elétrico →   | Recortes salvos: 2 (títulos) | Avisar quando atualizar: 1 fonte
abertura     H1 Encontre o painel
             frase
             [ busca em toda a plataforma ............ ]
para-voce    Para você (UF)      [tanque em SP] [botijão em SP] [violência em SP] [contas de SP]
             Minha cidade        luz · saneamento · internet · INSS · escola · queimadas · custo de vida
destinos     ┌ Famílias ───────────────┐  ┌ Serviços Públicos ─────────┐
             │ Renda e trabalho        │  │ Educação                    │
             │  pergunta curta         │  │  pergunta curta             │
             │  14 páginas · dados até │  │  3 páginas · dados até      │
             │  ▸ As 14 páginas        │  │  ▸ As 3 páginas             │
             │ ...                     │  │ ...                         │
             ┌ Contas Públicas ────────┐  ┌ Energia e Infraestrutura ──┐  (parceria técnica sob o título)
             ┌ Economia ───────────────┐  ┌ Território e Clima ────────┐
metodo       ▸ Como este mapa é montado
[rodapé de uma linha da conta]
```

## 5. Interação

1. **Links, não formulários.** Todo destino do mapa é `<a href>`. Os 43 `<form method="post">` saem.
2. **Último acesso pelo middleware.** `src/middleware.ts` passa a gravar o cookie `scrutiniums_observatorio` em toda navegação de página (`accept` com `text/html`, método GET) com sessão válida cujo caminho é uma coleção ou uma entrada do registro: valor `c:<colecaoId>` quando o caminho é igual ao `href` de uma coleção de `lista.ts` ou começa por ele seguido de `/`; `o:<observatorioId>` quando é a `entrada` de um observatório. Só `lista.ts` é importado no middleware (é compatível com o Edge: importa apenas tipos de `dominios.ts`); a constante do cookie se move para `src/lib/observatorios/ultimoAcesso.ts` (reexportada de `dominios.ts` para nada quebrar), com `lerUltimoAcesso(valor)` que resolve os dois formatos novos e ignora os antigos. Prefixos ambíguos (`/observatorio` é a coleção Crédito e prefixo de `/observatorio-do-credito`) se resolvem pelo casamento mais longo. Cookie `httpOnly`, `sameSite: lax`, `secure` em produção, um ano.
3. **Telemetria no clique.** `src/components/telemetria/LinkMedido.tsx` (cliente): um `<a>` que, no clique, envia `navigator.sendBeacon("/api/telemetria", { secao: "mapa:<colecaoId>" })` (até 40 caracteres; `mapa:o:<observatorioId>` para as entradas) e deixa a navegação seguir. Substitui o evento `observatorio_aberto` do POST.
4. **O POST `/app/observatorios/entrar`** deixa de ser usado pela página no PR 1 e é removido no PR 2, junto com `opcoesObservatorios.ts`; `judiciario-seletor.test.ts` muda de propósito (seção 6).
5. **Busca**: inalterada no comportamento; só o "ativo" inicial e o rótulo visível (4.2).

## 6. Testes

### 6.1 Novo: `src/tests/mapa-conta.test.ts`

Mesma infraestrutura de `src/tests/entrada-molde.test.ts` (`subirServidor`, `htmlDe` de `src/tests/suporte/servidor-producao.ts`; só com build; `EXIGIR_BUILD_HTML=1` reprova sem build). Com sessão de teste (sem cookie de último acesso, sem recortes, sem alertas) e, num segundo caso, com um recorte e um alerta inseridos no banco temporário e o cookie `c:setor-eletrico`:

- `<main data-mapa-conta="">` único; fatias conhecidas e na ordem `retomar`, `abertura`, `para-voce`, `destinos`, `metodo`; `retomar` ausente no primeiro caso e presente no segundo, com "Continuar em Setor Elétrico" como `<a href="/setor-eletrico">`;
- nenhuma das frases "ainda sem último acesso", "nenhum ainda", "nenhum configurado", "só o painel de entrada" no HTML;
- H1 único "Encontre o painel";
- cada uma das 28 coleções de `lista.ts` aparece exatamente uma vez como `<a href="<href>">` dentro de `data-fatia="destinos"`; os seis observatórios na ordem do registro, cada um com `<a href="<entrada>">`; nenhum `<form` dentro de `destinos`; nenhum `data-view`;
- nenhum `nomeLegado` de `DOMINIOS` nem os rótulos "Eficiência Estatal", "Contas Federais" fora dos nomes de coleção do registro; nenhuma ocorrência de "Explorar";
- a linha de estado de cada coleção casa com `/\d+ páginas?( · dados até .+)?/` e o N bate com `1 + paginas.length` do `inventario()`;
- cada cartão do "Para você" tem `data-prova-numero` (fonte · período) ou `data-sem-numero`;
- selos só por `data-prontidao`; página prevista nunca dentro de `<a>`;
- um só `<details data-fatia="metodo">`, última fatia, contendo os totais de `totais()`;
- nenhum texto visível com data ISO; nenhum `font-size` nos CSS da página (teste estático sobre os módulos).

### 6.2 Unitários

- `paraVoceDoMapa("SP")` e `paraVoceDoMapa(null)`: toda pergunta com `href` existente em `src/app`, número com fonte e período ou `semNumero`; os números por UF iguais aos que `dadosDoEstado` e `dadosBotijaoNoEstado` devolvem para a mesma UF (acrescentar a `src/tests/para-voce.test.ts`).
- Middleware: `lerUltimoAcesso` resolve `c:` e `o:`, ignora "judiciario", "eficiencia" e lixo; o cookie é gravado em `/setor-eletrico/pld` e em `/observatorios/familias` com sessão, não é gravado sem sessão, não é gravado em `/sobre` nem em `/app/conta`, e não muda numa requisição RSC (`accept` sem `text/html`); `/observatorio-do-credito` grava `c:credito`? Não: é página aberta de apresentação, não coleção; só `/observatorio` e abaixo gravam `c:credito`.
- `LinkMedido`: envia o `secao` certo e não impede a navegação (teste com `renderToStaticMarkup` e um `sendBeacon` falso).

### 6.3 Orçamentos e testes existentes

- `src/tests/ux-orcamentos-comprimento.test.ts`: acrescentar `mapa: { 1440: 3500, 390: 7000 }` e a rota com sessão.
- `ux-orcamentos-cromo`, `ux-texto-minimo`, `busca-barra-browser`, `vocabulario`, `navegacao-colecao`, `cabecalho-movel`: continuam verdes sem mudança.
- `parceria-ceri.test.ts`: o literal `o.id === "energia-e-infraestrutura" && (` e o único `<ParceriaTecnica` passam a ser procurados em `MapaDaConta.tsx`; mudar o caminho no teste, de propósito, com o motivo.
- `judiciario-seletor.test.ts` (PR 2): os casos do POST e das opções saem; entram os casos do cookie pelo middleware e do `LinkMedido`; o que fica: todos os domínios continuam alcançáveis pelo mapa (cada `rotaRaiz` de `DOMINIOS` aparece como `href` de alguma coleção ou página do diretório).
- `src/tests/uso-paginas.test.ts`: a lista fechada de rotas não muda (a rota existe); se `entrar/route.ts` sair no PR 2, rodar `node scripts/rotas-do-app.mjs` e versionar o JSON regenerado.

## 7. Critério de aceite

| Medida | Exigido | Como medir |
|---|---|---|
| Primeira tela a 1440 px, sem rolar | `retomar` (quando houver), H1, busca e os cartões do "Para você" | captura `primeira-tela` |
| Nenhum observatório quebrado; nenhuma coleção sem link direto; nenhum texto de inventário antes do diretório | sim | `mapa-conta.test.ts` e captura |
| Axe (WCAG 2.1 A e AA) | 0 a 1440 e 390 | `npm run evidencias` |
| Rolagem horizontal | 0 | idem |
| Cromo | até 230 e 200 px | idem |
| Altura | até 3.500 px a 1440 e 7.000 a 390 | `ux-orcamentos-comprimento` |
| Texto mínimo | nenhum abaixo de 12 px; nenhum `font-size` fora da escala | `ux-texto-minimo`, `design-tokens` |
| Alvos de toque | 44 px em todo link e `summary` do diretório | axe e conferência manual a 390 |
| Teclado | Tab percorre busca, cartões, seções e `<details>` em ordem de leitura; foco visível | conferência manual, registrada |
| Rubrica da skill (seção 10) | 9 em Hierarquia, Interação e acessibilidade e Responsividade; 8 nos demais | revisão independente: outra sessão, com as capturas e a rubrica, escreve `docs/ux-AAAA-MM-DD/mapa/revisao-independente.md`; autoavaliação não vale para esta linha |
| Antes e depois | capturas a 390 e 1440, primeira tela e página inteira, com sessão, nos dois casos (conta nova e conta com último acesso, recorte e alerta) | `docs/ux-AAAA-MM-DD/mapa/` |

## 8. Decisões já tomadas e decisões pendentes

Já decididas (não reabrir): a página se chama "Encontre o painel" e é o destino de todo login; a busca da plataforma é `BuscaPlataforma`; vocabulário Observatório → Coleção → Página; rótulos em caixa alta a 12 px; sem numeração 01, 02, 03; marca do FGV CERI sob Energia e Infraestrutura; princípio do aperitivo e rotas fechadas inalterados.

Pendentes (seção 8 do parecer):

1. **Usar a UF do perfil nos cartões do "Para você"** (decisão 1): sem resposta, implementar com `PARA_VOCE_POR_UF = false`, cartões sem número e sem parâmetro; ligar é trocar a constante e publicar a linha na política de privacidade.
2. **Texto da frase de abertura**: proposta na seção 4.2; o dono pode trocar.
3. **As páginas de cada coleção em `<details>` dentro do mapa, ou só na entrada da coleção**: padrão deste prompt é o `<details>`; se o dono preferir o mapa mais curto, a lista sai e a linha "N páginas" vira link para a entrada.

## 9. Plano de PRs

| PR | Nome | Conteúdo |
|---|---|---|
| 1 | Mapa 1: arquitetura e interação | `MapaDaConta.tsx`, `paraVoceDoMapa`, `ParaVoce` com `perguntas`, cookie pelo middleware com `ultimoAcesso.ts`, `LinkMedido`, `page.tsx` reescrita, CSS reduzido, `mapa-conta.test.ts`, orçamento de comprimento, `parceria-ceri` ajustado, evidências e revisão independente |
| 2 | Mapa 1b: retirada do POST e das opções antigas | `entrar/route.ts` e `opcoesObservatorios.ts` removidos; `atualizacaoObservatorios.ts` reduzido ao que o método usa; `judiciario-seletor.test.ts` com o propósito novo; `rotas-do-app.json` regenerado |

## 10. O que não fazer

- Não mexer na barra comum, na navegação da conta, no `(foco)/layout.tsx` nem em `/app/conta` e `/app/admin` (a Iniciativa M2 alinha a conta).
- Não criar segundo componente de número, cartão ou selo: `NumeroEscala`, `ParaVoce`, `SeloProntidao` e `Recolhido` são os que existem (a Iniciativa I1 os funde num kit; se o kit já existir quando este PR for feito, usar `NumeroIndicador`).
- Não guardar nada além do cookie de último acesso; nenhuma tabela nova (é a M2); nenhum dado pessoal novo.
- Não listar os oito domínios antigos em lugar nenhum da página.
- Não usar `columns` do CSS; não usar `<button>` para navegar; não usar formulários para links.
- Não inventar data de atualização: sem domínio de frescor, a linha fica sem "dados até".
- Não abrir mais de um PR por vez nem incluir melhorias "de carona" fora do mapa.

## 11. Como relatar

Descrição do PR, nesta ordem: o que muda para o leitor (duas frases); tabela de aceite da seção 7 preenchida; medidas antes e depois (altura, links, formulários, `font-size` fora da escala, axe); testes novos e os que mudaram de propósito, com o motivo; riscos (cookie no middleware em toda navegação: custo de uma leitura de lista estática, sem banco); pendências reais; "Merge só com autorização explícita do dono". Capturas em `docs/ux-AAAA-MM-DD/mapa/` com `evidencias.md` e `revisao-independente.md`.

Ao fim, uma mensagem de uma tela para o dono, que lê pelo celular: o que o leitor ganha na primeira tela, o link do preview da Vercel da rota (com conta), o estado real (PR aberto, CI verde ou vermelho, revisão independente com as notas) e, se houver, a decisão 1 pendente em uma linha.
