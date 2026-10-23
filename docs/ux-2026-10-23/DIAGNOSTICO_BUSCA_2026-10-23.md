# Diagnóstico da busca da plataforma

Data: 23/10/2026. Base: `main` em `00c055474`. Gatilho: retorno de uma leitora externa em 23/10/2026 ("Busca ainda difícil", "Palavras chave ajudam pouco"), depois de procurar material sobre autonomia financeira das agências reguladoras e a base orçamentária da ANEEL. Prompt de implantação derivado deste diagnóstico: `docs/ux-2026-10-23/PROMPT_BUSCA_2026-10-23.md`.

Convenção: **E** evidência (observada no código, no índice gerado ou nos documentos), **I** inferência, **R** recomendação.

### 0. Resumo

A busca unificada (Iniciativa 3 do parecer de UX de 21/10/2026, em produção desde 22/10/2026) acerta a arquitetura: um índice, um componente, uma página `/buscar`, destinos que entram pelo registro. O que falha é o que está dentro dela: a correspondência exige que toda palavra digitada comece uma palavra do destino, sem plural, sem palavra de pergunta, sem tolerância a erro e sem resultado parcial; o índice conhece bem só o Setor Elétrico (as outras coleções entram quase só pelo título da página); seis grupos de sinônimos não alcançam destino nenhum e a expansão de sinônimos sobre as listas de nomes de bancos e distribuidoras faz "Amazônia", "pecuária", "safra" e "Anatel" levarem a "Quanto o meu banco cobra de juros?"; a medição descarta justamente o vocabulário que a plataforma não conhece, então o painel de admin não pode mostrar o que a leitora digitou; e o estado vazio não distingue "não entendi a palavra" de "a plataforma não cobre este tema". A busca antiga do Setor Elétrico, ainda montada na entrada da coleção, tinha plural, palavras de pergunta, sigla inteira e resultado parcial: a unificação regrediu nesses quatro pontos.

Em dois lotes de controle rodados nesta sessão sobre o índice real (234 termos leigos e técnicos, 23/10/2026), 79 não devolveram nada. Entre eles: "agências reguladoras", "hospitais", "enchentes", "como funciona o PLD", "qual a tarifa social", "cartão de crédito rotativo", "juros do cartão", "quanto o governo gasta com educação", "PGFN", "salário mínimo", "saneamneto" e "enegia".

### 1. O que foi examinado e o que não foi

**Examinado.** Código de `src/lib/busca` (índice, correspondência, normalização, sinônimos, medição), `src/components/busca`, `src/app/buscar`, `src/app/api/uso/busca`, `src/lib/uso/busca.ts` e `painel.ts`, `src/components/admin/UsoBusca.tsx`; o motor legado `src/lib/energia/busca.ts` e `aprenda-busca.ts`; os testes `busca.test.ts`, `busca-indice.test.ts`, `busca-barra-browser.test.ts`, `uso-busca.test.ts`; `docs/observatorios/MEDICAO_DE_USO.md` §8a e §9; `docs/ux-2026-10-23/PARECER_UX_2026-10-23.md` (A7, A12, I3, I4 item 7, M1); `docs/AVALIACAO_PAINEIS_2026-09.md` §5; o anexo `anexos/busca.md` da skill. O índice foi gerado nesta sessão com `indiceDeBusca()` e as consultas rodaram com `buscar()`, o mesmo código do servidor e do navegador.

**Não acessado, declarado.** A tabela de produção `uso_busca_dia` (não há `DATABASE_URL` neste contêiner): nenhum número de uso real aparece aqui. O que a leitora digitou: o retorno dela é qualitativo; os termos de controle são inferência a partir do assunto que ela dizia pesquisar. A página no navegador em produção: a análise de interface foi feita sobre o código e o CSS, não sobre captura.

### 2. Como a busca funciona hoje

* **Índice** (`src/lib/busca/indice.ts`, servido em `/busca/indice.json`, estático, aberto sem conta, baixado no primeiro foco). Gerado nesta sessão: 348 entradas (27 consultas pessoais, 6 observatórios, 28 coleções, 108 páginas, 21 métodos, 45 perguntas, 113 verbetes), 137 KB antes da compressão (teto do teste: 150 KB), vocabulário de 1.535 palavras distintas, listas de lugares com 26 capitais, 27 UFs, 176 nomes de distribuidoras e 194 nomes de bancos.
* **Correspondência** (`src/lib/busca/buscar.ts`): normaliza (minúsculas, sem acento, sem pontuação), tira 22 palavras vazias, e exige que **cada** palavra digitada seja **começo** de alguma palavra do destino. Quatro níveis: título igual; todas no título; todas em título mais termos; todas em título, termos, resumo e nomes de coleção e observatório. Desempate por situação, tipo, tamanho do título e ordem alfabética. Até 30 resultados.
* **Sinônimos** (`src/lib/busca/sinonimos.json`, 58 grupos): um grupo é anexado a todo destino cujo título ou termos contenham qualquer expressão do grupo; o mesmo mecanismo é aplicado às listas de lugares inteiras.
* **Medição** (`src/lib/uso/busca.ts`): conta 1 quando um resultado é aberto pelo campo ou quando `/buscar` abre com termo; digitar não conta. Grava o texto só quando cada palavra começa uma palavra do vocabulário do índice; o resto soma em `#fora-do-indice` sem texto. Decisão registrada no PR da Iniciativa 3 e no commit `a702bd12a` de 22/10/2026.
* **Interface** (`BuscaPlataforma`, `ListaResultados`, `/buscar`): combobox acessível, folha em tela cheia abaixo de 640 px, atalhos "/" e Ctrl K, selo "com conta" nos destinos fechados, agrupamento por observatório e coleção, estado vazio com "Nenhum resultado para X. Veja as coleções."

### 3. Achados

#### A1. A correspondência é frágil demais para quem escreve como fala

**E.** `buscar.ts` casa só por começo de palavra, no sentido destino começa com o digitado. "hospitais" não acha "hospital" (0 resultados); "enchentes" não acha "enchente" (0); "agências reguladoras" não acha o verbete "Agência Nacional de Energia Elétrica" nem a página "Marcos regulatórios" (0). Palavras de pergunta não são removidas: "como funciona o PLD" dá 0 e "o que é PLD" dá 8, porque "o", "que" e "é" são vazias e "como" e "funciona" não. "qual a tarifa social" dá 0; "por que a conta de luz subiu" dá 0; "quanto o governo gasta com educação" dá 0. Erro de digitação zera: "saneamneto" e "enegia" dão 0. Frase com mais de duas palavras úteis sem um destino que tenha todas dá 0, sem resultado parcial: "cartão de crédito rotativo" e "juros do cartão" dão 0, embora exista a página "Juros por instituição" e a coleção "Pagamentos" com o termo "cartão". A busca antiga do Setor Elétrico (`src/lib/energia/busca.ts`, cabeçalho e funções `normalizarBusca`, `formasDe`, `PERGUNTA`, `casa`) trata plural em "ões/ães" e em "s", remove cerca de 26 palavras de pergunta em português (e as inglesas), dá peso extra à sigla digitada inteira, exige palavra inteira para termos de até três letras e devolve resultado parcial rotulado quando nenhum destino tem todas as palavras.

**I.** A leitora diz que "palavras chave ajudam pouco" porque a busca só funciona quando a palavra está exatamente como o catálogo escreveu, no singular, sem erro e sem frase em volta. A unificação de 22/10/2026 trocou um motor com quatro recursos de tolerância por um motor mais simples e não trouxe os recursos junto; só o vocabulário (`busca-sinonimos.ts`) foi migrado.

**R.** Trazer para `buscar.ts` as regras do motor legado (plural, palavras de pergunta, sigla inteira, palavra curta inteira, resultado parcial rotulado) e acrescentar tolerância a um erro de digitação para palavras de cinco letras ou mais, resolvida contra o vocabulário do índice (1.535 palavras, barato no navegador). Aposentar o motor legado depois.

#### A2. O índice conhece bem só o Setor Elétrico

**E.** Das 108 páginas do índice, 87 não têm resumo e 67 não têm termos; 63 não têm nem um nem outro, e entram na busca apenas pelo título. Quinze dessas têm título de uma palavra ("Tarifa", "Regulação", "Importação", "Produção", "Panorama", "Atlas", "Síntese", "Aprenda", "Estados", "Cenários"). Por coleção, páginas com resumo: Setor Elétrico 15 de 15; Contas Federais 4 de 8; Proteção social 1 de 4; Custo de vida 1 de 4; todas as outras 0 (Crédito 0 de 24, Saneamento 0 de 14, Agro 0 de 16, Gás 0 de 8). O Setor Elétrico é a única coleção com catálogo de página que traz pergunta e resumo (`DESTINOS_NAVEGACAO`); as demais entram pelo inventário, que só tem título e rota. Existem 192 `page.tsx` com `metadata.description` escrita (de 365 rotas), e nenhuma é lida pelo índice. Os termos por coleção (`TERMOS` em `src/lib/observatorios/inventario.ts`) são 28 linhas de 4 a 12 palavras, uma por coleção, não por página.

**I.** Fora do Setor Elétrico, a busca é uma lista de títulos. Quem procura pelo assunto de dentro da página (uma fonte, uma sigla, a pergunta que a página responde) não encontra, porque nada disso está no índice. É a causa estrutural de "palavras chave ajudam pouco": a palavra chave certa não está lá para ser achada.

**R.** Toda página publicada passa a ter, no catálogo do seu domínio, uma pergunta ou resumo de uma frase e termos (siglas, fontes, vocabulário leigo), nunca em `src/lib/busca`. Primeiro preenchimento a partir das `metadata.description` existentes e dos leads das páginas. Teste de catraca: a lista das 63 páginas sem resumo nem termos é fixada hoje e só pode encolher.

#### A3. Sinônimos: seis grupos mortos e listas de nomes poluídas

**E.** Dos 58 grupos de `sinonimos.json`, 6 não casam com título nem termos de nenhum destino e portanto nunca agem: "cartão de crédito", "orçamento federal", "dívida pública", "Nubank", "Banco do Brasil", "Itaú". Por isso "LOA", "SIOP" e "gasto do governo" (grupo "orçamento federal") dão 0 embora existam as Contas Federais; "rotativo" dá 0. A expansão de grupos é aplicada também às listas de lugares: como os 194 nomes de bancos contêm "Safra", "Amazônia", "Fibra", "Pagamentos" e "Agro", os grupos inteiros "agronegócio", "desmatamento", "internet" e "Pix" foram anexados à consulta "Quanto o meu banco cobra de juros?". Resultado: "Amazônia", "pecuária", "safra", "exportação", "Anatel" e "5G" trazem essa consulta em primeiro ou entre os primeiros, acima do Agro, do Território e da Conectividade. O mesmo ocorre com as 176 distribuidoras, que receberam os grupos "conta de luz" e "geração".

**I.** A regra "o grupo entra onde já há uma palavra dele" é boa para destinos e errada para listas de nomes próprios, onde qualquer palavra comum dentro de uma razão social dispara o grupo inteiro. Os grupos mortos mostram que o arquivo foi escrito pensando no que o leitor digita, sem conferir se o destino tem o gancho.

**R.** Expansão temática só sobre título e termos do destino; nas listas de lugares, só os grupos de nomes próprios (seção própria no arquivo). Teste que reprova grupo sem destino e teste que reprova palavra temática dentro das listas de lugares. Ligar os seis grupos mortos aos destinos certos pelos termos dos catálogos.

#### A4. O laço de melhoria está cego para o que falta

**E.** `termoParaContagem` grava o texto só quando toda palavra começa uma palavra do vocabulário do índice. Um termo com palavra nova (justamente a que falta no índice) vira `#fora-do-indice`, sem texto. `MEDICAO_DE_USO.md` §8a e §9 e o próprio `sinonimos.json` dizem que o quadro "Buscas sem resultado" do admin alimenta a lista de sinônimos; esse quadro só pode listar combinações de palavras já conhecidas que o índice de hoje não acha. Além disso, digitar na barra e desistir não conta: a medição exige abrir um resultado ou carregar `/buscar` com termo. Quem digita "agências reguladoras" na barra, vê "Nenhum resultado" e fecha, não deixa rastro; quem aperta Enter cai em `/buscar`, conta, e o texto é descartado por estar fora do vocabulário.

**I.** O caso que mais importa para melhorar a busca (vocabulário que a plataforma não tem) é o único que o sistema não registra. O painel confirma o que já funciona e não vê o que falta.

**R.** Duas mudanças, ambas dependentes de decisão do dono porque tocam a regra de privacidade registrada em 22/10/2026: contar a busca sem resultado na barra (termo normalizado, depois de uma pausa na digitação, uma vez por termo) e gravar o texto de termo fora do vocabulário quando passar pelo filtro de dado pessoal já existente (sem `@`, sem cinco algarismos seguidos, até seis palavras e 60 letras), só para quem tem conta, com retenção de 30 dias e visível apenas no admin, num quadro separado "Palavras que o índice não conhece". Se o dono preferir não gravar texto novo, alternativa sem texto: gravar só a quantidade de palavras desconhecidas por busca, o que ao menos mede o tamanho do problema.

#### A5. O estado vazio não oferece saída nem diz a verdade sobre a cobertura

**E.** Na barra, sem resultado, o painel mostra "Nenhum resultado para X. Veja as coleções." Em `/buscar`: "Tente outra palavra, o nome de uma fonte (ONS, IBGE, ANP) ou veja as coleções." Não há resultado aproximado, não há sugestão de termo próximo, não há lista dos temas cobertos. A plataforma não tem página sobre orçamento ou autonomia de agências reguladoras (cinco arquivos citam a expressão "agência reguladora" como contexto institucional: a entrada da Energia, a viabilidade e o aperitivo do Saneamento, textos da Conta de luz e as opções de perfil do cadastro; o mais próximo são o verbete da ANEEL, as páginas "Regulação" do Setor Elétrico e do Gás e "Marcos regulatórios" do Crédito). Para essa leitora, a resposta honesta era "a Scrutiniums não cobre este tema; o mais próximo é isto", e a busca não tem como dizê-la.

**I.** Um estado vazio igual para "palavra desconhecida", "combinação sem destino" e "tema não coberto" faz a leitora atribuir à busca o que é limite de cobertura, e vice versa. Fere a regra da plataforma de não anunciar o que não existe e de tratar ausência como estado próprio.

**R.** Três estados vazios distintos: (1) nenhuma palavra conhecida: "A Scrutiniums ainda não cobre <termo>" mais os seis observatórios com a pergunta de cada um; (2) palavras conhecidas sem destino comum: resultado parcial rotulado, com o que casou destacado; (3) erro de digitação: "Você quis dizer <palavra>?" com a correção aplicada em um toque. Em todos, o link para `/buscar` e para a coleção mais próxima.

#### A6. Três motores de busca e a regressão frente ao legado

**E.** Convivem `src/lib/busca/buscar.ts` (plataforma), `src/lib/energia/busca.ts` (legado, 209 linhas, ainda montado em `/setor-eletrico` pelo `BuscaObservatorio`, logo abaixo de um `BuscaPlataforma` com filtro; é a "segunda busca" do achado A12 do parecer de 23/10/2026) e `src/lib/energia/aprenda-busca.ts` (filtro de verbetes do Aprenda). Três normalizações e três ordenações diferentes. O comentário de cabeçalho de `indice.ts` cita `scripts/busca-indice.mjs`, que não existe (o índice é servido por rota `force-static`).

**I.** A regra do anexo `busca.md` ("não criar outra busca de páginas") está cumprida só em parte: o legado não foi removido, e é nele que está a melhor lógica.

**R.** Um motor só. O `BuscaObservatorio` sai da entrada do Setor Elétrico (fica o campo local com rótulo de filtro visível, como pede o I4 item 7 do parecer); o filtro do Aprenda passa a usar `BuscaPlataforma` com filtro por coleção e tipo verbete. Corrigir o comentário de `indice.ts`.

#### A7. Percepção: mais da metade dos destinos é fechada, e o leitor sem conta vê cadeados

**E.** Das 344 entradas com endereço, 191 são fechadas (`aberta: false`), 55%. Sem sessão, a lista de resultados mostra o selo "com conta" nesses destinos, por regra do dono (anexo `acesso.md`). O índice não leva municípios (Iniciativa 7, pendente, I3 do parecer de 23/10/2026).

**I.** Não é defeito da busca, mas pesa na sensação de "difícil": a maioria dos acertos leva a uma porta fechada para quem chega de fora. O princípio do aperitivo garante uma página aberta por tema; a busca hoje não a privilegia nem a aponta ao lado do resultado fechado.

**R.** Decisão do dono: quando o primeiro resultado é fechado e o tema tem aperitivo aberto, mostrar uma linha "versão aberta" sob o resultado, sem alterar a ordem. Municípios na busca seguem o I3 do parecer de 23/10/2026, fora deste escopo.

### 4. O caso que gerou o retorno

A leitora pesquisava autonomia financeira das agências reguladoras entre 2016 e 2026 e disse que "a base da ANEEL não pode ser aberta". Termos prováveis, todos com 0 resultados no índice de hoje: "agência reguladora", "agências reguladoras", "autonomia financeira", "orçamento da ANEEL", "taxa de fiscalização", "TFSEE", "contingenciamento", "receita própria", "LOA", "SIOP". "ANEEL" sozinho devolve 11 resultados, com o verbete "Agenda Regulatória da ANEEL" antes do verbete da própria agência, porque a sigla no título vale mais que a sigla nos termos.

O que a plataforma tem sobre o tema: o verbete "Agência Nacional de Energia Elétrica" (Aprenda), as páginas "Regulação" do Setor Elétrico e do Gás Natural, "Marcos regulatórios" do Crédito e, nas Contas Federais, a execução do orçamento e a despesa por área, sem página sobre agências. Não há série de receita própria, taxa de fiscalização ou contingenciamento de agências. A busca ideal teria respondido em uma linha que o tema não é coberto e oferecido esses quatro destinos. A busca de hoje respondeu "Nenhum resultado".

### 5. Ordem recomendada

1. Motor: plural, palavras de pergunta, sigla inteira, palavra curta inteira, resultado parcial, um erro de digitação, "via sinônimo" visível. Maior ganho por linha de código; só `buscar.ts`, `normalizar.ts`, `ListaResultados` e testes.
2. Sinônimos: expansão só sobre destinos, nomes próprios em seção própria, seis grupos mortos ligados, dois testes novos. Pequeno e corrige um erro visível ("Amazônia" no banco).
3. Índice: pergunta ou resumo e termos por página nos catálogos de cada domínio, catraca de 63 para 0. É o trabalho maior e o que muda a experiência fora do Setor Elétrico.
4. Estado vazio e medição: três estados, contagem da busca sem resultado e vocabulário novo no admin, conforme a decisão do dono.
5. Um motor só: remover o legado e o segundo campo da entrada do Setor Elétrico.

Decisões pendentes do dono, sem as quais os itens 4 e A7 não se implementam: gravar texto de termo fora do vocabulário (com os limites propostos em A4); contar busca sem resultado na barra; linha "versão aberta" sob resultado fechado; texto da frase de cobertura ("A Scrutiniums ainda não cobre…").

### 6. Evidência: lotes de controle

Rodados em 23/10/2026 sobre o índice gerado do `main` em `00c055474`, com `buscar()`. Lote 1: 133 termos, 53 sem resultado. Lote 2: 101 termos, 26 sem resultado. Seleção abaixo; a lista completa, com o primeiro resultado de cada termo, está em `docs/ux-2026-10-23/BUSCA_TERMOS_CONTROLE_2026-10-23.md`.

| Termo digitado | Resultados | Primeiro resultado hoje | O que deveria acontecer |
|---|---|---|---|
| agências reguladoras | 0 | nenhum | verbete ANEEL, Regulação (Setor Elétrico, Gás), Marcos regulatórios, com aviso de cobertura |
| autonomia financeira | 0 | nenhum | "ainda não cobre", com os seis observatórios |
| hospitais | 0 | nenhum | plural de "hospital": Saúde |
| enchentes | 0 | nenhum | plural de "enchente": Desastres |
| como funciona o PLD | 0 | nenhum | igual a "PLD" |
| qual a tarifa social | 0 | nenhum | igual a "tarifa social" |
| por que a conta de luz subiu | 0 | nenhum | parcial: Conta de luz, Bandeira tarifária |
| quanto o governo gasta com educação | 0 | nenhum | parcial: Educação, Para onde vai o dinheiro federal, por área? |
| cartão de crédito rotativo | 0 | nenhum | Juros por instituição, Pagamentos |
| juros do cartão | 0 | nenhum | Juros por instituição |
| LOA, SIOP, gasto do governo | 0 | nenhum | Contas Federais (grupo "orçamento federal" está morto) |
| rotativo | 0 | nenhum | grupo "cartão de crédito" está morto |
| PGFN | 0 | nenhum | Quem deve à União? (falta a sigla nos termos) |
| salário mínimo | 0 | nenhum | Renda e trabalho (falta termo) |
| saneamneto | 0 | nenhum | "Você quis dizer saneamento?" |
| enegia | 0 | nenhum | "Você quis dizer energia?" |
| Celpe | 0 | nenhum | Conta de luz (nome popular da Neoenergia Pernambuco) |
| Amazônia | 5 | Quanto o meu banco cobra de juros? | Desmatamento e emissões, Fogo e queimadas |
| pecuária | 8 | Quanto o meu banco cobra de juros? | Agronegócio |
| safra, exportação | 8 | Quanto o meu banco cobra de juros? | Agronegócio |
| Anatel | 3 | Como é a internet na minha cidade? e a consulta de bancos em segundo | só Conectividade |
| ANEEL | 11 | Agenda Regulatória da ANEEL | o verbete da ANEEL em primeiro |
| ações, transparência | 1 | "Avaliação e transparência", ainda sem página | página prevista não deve ser o único resultado sem alternativa |
| Inter | 20 | Como é a internet na minha cidade? | Banco Inter visível entre os primeiros |
| o que é PLD | 8 | Preço de curto prazo (PLD) | correto |
| conta de luz | 8 | Conta de luz | correto |
| Recife, Belo Horizonte, Pernambuco | 11, 1, 7 | consultas do lugar | correto |
| Nubank, Itaú, Bradesco, Cemig, Light | 1 | consulta do banco ou da conta de luz | correto |
