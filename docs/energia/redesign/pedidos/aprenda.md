# Pedidos de mudança compartilhada: família Aprenda

Rotas `/setor-eletrico/aprenda` (índice), `/aprenda/trilhas` (índice das trilhas), `/aprenda/trilhas/[trilha]` (duas trilhas) e `/aprenda/[conceito]` (um verbete por conceito, hoje 54). Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia as páginas: elas seguem com a melhor solução local, descrita em cada item. Nenhum verbete conferido teve texto, estado, fonte ou definição alterados.

## 0. Arquivos sem uso, para o coordenador apagar no fim (com o servidor parado)

- Nenhum componente ou teste da família ficou sem uso: `AprendaIndice`, `AprendaPagina`, `AprendaProva`, `AprendaSimulacao` e `AprendaVerbete` seguem importados pelas páginas, e os quatro arquivos `energia-aprenda*.test.ts` rodam.
- `src/tests/zz_tmp_aprenda_exec.test.ts`: rascunho meu da primeira sessão, já neutralizado (um `it.skip` sem leitura nem escrita de arquivo) e ignorado pelo git (`.git/info/exclude`). Pode apagar.

## 1. Componentes e regras compartilhados

1.1 `NavegacaoLocal` e `aria-current`. Em verbete e em trilha (páginas netas), a faixa "Seções do Aprenda" marca Verbetes ou Trilhas com `aria-current="page"`, mas a página aberta é um verbete ou um passo, não a seção. Proposta: `aria-current="true"` para a seção que contém a página e `"page"` só quando a rota é a da própria aba. Arquivo `src/components/energia/NavegacaoLocal.tsx`. Local: a marcação segue como está.

1.2 Pergunta do módulo em `mapa.ts` e `navegacao.ts`. `PAGINAS_MAPA.aprenda.pergunta` e `DESTINOS_NAVEGACAO.aprenda.pergunta` têm 11 palavras, e a regra de título é de 5 a 9. Sugestão: "O que cada conceito significa e onde aparece?" (9 palavras). A página lê de `PAGINAS_MAPA`, e o teste `energia-aprenda.test.ts` exige que o título, o mapa e o menu sejam iguais, então basta mudar os dois arquivos juntos. Local: título igual ao do mapa e do menu, como está.

1.3 `CabecalhoModulo` sem seletor de profundidade. Com `lead` e `recolher={false}`, o bloco "Fontes, datas e siglas" só abre em Auditar, e o Aprenda não tem seletor: o leitor nunca o abre. Local: verbetes e trilhas usam um cabeçalho próprio (`AprendaCabecalho`, mesmas classes de `CabecalhoModulo`) com `LegendaDeSiglas` à vista, derivada do texto visível. Proposta: uma opção de `CabecalhoModulo` (por exemplo `siglasVisiveis`) que mostre a legenda quando `recolher` é falso.

1.4 Busca da inicial. O resultado "Conceito" de `BuscaObservatorio` e de `home.ts` poderia abrir pela pergunta prática do verbete (`perguntaPratica(slug)`, em `conteudo/perguntas-praticas.ts`), antes da sigla, como o índice do Aprenda, e reaproveitar `buscarVerbetes` (`src/lib/energia/aprenda-busca.ts`: função pura, sem importar o acervo; a palavra do termo começa uma palavra do texto, de modo que "ons" acha ONS e não "consumo").

1.5 `SIGLAS` (`src/lib/energia/siglas.ts`) e nomes de órgãos. Dois ajustes que dependem de decisão do coordenador: (a) a Lei nº 15.269, de 24/11/2025, passou a chamar a CCEE de "Câmara de Comercialização de Energia", sem Elétrica (art. 4º-D da Lei nº 10.848); o dicionário, o `Termo` e os verbetes seguem com o nome anterior, o mesmo que a descrição do PLD no portal de dados abertos da CCEE trazia em 27/09/2026; o verbete `ccee` diz isso na primeira limitação. (b) O dicionário chama o IBGE de "Instituto Brasileiro de Geografia e Estatística"; a lei que o rege o chama de "Fundação Instituto Brasileiro de Geografia e Estatística" (nome do verbete `ibge`).

## 2. Pedidos da página inicial ao Aprenda (inicial.md, itens 1 e 8): tratados

Seis verbetes novos, em `src/lib/energia/conteudo/conceitos-instituicoes.ts`, registrados em `conceitos-modulos.ts`. Cada um tem definição só do que a fonte diz, trecho literal e paráfrase, o que não foi lido dito em palavras comuns, pergunta prática, contraste ("Não confundir com"), exemplo real com ficha "Comprove este número" e painel de origem. Os trechos estão nas capturas versionadas de 09/10/2026 (`pipeline/energia/seed/documentos_aprenda/v20261009T103148Z`, com o sha256 do original e do texto no `MANIFESTO.json`); o teste confere cada trecho nelas.

| Verbete (slug) | Tema | Fonte primária lida | O que não foi lido |
| --- | --- | --- | --- |
| ANEEL (`aneel`) | Regulação | Lei nº 9.427/1996, arts. 1º, 2º e 3º (Planalto) | estrutura interna e regimento |
| ONS (`ons`) | Operação | Lei nº 9.648/1998, art. 13; Decreto nº 5.081/2004, art. 3º; página O que é ONS | estatuto social e Procedimentos de Rede |
| CCEE (`ccee`) | Mercado | Lei nº 10.848/2004, arts. 4º e 4º-D; Lei nº 15.269/2025, art. 24 | estatuto, Convenção e Regras de Comercialização; o portal da CCEE respondeu 403 e não foi contornado |
| EPE (`epe`) | Expansão | Lei nº 10.847/2004, arts. 1º, 2º e 4º | estatuto e planos (PDE) |
| IBGE (`ibge`) | Fontes de dados | Lei nº 5.878/1973, arts. 1º a 3º | estatuto vigente; site do IBGE |
| Sistemas Isolados (`sistemas-isolados`) | Operação | Decreto nº 7.246/2010, art. 2º, III; Lei nº 9.648, art. 13, alínea g; páginas do ONS O Sistema Interligado Nacional e Sistemas Isolados | atos da ANEEL sobre os sistemas isolados |

Uso na inicial (item 1): trocar o texto simples da linha de fontes por `Termo` com os slugs `ons`, `ccee`, `aneel`, `epe` e `ibge`; a dica mostra `emUmaFrase`.

Item 8 (escopo do SIN e dos sistemas isolados): o escopo está conferido no verbete novo `sistemas-isolados`, em vez de alterar o `sin` (conteúdo conferido). Pela página do ONS, o SIN é constituído por quatro subsistemas: Sul, Sudeste/Centro-Oeste, Nordeste e a maior parte da região Norte; pelo decreto, Sistemas Isolados são os sistemas de distribuição que, em sua configuração normal, não estão conectados ao SIN, por razões técnicas ou econômicas; pela lei, desde 1º de maio de 2017 o ONS faz a previsão de carga e o planejamento da operação deles. Para o mapa (nota em "Rede" ou em "O que o mapa não diz"), use `Termo` com `sistemas-isolados`. O verbete `sin` aparece com o contraste "Sistemas Isolados" em "Não confundir com", sem ter sido alterado; o dono do `sin` pode trocar a limitação dele por um apontamento ao novo verbete.

## 3. Achados de conteúdo e de dado vistos e não corrigidos

- Página do ONS "Sistemas Isolados" (sem data de publicação): fala em 212 localidades isoladas e em Boa Vista como única capital atendida por sistema isolado. O painel de Inclusão energética, com o PASI da EPE, traz a contagem do ciclo mais recente (160 localidades no ciclo 2025, na gold). Os dois números não se comparam sem data e critério; o verbete cita a página como está, diz que não tem data de referência e não usa nenhum dos dois como dado.
- Nome da CCEE: a lei já a renomeou (item 1.5), e as fontes de dados que o observatório lê ainda usam o nome anterior.
- `src/lib/energia/conteudo/conceitos.ts`, verbete `sin`: a limitação "A abrangência física do SIN (quais sistemas isolados ficam de fora) não foi conferida em documento do ONS" continua, e agora tem resposta no verbete `sistemas-isolados`.
- Texto conferido com palavra que o guia evita, não alterado por ser conteúdo de fonte ou de outro módulo: `evidencias-verbetes.ts` linha 386 ("porque o ONS revisa os valores publicados", no complemento do exemplo da EAR); `conceitos-geracao.ts` linha 96 ("porque o endereço oficial da ANEEL responde 403", numa limitação); `trilhas.ts` linhas 220 e 242 ("regras atuais" no lugar de uma data); `conceitos-agua.ts` linha 142 ("representaria melhor", em paráfrase de fonte).
- O Planalto recusa o cliente sem User-Agent de navegador (a captura de 06/10/2026 funcionou com o do projeto); o manifesto de 09/10/2026 registra o canal.

## 4. Pedidos de outras famílias ao Aprenda, não tratados aqui

Lidos nos arquivos de pedidos das outras famílias; todos exigem fonte primária que não foi lida, e nenhum estava na tarefa do Aprenda.

- Geração, item 7: verbetes de despacho, ordem de mérito, inflexibilidade, razão elétrica e fator de capacidade (constrained-off e CVU já existem).
- Inclusão: Cadastro Único, MI Social, POF, PNAD e PASI. O verbete `ibge` define a fundação, não as pesquisas.
- PLD, item 1: expansão das siglas DECOMP, DESSEM e NEWAVE (o manual do CEPEL não foi lido).
- Perdas, item 6 (texto "decorre principalmente de" em `conceitos-perdas.ts`) e Carga e Rede, item 1.8 (rótulo em `conceitos-rede.ts`): texto de verbete conferido, do dono do conteúdo.

## 5. Equivalências para a matriz de preservação

`docs/energia/redesign/pedidos/aprenda.equivalencias.json`: uma linha, `controle|procurar um termo` para `controle|o que você quer entender?` em `/setor-eletrico/aprenda` (o mesmo campo de busca, com rótulo em forma de pergunta, recorte na URL e busca mais ampla). Com ela, o rastreador mecânico (`energia-visoes.mjs` e `energia_visoes_compara.py`, 12 rotas e 29 visões) fecha com 0 itens a justificar: os 3 controles da trilha Água, operação e preço e os 4 da trilha Custo, tarifa e orçamento seguem iguais, e as fichas "Comprove este número" seguem em 5 por trilha e 1 por verbete, nos três níveis.

## 6. Pendências

- `docs/observatorios/energia/modulos/aprenda.md` (fora da lista de arquivos da família) descreve a interface anterior: ordem dos campos do verbete, índice com grupos recolhidos, "Veja no painel" no fim, contagem de verbetes (agora 54) e os novos verbetes. Vale atualizar quando o coordenador fechar o módulo.
- A legenda "Órgãos" da inicial também cita CVM, MCTI e CADE, e o MME aparece em vários verbetes: seguem sem verbete. O método é o mesmo (lei ou decreto no Planalto, mais a página institucional), se o coordenador pedir.
- As medidas da primeira tela de cada página estão no relatório de entrega.
