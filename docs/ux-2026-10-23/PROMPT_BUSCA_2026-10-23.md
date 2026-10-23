# Prompt: busca da plataforma, ciclo 2 (correspondência, sinônimos, índice, estado vazio, um motor só)

Data: 23/10/2026. Origem: `docs/ux-2026-10-23/DIAGNOSTICO_BUSCA_2026-10-23.md` e o anexo `BUSCA_TERMOS_CONTROLE_2026-10-23.md`. Base: `main` em `00c055474`. Destinatário: o modelo que vai implantar (Codex, GPT, Claude ou outro). Cole o texto abaixo da linha inteiro, sem cortar as seções de guardrails, do conjunto de controle, das decisões e do aceite.

---

## 1. Papel e regra de ouro

Você vai fazer a busca da Scrutiniums encontrar o que um leitor leigo digita do jeito que ele digita: no plural, em frase, com erro de digitação, pela sigla, pela fonte, pelo nome popular. A arquitetura não muda: um índice (`src/lib/busca/indice.ts`, servido em `/busca/indice.json`), um motor (`src/lib/busca/buscar.ts`), um componente (`BuscaPlataforma`), uma lista (`ListaResultados`), uma página (`/buscar`), tudo montado do registro e dos catálogos. O que muda é a qualidade do que está dentro: como as palavras casam, o que o índice sabe de cada página, como os sinônimos se ligam aos destinos, o que a tela diz quando não acha e o que a medição consegue registrar.

Guardrails, sem exceção:

1. Ler inteiros, antes de qualquer código: `CLAUDE.md`, `AGENTS.md`, `.claude/skills/observatorio-layout/SKILL.md` e os anexos `busca.md`, `acesso.md`, `navegacao.md` e `componentes-e-graficos.md`; `docs/observatorios/MEDICAO_DE_USO.md` (§8a e §9); `docs/ux-2026-10-23/DIAGNOSTICO_BUSCA_2026-10-23.md`; `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md` (achados A7, A12, iniciativa I4 item 7 e M1). Carregar as skills `emil-design-eng`, `impeccable` e `design-taste-frontend` para o que tocar tela (em conflito, prevalece a `observatorio-layout`).
2. Nunca apagar, pular ou afrouxar teste. Teste que fixa o desenho anterior muda de propósito, com a justificativa no PR e os invariantes preservados. Os dez termos de controle de `src/tests/busca.test.ts` continuam passando.
3. Destino novo entra na busca pelo registro e pelos catálogos de cada domínio, nunca por lista escrita em `src/lib/busca` (teste `busca-indice.test.ts` confere os literais de endereço). Sinônimo novo vai para `src/lib/busca/sinonimos.json`, único arquivo.
4. O índice leva só títulos, resumos, endereços, situação e termos; nunca número, série ou arquivo de painel. Fica aberto sem conta pelo endereço exato (`ARQUIVOS_DAS_CONSULTAS`). Peso alvo de 150 KB antes da compressão; se passar, primeiro encurtar as razões sociais das listas de lugares (sigla e nome de fantasia bastam), e só então, se ainda passar, subir o teto registrando no PR o tamanho comprimido.
5. A medição nunca grava nada que identifique pessoa. Toda mudança de regra de medição depende da decisão do dono (seção 7) e atualiza `MEDICAO_DE_USO.md` no mesmo PR.
6. Nada de biblioteca de busca. O índice tem poucas centenas de entradas e o vocabulário tem cerca de 1.500 palavras; tudo cabe em código próprio, sem dependência nova.
7. Um PR por bloco (seção 4), base `main`, sem empilhar. Merge só com autorização explícita do dono na conversa. Nunca rebase, amend ou force push em branch que não é sua.
8. Antes de empurrar: `npm run verificar:pr` verde e `npm run evidencias` nas rotas alteradas. Um push validado vale mais que três especulativos.
9. Decisões pendentes do dono (seção 7) não se implementam sem resposta; o que já foi decidido (seção 7) não se reabre.
10. Comentários de código, commits e PR em português do Brasil, no estilo do repositório: dizem o porquê, com data e evidência.

## 2. Antes de começar

* Sessão nova: `bash scripts/preparar-sessao.sh`. Nas sessões do Claude Code o hook já o chama.
* Comandos: `npm run verificar:rapido` (lint, tipos, cobertura bilíngue e testes afetados), `npm run verificar:pr` (o que o CI roda), `npm run evidencias -- --rotas /a /b --saida docs/ux-2026-10-23/busca-prN --larguras 390,1440`.
* Testes de navegador da busca: `src/tests/busca-barra-browser.test.ts` (precisa do build: `NODE_OPTIONS=--max-old-space-size=4096 npm run build`).
* Para ver o índice e testar termos sem subir a aplicação, um teste descartável em `src/tests/` que chame `indiceDeBusca()` e `buscar()` e grave o resultado num arquivo fora do repositório; apagar antes do commit.
* O índice é só em português e o campo não aparece nas páginas em inglês. Nenhum texto novo da busca precisa de versão em inglês, mas `node scripts/cobertura-i18n.mjs --check` continua obrigatório.

## 3. O que existe e o que está errado

### 3.1 Peças (não mudam de lugar)

| Peça | Arquivo | Papel |
|---|---|---|
| Índice | `src/lib/busca/indice.ts`, `tipos.ts` | Monta as entradas do registro (`lista.ts`, `inventario.ts`), dos catálogos (`portas.ts`, `paraVoce.ts`, `rotasPublicas.ts`, `navegacaoColecao.ts`, `DESTINOS_NAVEGACAO`), dos glossários e das listas de lugares |
| Motor | `src/lib/busca/buscar.ts`, `normalizar.ts` | Correspondência, ordem, agrupamento |
| Sinônimos | `src/lib/busca/sinonimos.json`, `exemplos.ts` | 58 grupos; os três exemplos do campo |
| Interface | `src/components/busca/BuscaPlataforma.tsx`, `ListaResultados.tsx`, `src/app/buscar/page.tsx` | Campo, lista, página sem JavaScript |
| Medição | `src/lib/busca/medir.ts`, `src/app/api/uso/busca/route.ts`, `src/lib/uso/busca.ts`, `src/lib/uso/painel.ts`, `src/components/admin/UsoBusca.tsx` | Contador por termo e quadros do admin |
| Legado | `src/lib/energia/busca.ts`, `src/components/energia/BuscaObservatorio.tsx`, `src/lib/energia/aprenda-busca.ts` | Dois motores antigos do Setor Elétrico, ainda montados |
| Testes | `src/tests/busca.test.ts`, `busca-indice.test.ts`, `busca-barra-browser.test.ts`, `uso-busca.test.ts`, `energia-mapa.test.ts`, `energia-aprenda-*.test.ts` | |

### 3.2 Defeitos, com a evidência de 23/10/2026 (índice gerado do `main` em `00c055474`)

1. **Correspondência frágil.** Cada palavra digitada precisa começar uma palavra do destino. Sem plural ("hospitais" 0, "enchentes" 0, "agências reguladoras" 0), sem palavras de pergunta ("como funciona o PLD" 0; "o que é PLD" 8), sem erro de digitação ("saneamneto" 0), sem resultado parcial ("cartão de crédito rotativo" 0, "juros do cartão" 0, "quanto o governo gasta com educação" 0). Em 234 termos de controle, 79 deram 0.
2. **Índice magro fora do Setor Elétrico.** Das 108 páginas, 87 sem resumo e 67 sem termos; 63 sem nenhum dos dois (entram só pelo título; 15 têm título de uma palavra). Setor Elétrico: 15 de 15 com resumo e termos. Crédito 0 de 24, Saneamento 0 de 14, Agro 0 de 16, Gás 0 de 8. Há 192 `page.tsx` com `metadata.description` que o índice não lê.
3. **Sinônimos mortos e listas poluídas.** Seis grupos não alcançam destino nenhum ("cartão de crédito", "orçamento federal", "dívida pública", "Nubank", "Banco do Brasil", "Itaú"). A expansão de grupos sobre as listas de 194 bancos e 176 distribuidoras anexou os grupos "agronegócio", "desmatamento", "internet" e "Pix" à consulta "Quanto o meu banco cobra de juros?": "Amazônia", "pecuária", "safra", "exportação" e "Anatel" levam ao banco em primeiro ou entre os primeiros.
4. **Medição cega.** Só grava texto de termo cujas palavras já estão no vocabulário; vocabulário novo vira `#fora-do-indice` sem texto. Digitar e desistir não conta. O quadro "Buscas sem resultado" do admin não pode mostrar o que falta.
5. **Estado vazio sem saída.** "Nenhum resultado para X. Veja as coleções." para palavra desconhecida, combinação sem destino e tema não coberto, sem distinção, sem aproximação, sem correção, sem a lista do que a plataforma cobre.
6. **Três motores.** `BuscaObservatorio` (legado) ainda montado em `/setor-eletrico` sob um `BuscaPlataforma` com filtro (achado A12); `aprenda-busca.ts` filtra o Aprenda; o legado tem plural, pergunta, sigla e parcial que o motor da plataforma não tem. O comentário de `indice.ts` cita `scripts/busca-indice.mjs`, que não existe.

## 4. O que construir, em cinco blocos (um PR cada)

### Bloco 1. Motor: casar como o leitor escreve

Arquivos: `src/lib/busca/buscar.ts`, `src/lib/busca/normalizar.ts`, `src/components/busca/ListaResultados.tsx`, `src/components/busca/BuscaPlataforma.tsx`, `src/app/buscar/page.tsx`, `src/tests/busca.test.ts`, novo `src/tests/busca-controle.test.ts`.

1. **Formas da palavra digitada** (`formasDe` em `normalizar.ts`): a palavra e o singular provável, só do lado de quem digita: "ões" e "ães" para "ão"; "ais", "eis", "ois" para "al", "el", "ol"; "ns" para "m"; "s" final em palavra de quatro letras ou mais para sem "s". Qualquer forma pode casar inteira ou como começo de palavra do destino. `normalizar()` em si não muda: é compartilhada com `DiretorioPaineis` e com a medição.
2. **Palavras de pergunta** (`PERGUNTA` em `normalizar.ts`, portada de `src/lib/energia/busca.ts`, só as portuguesas): saem da busca quando sobra outra palavra. "como funciona o PLD" vira "pld"; "qual a tarifa social" vira "tarifa social"; "quanto o governo gasta com educação" vira "governo gasta educação".
3. **Palavra curta** (até três letras): casa inteira; se nada aparecer, vale o começo de palavra (como no legado: "dec" acha DEC antes de "declarados"; "ce" ainda acha a CEMIG).
4. **Sigla inteira**: palavra digitada igual, inteira, a uma palavra do título ou dos termos que no original está toda em maiúsculas (até seis letras) vale nível 0. "ANEEL" passa a abrir o verbete "Agência Nacional de Energia Elétrica" antes de "Agenda Regulatória da ANEEL". O motor precisa guardar o original das palavras ao preparar o índice.
5. **Resultado parcial**, novo nível 4, com `RespostaBusca.parcial: true` e, em cada resultado, `casou: string[]` (as palavras que casaram): quando nenhum destino tem todas as palavras úteis e (a) há três ou mais palavras úteis, ou (b) há duas e ambas existem no vocabulário do índice. Entram os destinos com ao menos metade das palavras no título ou nos termos; as listas de lugares não participam do parcial (evita "Belo Horizonte" trazer "Novo Horizonte"). Ordem: mais palavras casadas, depois a ordem normal. Limite 10. A tela rotula: "Nenhuma página tem todas as palavras. O mais próximo, por 'juros' e 'cartão':".
6. **Um erro de digitação**: palavra útil com cinco letras ou mais que não casa com nada recebe a correção pelo vocabulário do índice (distância de Damerau e Levenshtein 1; 2 a partir de oito letras), preferindo a palavra mais frequente no índice. Se existe exatamente uma correção com resultado, a busca roda com ela e devolve `correcao: { de, para }`; a tela diz "Mostrando resultados para 'saneamento'. Buscar 'saneamneto' mesmo assim." Se há mais de uma, lista até três como "Você quis dizer…". Vocabulário montado uma vez em `preparar()`, no mesmo `WeakMap`.
7. **Via sinônimo**: quando a palavra casou só num termo (não no título nem no resumo), o resultado leva `via: string` com a expressão original do termo, e `ListaResultados` mostra "· via botijão" na linha de meta, para a busca não parecer arbitrária.
8. **Primeiro resultado destacado** (M1 do parecer de 23/10/2026): a opção que o Enter abre recebe marca visível antes de qualquer seta, não só o `data-ativa` depois dela.
9. **Ordem**: nível, situação, tipo, tamanho do título, alfabética, como hoje. `aberta` não entra na ordem (decisão pendente, seção 7).

Testes do bloco: `busca-controle.test.ts` com o conjunto da seção 5 (cada linha: termo, condição esperada); os dez termos antigos intactos; parcial nunca aparece quando há resultado completo; correção nunca aparece quando a palavra original casa; listas de lugares fora do parcial; sigla inteira antes de prefixo.

### Bloco 2. Sinônimos: alcance certo

Arquivos: `src/lib/busca/sinonimos.json`, `src/lib/busca/indice.ts`, `src/lib/observatorios/inventario.ts` (só `TERMOS`), `src/tests/busca-indice.test.ts`.

1. **Duas seções no arquivo**: grupos temáticos (como hoje) e `_nomes`, para apelidos de nomes próprios (Nubank, BB, Caixa, Itaú e os nomes antigos de distribuidoras: Celpe, Coelba, Cosern, Celpa, Cemar, Ampla, Eletropaulo, Escelsa, Bandeirante, Celg e outros que o leitor ainda usa). Cada apelido de distribuidora aponta para um nome que **existe** em `public/energia/gold/conta.json`; conferir um a um, e deixar de fora o que não puder ser confirmado. Nada inventado.
2. **Expansão**: grupos temáticos só sobre título e termos dos destinos; sobre as listas de lugares, só `_nomes`. Sai da consulta de bancos tudo o que não é nome de banco.
3. **Grupos mortos**: "cartão de crédito" ganha gancho em `TERMOS["economia/pagamentos"]` e, com o Bloco 3, na página "Juros por instituição"; "orçamento federal" em `TERMOS["contas-publicas/federais"]`; "dívida pública" em `TERMOS["contas-publicas/divida-governos"]` e `TERMOS["contas-publicas/federais"]`. Os três de nome próprio migram para `_nomes`.
4. **Grupos novos**, só onde há destino: "agência reguladora" (regulador, reguladora, agências reguladoras, autarquia) ligado às páginas "Regulação" do Setor Elétrico e do Gás, a "Marcos regulatórios" e ao verbete da ANEEL; "PGFN" em "Quem deve à União?"; "LRF" em Contas Estaduais; "salário mínimo" em Renda e trabalho; "feminicídio" em Segurança pública; "Pantanal" em Fogo e queimadas. Para cada um, conferir que a página trata do assunto antes de ligar; o grupo não cria cobertura que a página não tem.
5. **Exemplos do campo** (`_exemplos`): manter três, mas conferir que os três continuam entre os termos mais fortes do índice.

Testes do bloco: nenhum grupo temático sem destino; nenhuma palavra de grupo temático dentro de `lugares.banco` ou `lugares.distribuidora`; todo apelido de `_nomes` de distribuidora resolve para um nome presente na lista; "Amazônia", "pecuária", "safra", "Anatel" e "5G" não trazem a consulta de bancos entre os três primeiros; o arquivo continua com entre 40 e 70 grupos temáticos.

### Bloco 3. Índice: toda página com pergunta e termos

Arquivos: `src/lib/observatorios/inventario.ts` (`PaginaInventario` ganha `resumo?` e `termos?`), os catálogos de cada domínio que o inventário lê (localizar em `inventario()`: capítulos do Saneamento e das Contas, dimensões da Eficiência Estatal, vistas do Crédito, páginas do Gás, do Agro, do Território e das Famílias), `src/lib/busca/indice.ts` (passa `resumo` e `termos` da página), novo `src/tests/busca-cobertura.test.ts`.

1. **Contrato**: toda página publicada ou parcial do inventário tem `resumo` (uma frase, até 140 caracteres, de preferência a pergunta que a página responde) e `termos` (3 a 12: siglas, fontes, indicadores e o vocabulário leigo que o título não diz). Fica no catálogo do domínio, ao lado do título e da rota. Nunca em `src/lib/busca`.
2. **Primeiro preenchimento**: a partir de `metadata.description` da própria `page.tsx` e do lead da página, à mão, revisando cada frase para o contrato editorial (sem adjetivo, sem julgamento, sem número de painel). Não ler `metadata.description` no build: importaria as páginas inteiras no gerador do índice.
3. **Catraca**: `busca-cobertura.test.ts` fixa, na abertura do bloco, a lista das 63 páginas que hoje não têm resumo nem termos; falha se uma página fora da lista ficar sem os dois, falha se a lista crescer, e a lista deve chegar a zero no fim do bloco (então o teste exige os dois campos para todas e a lista some).
4. **Peso**: medir o JSON a cada etapa. Ao passar de 150 KB, encurtar primeiro as razões sociais das listas de lugares (guardar sigla e nome de fantasia, tirar "S.A.", "LTDA", "DISTRIBUIDORA DE ENERGIA" e similares); só depois, se ainda passar, subir o teto, com o tamanho comprimido no PR.
5. **Comentário de `indice.ts`**: tirar a menção a `scripts/busca-indice.mjs`; descrever a rota `force-static`.

Testes do bloco: catraca; peso; nenhum resumo com valor com unidade (teste já existente); os termos de controle da seção 5 marcados como "Bloco 3" passam.

### Bloco 4. Estado vazio e medição

Arquivos: `BuscaPlataforma.tsx`, `ListaResultados.tsx`, `src/app/buscar/page.tsx`, `src/lib/busca/medir.ts`, `src/lib/uso/busca.ts`, `src/lib/uso/painel.ts`, `src/components/admin/UsoBusca.tsx`, `src/lib/schema.ts` e migração, `docs/observatorios/MEDICAO_DE_USO.md`, `src/tests/uso-busca.test.ts`.

1. **Três estados vazios**, no campo e em `/buscar`:
   * nenhuma palavra útil existe no vocabulário: "A Scrutiniums ainda não cobre '<termo>'." seguido dos seis observatórios, cada um com a pergunta do registro e o link (aberto ou com selo); o texto exato da frase é decisão do dono (seção 7), este é o padrão até ele responder;
   * palavras conhecidas sem destino comum: o resultado parcial do Bloco 1, rotulado;
   * erro de digitação: a correção do Bloco 1.
   Em todos: o link "Ver na página de busca" e, com filtro, "Buscar em toda a plataforma". A página prevista ("ainda sem página") nunca é o único item mostrado: vem acompanhada do observatório e da coleção dela.
2. **Busca local com rótulo** (I4 item 7 do parecer de 23/10/2026): com `filtro`, o campo mostra o rótulo visível "Buscar só em <coleção>"; sem filtro, não há segundo campo na página.
3. **Medição, condicionada à decisão do dono** (seção 7):
   * contar a busca sem resultado feita na barra: uma vez por termo normalizado, depois de 1,5 s sem digitar, com o mesmo `medirBusca` e um campo `evento` ("abriu" ou "sem_resultado") na tabela `uso_busca_dia` (entra na chave primária; migração Drizzle; o painel soma os dois);
   * gravar o texto de termo fora do vocabulário quando passar pelo filtro de dado pessoal já existente (sem `@`, sem cinco algarismos seguidos nem nove no total, até seis palavras e 60 letras), **só com conta**, marcado `fora_do_vocabulario`, apagado após 30 dias (mesma rotina de retenção de `uso_paginas_dia` se houver; se não houver, `DELETE` diário no caminho de escrita);
   * no admin, terceiro quadro "Palavras que o índice não conhece", com o termo e a contagem, separado de "Buscas sem resultado" (combinações conhecidas sem destino);
   * `MEDICAO_DE_USO.md` §8a, §9 e o texto público de privacidade atualizados no mesmo PR.
   Se o dono disser não ao texto: gravar só a quantidade de palavras desconhecidas por busca (0, 1, 2 ou mais), sem texto, e mostrar a distribuição no admin.

Testes do bloco: os três estados renderizam o texto certo para termos de controle; nenhuma requisição de página fechada ao digitar sem sessão (teste existente); `termoParaContagem` com os novos casos; retenção.

### Bloco 5. Um motor só

Arquivos: `src/app/setor-eletrico/page.tsx`, `src/components/energia/BuscaObservatorio.tsx` (apagar), `src/lib/energia/busca.ts` (apagar), `src/lib/energia/aprenda-busca.ts` e `src/components/energia/AprendaIndice.tsx`, `src/lib/busca/buscar.ts` (`OpcoesBusca.tipos`), `src/tests/energia-mapa.test.ts`, `src/tests/energia-aprenda-*.test.ts`.

1. `BuscaObservatorio` sai da entrada do Setor Elétrico; fica o `BuscaPlataforma` com filtro e rótulo visível. Antes de apagar `energia/busca.ts`, conferir que cada regra dele já está em `buscar.ts` (plural, pergunta, sigla, palavra curta, parcial) e mover os casos de `energia-mapa.test.ts` que ainda fazem sentido para `busca-controle.test.ts`.
2. O filtro do Aprenda passa a `BuscaPlataforma variante="pagina" filtro={{ colecao: "setor-eletrico", tipos: ["verbete"] }}`; `OpcoesBusca` ganha `tipos?: TipoEntrada[]`. A versão em inglês do Aprenda não tem o índice (só português): se ela depende de `aprenda-busca.ts`, manter ali um filtro mínimo só para o inglês e registrar o porquê no comentário; se não depende, apagar.
3. Conferir no navegador, logado e deslogado, que `/setor-eletrico` tem um único campo de busca além da barra, com o rótulo do filtro.

## 5. Conjunto de controle

Fica em `src/tests/busca-controle.test.ts` desde o Bloco 1; cada linha diz em que bloco passa a valer (o teste marca as linhas dos blocos futuros como `todo` até lá e as ativa no PR do bloco). Resultado "hoje" medido em 23/10/2026.

| Termo | Hoje | Esperado | Bloco |
|---|---|---|---|
| hospitais | 0 | Saúde entre os três primeiros | 1 |
| enchentes | 0 | Desastres entre os três primeiros | 1 |
| escolas | 6, consulta das capitais | mantém | 1 |
| como funciona o PLD | 0 | igual a "PLD": `/setor-eletrico/pld` primeiro | 1 |
| qual a tarifa social | 0 | igual a "tarifa social" | 1 |
| quanto o governo gasta com educação | 0 | parcial com Educação e "Para onde vai o dinheiro federal, por área?" | 1 |
| por que a conta de luz subiu | 0 | parcial com Conta de luz e Bandeira tarifária | 1 |
| juros do cartão | 0 | parcial com Juros por instituição e Pagamentos | 1 |
| cartão de crédito rotativo | 0 | completo após o Bloco 2: Pagamentos ou Juros por instituição | 1 e 2 |
| ANEEL | Agenda Regulatória da ANEEL | verbete "Agência Nacional de Energia Elétrica" primeiro | 1 |
| CDE | verbete Conta de Desenvolvimento Energético | mantém, inteiro antes de prefixo | 1 |
| saneamneto | 0 | correção para "saneamento", coleção Saneamento primeiro | 1 |
| enegia | 0 | correção para "energia" | 1 |
| divida dos estado | 6 | mantém | 1 |
| Belo Horizonte | Minha capital | mantém; sem parcial de lugar | 1 |
| Amazônia | consulta de bancos | Desmatamento e emissões ou Fogo e queimadas primeiro; banco fora dos três primeiros | 2 |
| pecuária, safra, exportação | consulta de bancos | Agronegócio primeiro | 2 |
| Anatel, 5G, fibra | Conectividade e banco | só Conectividade entre os três primeiros | 2 |
| Banco da Amazônia, Safra, Itaú, Nubank, BB | consulta de bancos | mantém | 2 |
| Celpe, Coelba | 0 | Conta de luz | 2 |
| LOA, SIOP, gasto do governo | 0 | Contas Federais | 2 |
| rotativo | 0 | Pagamentos ou Juros por instituição | 2 |
| dívida pública | 12 | Dívida e crédito dos governos ou Contas Federais primeiro | 2 |
| agências reguladoras | 0 | Regulação (Setor Elétrico e Gás), Marcos regulatórios e verbete ANEEL entre os cinco primeiros | 2 |
| PGFN | 0 | Quem deve à União? | 2 |
| LRF | 0 | Contas Estaduais | 2 |
| salário mínimo | 0 | Renda e trabalho | 2 ou 3 |
| feminicídio | 0 | Segurança pública | 2 ou 3 |
| Pantanal | 0 | Fogo e queimadas | 2 ou 3 |
| tarifa branca | 0 | só se existir verbete ou página; senão, estado "ainda não cobre" | 3 ou 4 |
| Regulação | duas páginas de uma palavra | as duas, cada uma com resumo e via | 3 |
| Importação, Produção, Atlas, Panorama | título só | cada uma com resumo no índice | 3 |
| SNIS, SINISA, Siconfi, CAGED, PNAD, INEP, DataSUS | Siconfi 1; os demais não medidos | a coleção ou página que usa a fonte entre os três primeiros | 3 |
| autonomia financeira | 0 | estado "ainda não cobre", com os seis observatórios | 4 |
| orçamento da ANEEL | 0 | parcial com Contas Federais e verbete ANEEL, ou estado "ainda não cobre" | 1 e 4 |
| ações, transparência | só a página prevista | a prevista acompanhada do observatório e da coleção | 4 |
| xyzabc | 0 | estado "ainda não cobre", sem resultado demonstrativo | 4 |
| saneamento, curtailment, quanto pesa a dívida, inadimplência, GLP, Recife, Pernambuco, Belo Horizonte, Neoenergia Pernambuco, Nubank | os dez de controle | mantêm exatamente o esperado de `busca.test.ts` | todos |

Métrica de aceite do conjunto completo (os 234 termos dos dois lotes, em `docs/ux-2026-10-23/BUSCA_TERMOS_CONTROLE_2026-10-23.md`, reproduzidos no teste como lista): zero resultados em no máximo 10% dos termos ao fim do Bloco 3, e todo termo com zero resultado cai num dos três estados vazios ao fim do Bloco 4.

## 6. Interface: o que a tela ganha e o que não muda

* Ganha: destaque do primeiro resultado; "via <sinônimo>" na meta; rótulo de parcial com as palavras que casaram; "Mostrando resultados para…" e "Você quis dizer…"; estado "ainda não cobre" com os seis observatórios; rótulo visível na busca local.
* Não muda: a posição na barra, a lupa de 44 px e a folha em tela cheia abaixo de 640 px, "/" e Ctrl K, Esc devolvendo o foco, Enter abrindo o primeiro, o selo "com conta", o agrupamento por observatório e coleção, o limite de 30, o formulário GET para `/buscar` sem JavaScript, nenhum pré-carregamento de página fechada sem sessão.
* Estilo: tokens e classes da plataforma (`public/observatorios.css`, `.bp-busca-*`), nada de cor nova, ícone ou animação; a correção e o parcial usam a mesma tipografia de `.bp-busca-estado`.

## 7. Decisões

**Pendentes do dono (não implementar sem resposta):**

1. Gravar texto de termo fora do vocabulário, só com conta, após o filtro de dado pessoal, com retenção de 30 dias e visível só no admin. Recomendação do diagnóstico: sim. Alternativa sem texto descrita no Bloco 4.
2. Contar a busca sem resultado feita na barra (hoje "digitar não conta"). Recomendação: sim, uma vez por termo, após pausa.
3. Linha "versão aberta" sob o primeiro resultado fechado quando o tema tem aperitivo aberto, sem alterar a ordem. Recomendação: sim, uma linha.
4. Texto da frase de cobertura. Padrão proposto: "A Scrutiniums ainda não cobre '<termo>'. Veja o que cada observatório responde:".

**Já decididas (não reabrir):** uma só busca da plataforma e um só índice (Iniciativa 3, 21/10/2026); destinos entram pelo registro e pelos catálogos, nunca à mão; sinônimos num só arquivo; índice só em português; índice sem dado de painel e aberto pelo endereço exato; termos de quem não tem conta medidos só com `USO_ANONIMO_ATIVO=1` (PR da Iniciativa 3); a busca de município é a da consulta de cada tema (Iniciativa 7, fora deste escopo); Enter abre o primeiro resultado; H1 "Encontre o painel" mantido; `/buscar` aberta, fora do sitemap e não indexada.

## 8. Entrega de cada PR

1. `npm run verificar:pr` verde; `node scripts/cobertura-i18n.mjs --check`.
2. `npm run evidencias -- --rotas "/buscar?q=hospitais" "/buscar?q=agências reguladoras" "/buscar?q=saneamneto" /setor-eletrico --saida docs/ux-2026-10-23/busca-pr<N> --larguras 390,1440`, com e sem sessão.
3. No PR: o que melhorou para o leitor em três linhas; tabela antes e depois do conjunto de controle (termos com zero resultado, antes e depois; posição do primeiro resultado esperado); peso do índice antes e depois; testes mudados e por quê; pendências reais.
4. Responder cada thread de revisão automática (Codex, Claude Code Review); corrigir o procedente.
5. Merge só com autorização do dono na conversa. Depois do merge, conferir o deploy no commit do `main` e só então dizer "está no ar", com horário e os links: `/buscar?q=hospitais`, `/buscar?q=agências%20reguladoras`, `/buscar?q=saneamneto`, `/setor-eletrico` (logado), e o que só o dono vê logado (`/app/admin`, seção da busca).

## 9. O que não fazer

* Não indexar o texto inteiro das páginas, nem números, nem séries: o índice segue leve e aberto.
* Não criar segundo índice, segundo motor ou lista de destinos à mão.
* Não ordenar por "aberta" nem esconder destino fechado: o selo "com conta" é a regra.
* Não anunciar cobertura que a página não tem: sinônimo liga a um destino que trata do assunto; o resto cai no estado "ainda não cobre".
* Não instalar biblioteca de busca, fuzzy ou de stemming.
* Não mexer na barra, na folha do celular, nos atalhos nem no selo além do descrito na seção 6.
* Não gravar texto de busca sem a decisão do dono e sem o filtro de dado pessoal.
