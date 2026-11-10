# Paridade dos painéis das Famílias reescritos em Next

Decisão do dono de 10/11/2026 (recomendação 5 do parecer estrutural). Uma seção por painel, escrita pelo agente que fez a reescrita a partir da leitura da vista antiga em `public/obs/app.js`. O estado de cada endereço antigo é o campo `redirecionar` de `src/lib/observatorios/paineis-reescritos.json` (tipado por `reescritos.ts`).

## Estado dos endereços antigos (decisão do dono de 10/11/2026)

O dono decidiu redirecionar já, de forma permanente, as seis vistas cujo painel novo não tem perda declarada nesta página, e manter as três com perda até os mapas serem migrados. No mesmo dia, 10/11/2026, a perda declarada das três foi fechada (seção "Fechamento da paridade", logo abaixo) e as três foram redirecionadas: nenhuma vista antiga das Famílias fica no endereço antigo.

| Vista antiga | Página nova | Estado | Motivo |
|---|---|---|---|
| `/observatorio/desenrola` | `/divida-das-familias/desenrola` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/bets-financial-risk` | `/divida-das-familias/apostas` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/financial-fraud` | `/divida-das-familias/golpes-e-fraudes` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/lawsuits` | `/divida-das-familias/clientes-contra-bancos` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/debt-collection-lawsuits` | `/divida-das-familias/bancos-cobrando-na-justica` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/conduct-enforcement` | `/divida-das-familias/sancoes-e-reclamacoes` | Redirecionada (308) | Sem perda declarada |
| `/observatorio/payroll-lending-aging` | `/divida-das-familias/consignado` | Redirecionada (308) em 10/11/2026 | Perda fechada: o recorte do mapa municipal vai para a URL, a dispersão por UF voltou a ter o tamanho do círculo e o seletor de estado, a pirâmide voltou a realçar 60 anos ou mais |
| `/observatorio/housing-credit` | `/credito-imobiliario` | Redirecionada (308) em 10/11/2026 | Perda fechada: o mapa municipal (5.570 municípios, quatro medidas) foi migrado |
| `/observatorio/formal-employment` | `/emprego-formal` | Redirecionada (308) em 10/11/2026 | Perda fechada: os pesos do Risco setorial (0,56 / 0,25 / 0,19, originais 0,45 / 0,20 / 0,15) são lidos da gold do Risco setorial, `sectors.json`, onde estão publicados |

## Fechamento da paridade das três últimas (10/11/2026)

| Painel | Perda declarada | Como foi fechada | Onde está no código |
|---|---|---|---|
| Consignado | Estado do filtro do mapa municipal fora da URL | Medida, região e confiabilidade ficam no endereço, com os mesmos nomes de parâmetro da vista antiga (`?cgcam=`, `?cgregiao=`, `?cgconf=`): o link antigo, que o redirecionamento repassa com a consulta, reabre o mesmo recorte. Os municípios do perfil também (`?cgmun=`, até cinco). Com recorte no endereço, o explorador carrega sem esperar o botão. Parâmetro inválido vale o padrão | `ExploradorMunicipios.tsx` (`useEstadoUrl`) |
| Consignado | Dispersão por UF sem o tamanho do círculo | A área do círculo acompanha a população de 60 anos ou mais (a mesma medida da vista antiga). O kit ganhou a terceira medida opcional (`tamanho`), com legenda de dois tamanhos de referência, linha na dica, leitura e coluna na tabela. A vista antiga fazia o raio crescer com a raiz do valor a partir de 4 px; a nova faz a área crescer com o valor, entre 3 e 14 px de raio (10 no celular) | `GraficoDispersao.tsx`, `raioPorArea` em `src/lib/painel/dispersao.ts` |
| Consignado | Dispersão sem o seletor "Consultar estado" | Seletor nativo acima do gráfico: o estado escolhido ganha destaque com o nome, a leitura das três medidas por extenso e fica no endereço (`?cguf=`) | `DispersaoEstados.tsx` |
| Consignado | Pirâmide sem o realce de 60 anos ou mais | Os grupos a partir de 60 anos formam uma série própria ("60 anos ou mais"), com legenda; os demais ficam em "Até 59 anos". Cada grupo tem valor numa série só | `page.tsx`, figura `#idade` |
| Crédito imobiliário | Mapa municipal não migrado | Mapa coroplético da plataforma sobre a malha oficial do IBGE (`/energia/geo/municipios.json`), nas quatro medidas, com filtro de região, clique que abre o perfil, busca por nome e teclado. Medida e região ficam no endereço (`?medida=`, `?regiao=`), junto do `?municipio=` que já existia | `ConsultaMunicipal.tsx`, `MapaMunicipios.tsx` |
| Emprego formal | Pesos do score setorial fora da página | Tabela "Quanto cada componente pesa no Risco setorial" na figura `#risco-setorial`, lida de `public/obs/data/gold/sectors.json` (campo `componentes.<id>.peso` de cada atividade) e a frase do método dessa gold, que traz os pesos originais. Nada é recalculado; se a gold faltar ou as atividades divergirem, a página diz que não pôde ler e não mostra peso algum | `pesosRiscoSetorial` em `src/lib/familias/emprego-formal.ts` |

Mudanças deliberadas neste fechamento, sem perda de conteúdo:

- **Classes no lugar do sombreado contínuo.** Os dois mapas municipais (consignado e crédito imobiliário) passam a usar cinco classes por quantis, com o método escrito na legenda e a contagem de municípios em cada classe, no lugar do sombreado contínuo entre os percentis 5 e 95 das vistas antigas. Município sem a medida aparece em hachura e contado como "sem dado", nunca como zero.
- **"Não se aplica" tem cor própria.** No consignado, com o filtro "sem confiabilidade baixa", os municípios de confiabilidade baixa ficam no mapa em cinza liso, contados à parte (antes ficavam na cor do fundo). No crédito imobiliário, na lacuna de penetração, cinza liso é o município na mediana do grupo comparável ou acima dela (sem lacuna estimada) e hachura é o grupo pequeno demais para estimar.
- **Uma malha só.** O consignado deixa de ler `penetracao_malha.json` e `/obs/geo/uf.json`: os dois mapas usam a malha municipal oficial que a plataforma já publica, com as divisas de UF.
- **Pesos com três casas na gold, duas na página.** A gold setorial traz 0,5625, 0,25 e 0,1875; a página mostra 0,56, 0,25 e 0,19, como a vista antiga e o método da gold escrevem. O peso original de 0,15 que a vista antiga citava está na frase do método, reproduzida entre aspas.

O que não foi feito, de propósito:

- O código das três vistas (`renderConsignado`, `renderMoradia`, `renderEmprego`) continua em `public/obs/app.js`, sem caminho que o alcance. A única edição nesse arquivo foi trocar o link escrito à mão para `/observatorio/formal-employment`, no painel Risco setorial, por `linkDaVista("emprego")`, que entrega a página nova.
- As siglas das 27 UFs dentro da dispersão (a vista antiga escrevia todas, com linha-guia). O kit escreve o nome só no estado consultado e na dica; a tabela equivalente traz todos.
- Os dois números escritos à mão em "Por que a amostra é restrita" do crédito imobiliário (desvio de 1,45 e lacuna de R$ 2,5 trilhões) continuam fora: não estão na gold. Não constavam da perda declarada na tabela de estado.

Testes de navegador que abriam as vistas antigas e tiveram asserções aposentadas, com o motivo escrito no próprio arquivo: `pix-ux-browser` (metade do consignado em três testes), `credito-residual-browser` (rota em duas listas e a rolagem das tabelas de `#cg-circ`), `credito-historico-browser` (rota na lista), `credito-leitura-browser` (dois testes do consignado), `graficos-identificacao-browser` (rota na lista, pirâmide e dispersão, três testes da tabela municipal), `rankings-municipais-reflow-browser` (consignado e moradia), `consignado-dispersao-browser` (siglas da dispersão) e `consignado-mapa-teclado-browser` (reescrito para a página nova). As garantias equivalentes na página nova estão em `src/tests/familias-paridade-browser.test.ts` e em `src/tests/familias-consignado.test.ts`. O que esses testes mediam e a página nova não tem teste próprio: texto de 12 px em todo SVG com a fonte do sistema dobrada (32 px) e o reflow das listas dos 25 maiores nessa fonte.

Como funciona, para quem for mexer:

- **Uma lista só.** `redirects()` em `next.config.mjs` lê `paineis-reescritos.json` e gera uma regra permanente para cada painel com `redirecionar: true`. O Next repassa a consulta (`?sec=` e os recortes) ao destino. Redirecionar um painel (como foi feito com os três últimos em 10/11/2026) é trocar `false` por `true` nesse arquivo, rodar `node scripts/barra-spa.mjs` e `npm run preparar`, trocar o endereço do painel em `GRUPOS_CREDITO` (`src/lib/credito/navegacao.ts`) e atualizar a lista escrita em `src/tests/redirecionamento-reescritos.test.ts`, que existe para exigir decisão nova.
- **Sem sessão.** No Next 14 os `redirects()` rodam antes do middleware: o endereço antigo responde 308 para a página nova, e é o middleware, já no endereço novo, que leva a `/entrar?de=<página nova com a consulta>`.
- **Dentro da aplicação do Crédito.** O índice que o servidor embute (`substituidas`, `src/lib/observatorios/barraSpa.ts`) diz ao `app.js` a página nova, o título e a pergunta de cada vista redirecionada. O "Início do painel" as lista como link comum para a página nova, e `nav()`, as pontes, os alertas e o histórico do navegador saem da aplicação em vez de desenhar a vista.
- **Código morto.** As funções de render das nove vistas (`renderDesenrola`, `renderBets`, `renderFraudes`, `renderJudicial`, `renderCobranca`, `renderConduta` e, desde o fechamento da paridade, `renderConsignado`, `renderMoradia`, `renderEmprego`) continuam em `public/obs/app.js`, sem caminho que as alcance quando o índice está presente. Não foram removidas porque cerca de vinte arquivos de teste leem esse código como texto; a remoção pede um PR próprio, aposentando essas asserções uma a uma. Os verbetes do guia (`GUIA`) dessas vistas também ficaram, sem uso na tela: o "Início do painel" mostra a pergunta da página nova.
- **Testes.** `src/tests/redirecionamento-reescritos.test.ts` (lista única, permanência, consulta, login com destino novo e, com build, a cadeia inteira no servidor) e `src/tests/split-bundle-browser.test.ts` (no navegador, `nav("desenrola")` e o endereço antigo chegam à página nova) e `src/tests/familias-paridade-browser.test.ts` (os três últimos: endereço antigo com consulta, mapa, recorte no endereço, dispersão e pesos).

---

# Paridade: apostas

Vista antiga: `bets` (`renderBets`, public/obs/app.js, linhas 7700 a 8123), `/observatorio/bets-financial-risk`. Página nova: `/divida-das-familias/apostas` (`src/app/divida-das-familias/apostas/page.tsx`). Golds: `bets.json`, `epae.json`, `pulse.json` (as mesmas).

| Bloco da vista antiga | Onde ficou | Observação |
|---|---|---|
| Cabeçalho: título, subtítulo, última atualização, período coberto, corte, selo "associações não implicam causalidade" | Abertura (H1 em pergunta, lead, recorte com `periodo_coberto`, limite) e "Fontes, datas e siglas" | O título "Bets e risco financeiro" virou a pergunta da guia da vista; o aviso de causalidade está no limite e na nota dos números |
| Guia da página (por que importa, como ler, o que não concluir) | Lead, limite da abertura e nota da faixa | "Por que importa" não foi reproduzido literalmente (ver "não migrado") |
| Legenda dos níveis A a E (chips) | `LegendaGraus`, na nota da faixa de números, com a descrição de cada grau à vista (antes só em dica) | |
| Síntese: 8 cartões com nível, valor, data, fonte, situação, conceito e nota em dica | Faixa de números (4 de grau A, sem imprensa) + capítulo `#sintese`, tabela com os 8, grau, situação, fonte com link, conceito e nota à vista | Conceito e nota saíram da dica para a tabela |
| Cadeia "Como as apostas podem chegar ao crédito": nós, grau por nó, tabela de evidência por elo (recolhida) | Capítulo `#canais`: descrição, `CadeiaElos`, tabela de elos à vista | |
| GGR por período oficial (barras), nota "não interpola", rodapé | Figura `#mercado-regulado` (GraficoBarras), ressalva, tabela equivalente com grau, situação, fonte e derivação | Barra de imprensa deixou de ser cor de aviso: a situação vai no rótulo e na tabela |
| Quantos apostam (tabela) | `#quantos-apostam` | |
| Arrecadação e destinações 2025 (barras) + 2026 imprensa | `#arrecadacao` (tabela; 4 valores) e nota com 2026 | Barras em linha viraram tabela |
| Fluxo Pix pré-regulação (número, selo descontinuada, nota "não comparável") | `#pix-pre-regulacao` (texto com faixa e pico da gold, grau, fonte, nota) | "R$ 18–21 bi" escrito à mão na vista antiga passou a ler `faixa` da gold |
| Fiscalização e bloqueio de sites (tabela + frase de 2025) | `#bloqueios` | A frase "132 processos, cerca de 550 contas" não está na gold: foi mantida como na vista antiga, citando o 2º Panorama (registrado em FONTES_BETS.md) |
| Quem aposta: aviso de populações, SIGAP (barras), DataSenado (prevalência, barras, gasto, endividamento, regiões), pesquisas privadas | Capítulo `#quem-aposta`: `#perfil-sigap`, `#perfil-datasenado`, `#gasto-declarado`, `#regioes`, nota de dívida declarada, `#pesquisas-privadas` | Barras em linha viraram tabelas; regiões viraram tabela |
| Vulnerabilidade: Bolsa Família (dado, contestação, restrição), grupos, proteções, leitura institucional | Capítulo `#vulnerabilidade` | |
| Explorador bets × crédito: seletor de indicador, escala (nível, base 100, z), marcos, CSV, chips de rótulo, nota de correlação, indicadores ausentes | Figura `#credito` (`FiguraExplorador` + `ExploradorCredito`), estado na URL (`?ind`, `?escala`, `?marcos`), tabela equivalente com os 10 indicadores | Mesmas três escalas e mesma janela (desde jan/2023); "z-score" virou "desvios-padrão na janela" |
| Autoexclusão: acumulado (barras), motivos (barras), "o que este número não é", links de apoio | Figura `#autoexclusao`, `#motivos` (tabela), ressalva, nota "Onde buscar ajuda" | 574,6 mil, 25,2 milhões e 2,3% agora lidos e calculados da síntese da gold (antes escritos à mão); texto do SUS vem de `vulnerabilidade.grupos` |
| Mercado ilegal: aviso, estimativas, ações, riscos | Capítulo `#mercado-ilegal` | |
| EPAE: aviso, taxonomia CNAE, gráfico de 3 linhas, anuais, mudança de patamar, permite/não permite, observado × atribuído, conceitos e limites, último mês, CSV | Figura `#pix-da-secao` (GraficoLinhas com zoom), `#pix-por-ano`, listas, `#observado-e-atribuido`, tabela de conceitos, CSV | Tabela equivalente mensal completa (71 meses, 8 colunas) é nova como tabela, com os mesmos dados |
| Evidências científicas (11 cartões) | Capítulo `#evidencias` (recolhido) | |
| Linha do tempo regulatória (24) | Capítulo `#linha-do-tempo` (recolhido) | |
| Metodologia: princípio, tipos de dado, conceitos, roteiro, Open Finance, descartados, rastreabilidade | "Conceitos que não podem ser confundidos" (ParaLer, à vista) e "Método e fontes" (recolhido) | |
| Botões baixar CSV, baixar JSON, CSV do explorador, CSV da EPAE | CSV dos dados e JSON das duas golds no método; CSV do indicador no explorador; CSV da EPAE na figura | Mesmas colunas; nomes de arquivo `bets_dados_<corte>.csv`, `apostas_explorador_<ind>.csv` |
| Subnavegação fixa (âncoras) | Não migrado | O molde não tem subnavegação própria; cada capítulo tem `id` (âncoras existem) |
| `fontePane("bets")` (painel de frescor das fontes) | Não migrado | Depende do registro de frescor (`FRESCOR_DAS_COLECOES`), fora dos arquivos permitidos; as datas estão em "Fontes, datas e siglas" |
| "Por que importa" da guia | Não migrado literalmente | Frase editorial com "dezenas de bilhões" sem fonte ao lado; o tamanho está nos números de abertura |

---

# Paridade: Bancos cobrando na Justiça

Vista antiga: `/observatorio/debt-collection-lawsuits` (`renderCobranca`, `public/obs/app.js` linhas 9808 a 9900; guia em `GUIAS.cobranca`). Gold: `public/obs/data/gold/cobranca.json` (coleta de 05/11/2026, último mês fechado ago/2026).
Página nova: `/divida-das-familias/bancos-cobrando-na-justica` (`src/app/divida-das-familias/bancos-cobrando-na-justica/page.tsx`).

| Bloco da vista antiga | Onde ficou na página nova |
|---|---|
| Título "Bancos cobrando na Justiça" | `metadata.title` e `TITULO_BANCOS_COBRANDO`; o H1 é a pergunta "Quantas ações de cobrança de crédito chegam à Justiça?" |
| Selo de data (`vintage`, mês fechado) | Recorte da abertura (jan/2019 a ago/2026), período de cada número ("12 meses até ago/2026") e subtítulos |
| Selos observado e calculado | `natureza` de números e figuras; frase "Natureza declarada pela base" no método (campo `tipo` da gold) |
| Descrição | Lead da abertura |
| Fontes (DataJud, Censo 2022, SCR.data) | Recorte, fonte de cada número, "Fontes, datas e siglas" e método |
| Botão "baixar CSV (série mensal)" (`cbCSV`) | Figura "serie", botão "Baixar a série mensal completa (CSV)": mesmas colunas e separador, meses parciais marcados; o cabeçalho leva a data da coleta no lugar da hora da exportação |
| Síntese determinística (`sintese`) + linha de janela, meses parciais e cobertura | Nota da faixa de números (texto da gold, com o mês em "ago/2026") |
| Placar: cobrança bancária 12 m, com variação e parcela | Número 1, com a variação em palavras e a parcela na nota |
| Placar: qualquer credor 12 m, com variação | Número 2 |
| Placar: via mais usada | Nota da faixa de números e leitura guiada da figura "vias-12-meses" (o molde admite até 4 números) |
| Placar: por mil habitantes, com população coberta | Número 3 |
| Placar: por R$ bilhão de carteira | Número 4 |
| Navegação fixa (Série, Classes, UFs, Método) | Não migrada como barra: as seções são as figuras e o método do molde, com âncoras `#serie`, `#vias-por-mes`, `#vias-12-meses`, `#estados` |
| Gráfico "Bancário e qualquer credor", com seletor de classe | Figura "serie", com Controles "Via de cobrança" (`?classe=`) logo acima; tabela equivalente com todos os meses fechados |
| Nota dos três meses parciais e da cobertura antes de 2020 | Ressalva da figura "serie" |
| Gráfico "Por classe, recorte bancário" + texto das quatro vias | Figura "vias-por-mes" (legenda que oculta séries), leitura guiada com o mesmo texto |
| Tabela "As quatro vias, em 12 meses" (8 colunas) | Figura "vias-12-meses": barras agrupadas e tabela com as 8 colunas |
| Nota do recorte bancário (assuntos TPU, piso e não teto) | "Como interpretar" da figura "vias-12-meses", com a lista de assuntos da gold |
| Pontes para Clientes contra bancos e Recuperações e falências | Links depois da figura "vias-12-meses" (a primeira aponta para a página nova irmã) |
| Tabela "Onde se cobra mais", com seletor de ordenação (4 medidas) e barra | Figura "estados": barras por UF na medida de `?medida=`, ordenadas como antes; tabela equivalente com a posição; e a tabela completa ordenável na fatia `tabelas`, com as mesmas colunas e exportação |
| Link de cada UF para a página do estado | Coluna UF da tabela ordenável, para `/observatorio/states/<UF>` |
| Posições (10º) ao lado de casos, por mil e por bi | Coluna "Posição entre as UFs cobertas" na tabela equivalente da figura "estados", para a medida escolhida (a variação não tem posição na gold) |
| Nota das posições, da inadimplência do SCR e da cobertura | Nota da tabela ordenável e ressalva da figura "estados" |
| Ponte para Estados | Nota da tabela ordenável (a sigla leva à página do estado) |
| Método (`metodo`), catálogo (5 colunas), limitações, cautelas, fonte, licença, nível, data da coleta | Método, na mesma ordem |
| Guia da página (pergunta, por que importa, como ler, o que não concluir) | H1, "Por que isso importa" e "Como interpretar" da figura "serie", limite da abertura e glossário de uso |

Mudanças deliberadas, sem perda de conteúdo:
- Variação positiva e negativa não têm mais cor (a vista antiga pintava alta e queda); ficam o sinal e o número.
- O vermelho da linha bancária sai; a série focal é o token `--serie-1` e a de contexto, `--serie-2`.
- Mês em "ago/2026" em vez de "2026-08" (também dentro da síntese da gold, por `datasLegiveis`).

Não migrado:
- Barra de navegação fixa da seção (substituída pelas âncoras do molde; a navegação da coleção já ocupa o topo).
- Carimbo "exportado em" com a hora do navegador no CSV (substituído pela data da coleta da gold).
- Largura de tela decidindo rótulo no fim da linha (`rotulosFim`): o gráfico do kit resolve sozinho.

---

# Paridade: Clientes contra bancos na Justiça

Vista antiga: `/observatorio/lawsuits` (`renderJudicial`, `public/obs/app.js` linhas 1700 a 1846; guia em `GUIAS.judicial`). Gold: `public/obs/data/gold/judicial.json` (coletada em 24/09/2026, publicação retida desde então).
Página nova: `/divida-das-familias/clientes-contra-bancos` (`src/app/divida-das-familias/clientes-contra-bancos/page.tsx`).

| Bloco da vista antiga | Onde ficou na página nova |
|---|---|
| Título "Clientes contra bancos na Justiça" | `metadata.title` e constante `TITULO_CLIENTES_CONTRA_BANCOS`; o H1 é a pergunta do guia antigo, "Quanto o Judiciário é acionado em temas bancários?" |
| Selo de data (`vintage`, 2026-09) | Recorte da abertura ("acervo coletado em 24/09/2026; TST, junho de 2026"), período de cada número, subtítulo de cada figura e o aviso logo abaixo da abertura |
| Selos observado e calculado, com a explicação | `natureza` de cada número e figura (SeloNatureza do kit) e a frase dos selos no método |
| Descrição da página | Lead da abertura |
| Fontes (DataJud, TST, IF.data) | Recorte da abertura, "Fontes, datas e siglas" e método, com os endereços |
| Botão "baixar CSV" (`judCSV`) | Figura "assuntos", botão "Baixar os assuntos dos dois ramos (CSV)": mesmas colunas, mesmo separador, mesmo nome de arquivo |
| Alerta "Antes de ler estes números" (`limitacao_central`, duas camadas, `aviso_permanente`) | Aviso (`aviso` do molde), com a data real da base na primeira linha |
| Seletor de ramo (Cível, Trabalhista), no endereço como `jramo` | Controles na abertura, links com `?ramo=trabalhista`; o servidor lê o parâmetro |
| KPI: casos únicos, registros, registros por caso, tribunais cobertos | Faixa de números (4), no ramo escolhido |
| "Composição por natureza da ação" (barras) + leitura (polo, casos e registros) | Figura "natureza": barras, tabela com casos, % do ramo, registros e registros por caso; `nota_polo` em "Como interpretar" |
| "Assuntos mais frequentes (TPU)", 12 primeiros, com o código | Figura "assuntos": barras dos 12 primeiros; a tabela traz todos os assuntos do ramo, com código TPU, natureza, casos e registros |
| Nota "códigos descobertos por agregação, nenhum presumido" | Leitura guiada da figura "assuntos" |
| Mapa de calor "Tribunal × natureza da ação" | Figura "tribunais": barras empilhadas por tribunal (composição dentro de cada tribunal, a leitura que a vista antiga dizia ser a válida) e tabela com todas as células, o total e os registros de cada tribunal |
| "Entenda" do mapa de calor (o que a célula mostra, por que não comparar tribunais, sem recorte temporal) | Leitura guiada, "O que não é possível concluir" e "Como interpretar" (`nota_temporal`) da figura "tribunais" |
| Ranking "Quem são os maiores litigantes nominais?", visão Volume | Figura "litigantes": barras dos dez, com instituição financeira em série própria, tabela com posição, parte, marca de IF, casos e % dos dez |
| Visão "Por escala" (botão, no endereço como `jordem`) | Figura "por-escala", sempre à vista (sem botão): casos por R$ 100 bilhões de ativo das cinco instituições |
| Texto de cobertura do TST (`cobertura`) | Ressalva da figura "litigantes" |
| "Como ler" do ranking (nominal, normalização, entes públicos) | "Como interpretar" e leitura das figuras "litigantes" e "por-escala"; ressalva de numerador e denominador |
| Tabela "Resolução de entidades" (parte, instituição, confiança) | Tabela equivalente da figura "por-escala", com a entidade usada para o tamanho |
| "O que esta página não calcula, e por quê" (tabela) + privacidade | Fatia `tabelas`: TabelaDados à vista com a mesma lista; privacidade na nota e no método |
| "Catálogo metodológico" (8 colunas) | Método, TabelaDados com as mesmas 8 colunas |
| "Auditoria completa das fontes: docs/AUDITORIA_JUDICIAL.md" | Método, última frase |
| Guia da página (pergunta, por que importa, como ler, o que não concluir) | H1, "Por que isso importa" da primeira figura, glossário de uso e limite da abertura |

Mudanças deliberadas, sem perda de conteúdo:
- Cores por categoria (sete cores soltas em hexadecimal) saem; ficam os tokens de série e o rótulo.
- A visão "Por escala" não reordena os bancos pelo valor: as barras seguem a ordem do ranking do TST e a tabela mostra as duas medidas (regra editorial: ordem sem juízo).
- Texto da gold passa por `prosa()`: travessão de pontuação vira ponto e vírgula, "2609–2612" vira "2609 a 2612", "IF" sai por extenso. Nenhuma palavra de conteúdo muda.
- A frase do guia antigo "no Brasil é excepcionalmente alta" não foi levada: é afirmação sem número na gold.

Acréscimos (nenhum número novo):
- Aviso de defasagem com a data da coleta e o motivo (OPERACOES.md, correção 14).
- Ressalva de que os assuntos contam processos de qualquer parte (decorre de a base não publicar as partes; ver "riscos" na resposta).
- Coluna "% dos casos dos dez maiores" (`part_top10`, campo da gold que a vista antiga não mostrava).

Não migrado: nada.

---

# Paridade: vista `consignado` (app.js, renderConsignado) → /divida-das-familias/consignado

Golds: `public/obs/data/gold/consignado.json` (lida no servidor) e `consignado_mun.json` (resumo no servidor, base inteira só sob demanda no navegador). Também `regulacao.json` (marcos), `penetracao_malha.json` e `/obs/geo/uf.json` (malha, no navegador).

| Bloco da vista antiga | Onde ficou na página nova | Observação |
|---|---|---|
| Cabeçalho (título, descrição, linha de fontes) | Abertura do molde: H1, lead, recorte, limite, "Fontes, datas e siglas" | Título passa a ser a pergunta do catálogo (`observatorioAbas.ts`) |
| Placar: inadimplência INSS, inadimplência privado (e razão "N vezes"), reclamações, carteira total | Faixa de números (4) | Mesmos valores e mesma natureza (observado, observado, calculado, calculado) |
| Índice numerado de 11 seções | Não migrado | Removido como duplicação: o molde não usa seção numerada (o conferidor reprova "01 ·") e as figuras têm âncora própria |
| 1. Visão geral: parágrafo de abertura | Limite da abertura e método | Mesmo conteúdo |
| 1. KPI população 60+ | Figura `#idade`, leitura guiada | |
| 1. KPI benefícios emitidos, valor líquido mensal (com média) | Figura `#previdencia`, faixa de números | A média vira o número "Benefício médio" |
| 1. KPI consignado de aposentados (SCR) | Figura `#saldo`, número com o aviso do grupo do SCR | |
| 1. KPI municípios de alta dependência | Figura `#previdencia`, número e leitura | |
| Aviso "Três coisas que este dado não é" | Figura `#previdencia`, ressalva à vista; repetido no método | |
| 2. Pirâmide etária | Figura `#idade`, GraficoBarras horizontal + tabela equivalente | Realce migrado em 10/11/2026: os grupos de 60 anos ou mais são uma série própria, com legenda; o total de 60+ continua na leitura |
| 2. Indicadores nacionais + definições | Figura `#idade`, tabela "Indicadores nacionais de envelhecimento" (coluna "O que mede") | |
| 3. Previdência: parágrafo do IPCA | Figura `#previdencia`, "Como interpretar" e fórmula da proveniência | |
| 3. KPIs ben/100, peso, benefício médio | Figura `#previdencia`, faixas de números | |
| 3. Aviso "razão entre bases agregadas" | Figura `#previdencia`, "O que não é possível concluir" | |
| 3. Teste de coerência (texto + 3 KPIs) | Figura `#previdencia`, texto e números | "Municípios testados" virou o recorte "de 5.570 testados" dos outros dois números |
| 4. Mapa municipal, 9 camadas | Figura `#municipios`, ExploradorMunicipios (carga sob demanda) com o mapa coroplético da plataforma (`MapaMunicipios`) | Botões de camada viraram um `<select>` "Medida"; desde 10/11/2026, cinco classes por quantis no lugar da escala contínua p5 a p95; paleta fria = rampa sequencial da plataforma, quente = rampa do token bronze |
| 4. Filtro de região e de confiabilidade, contagem do recorte | Explorador, Controles do kit | Migrado em 10/11/2026: medida, região e confiabilidade na URL, com os nomes da vista antiga (`?cgcam=`, `?cgregiao=`, `?cgconf=`) |
| 4. Dica (tooltip) do município | Dica do mapa da plataforma (ponteiro, toque e busca por teclado) | Medida da camada, classe e confiabilidade; 60+, benefícios e peso ficam no perfil |
| 4. Contornos de UF | Mapa da plataforma (divisas da malha municipal do IBGE) | |
| 4. Legenda da escala e nota das paletas | Legenda do mapa (classes, contagem por classe, sem dado, não se aplica, método) e nota abaixo | |
| 4. Tabela "Dados do mapa" com busca, paginação de 50 e CSV | Explorador, `<details>` com TabelaDados do kit | CSV pelo ExportacaoComConta; o valor sai numérico (vírgula decimal), não mais formatado com unidade |
| 4. Lista "Maiores" (25) | Explorador; e, no HTML do servidor, tabela equivalente com os 25 maiores de 60+ no recorte padrão | |
| 4. Distribuição por faixa de dependência | Figura `#previdencia` (gráfico e tabela, recorte padrão, no servidor) e, reativa ao filtro, no explorador | |
| 5. Exposição: parágrafo, tabela por vínculo, notas de juros/ICC com links SGS | Figura `#saldo`, complemento (tabela "Consignado por vínculo do tomador") | Células sem valor: "não está nesta base" em vez de traço |
| 5. Série do saldo por vínculo com marcos de margem e de regulação | Figura `#saldo`, GraficoLinhas com `marcos` e zoom | Os marcos de regulação perdem a cor roxa própria (hexadecimal solto na vista antiga) |
| 5. Aviso "Duas medidas distintas" | Figura `#saldo`, nota à vista | |
| 6. Circularidade: texto, "Uma correção desta página" | Figura `#relacao`, complemento | |
| 6. Tabela das 4 especificações + linha municipal (hipótese) | Figura `#relacao`, tabela "Quatro especificações" | Referência como linha destacada |
| 6. Correlação parcial com controles | Figura `#relacao`, tabela | |
| 6. Dispersão por UF com seletor de estado e tabela | Figura `#relacao`, `DispersaoEstados` (GraficoDispersao do kit) + tabela equivalente | Migrados em 10/11/2026: a área do círculo acompanha a população de 60 anos ou mais e o `<select>` "Consultar estado" destaca o estado, com a escolha na URL (`?cguf=`). Continuam de fora as 27 siglas escritas no desenho |
| 6. "O mecanismo não está estabelecido" (tabela + conclusão) | Figura `#relacao`, tabela "O mecanismo não está estabelecido" | |
| 6. Regra de conclusão | Figura `#relacao`, "O que não é possível concluir" | |
| 7. Saturação: texto, 4 KPIs, critérios | Figura `#saturacao`: gráfico de barras das 4 classes, tabela equivalente, tabela de critérios | Os 4 KPIs viraram as 4 barras (mesmos valores) |
| 8. Sensibilidade: aviso, tabela top 15, nota das dimensões | Fatia de tabelas `#sensibilidade` (país, no servidor); por região, no explorador quando a região é escolhida | A coluna "#" saiu (a ordem é a da tabela) |
| 9. Instituições: texto, taxa por instituição (12 de 39) | Figura `#instituicoes`: barras (12 à vista, "mostrar todas") com a mediana, tabela equivalente das 39 | Sem cor de "melhor/pior" na diferença para a mediana; "mais cara/mais barata" virou "maior/menor taxa" |
| 9. Reclamações por instituição (12) + aviso | Fatia de tabelas `#reclamacoes` | |
| 10. Perfil municipal e comparação de até 5 | Explorador, seção "Perfil municipal" (24 indicadores, natureza, confiabilidade, aviso de incoerência) | A regra de quem entra na comparação ficou mais simples: o último escolhido entra na frente, até cinco |
| 11. Evolução regulatória (19 eventos) | Método, lista com data, tipo, norma e efeito | |
| 11. Dicionário de indicadores (6) | Fatia de notas (ParaLer), com limite e fonte de cada um | |
| 11. "O que esta página não autoriza concluir" (8 itens) | Método | |
| Estado de carregamento e de gold indisponível | Carga: estados parado, carregando, erro e pronto no explorador. Gold `ok: false`: a página lança erro no build | **Não migrado** como tela: a vista antiga mostrava "Painel indisponível nesta execução" |

Campos da gold que a vista antiga não mostrava e a página nova também não mostra: `rankings`, `scr.por_uf`, `scr.composicao_ocupacao`, `scr.serie_*`, `sgs.series.{inad,taxa,conc,prazo}`, `reclamacoes.serie`, `instituicoes.serie_mensal`.

---

# Paridade: /observatorio/housing-credit (renderMoradia) → /credito-imobiliario

Golds: `public/obs/data/gold/moradia.json` (servidor) e `moradia_mun.json` (só no navegador, sob demanda). Verificado por código e por `src/tests/familias-credito-imobiliario.test.ts`; desde 10/11/2026, o mapa e a consulta municipal também no navegador (`src/tests/familias-paridade-browser.test.ts` e capturas em `docs/ux-2026-11-10/paridade`).

| Bloco da vista antiga | Onde ficou na página nova |
|---|---|
| Cabeçalho (título, descrição, fontes com datas) | Abertura do molde: H1, lead, recorte, limite, "Fontes, datas e siglas" |
| Pedagogia (q, importa, ler, não) | q = H1; importa e ler = nota de "Para ler esta página"; não = limite da abertura |
| Índice numerado das 6 seções | Links de âncora abaixo dos achados, sem numeração (o molde reprova "01 ·") |
| Abertura: 5 indicadores | 4 números na faixa; o 5º (taxa de contratação e LTV do SFH) está na nota da faixa e na tabela por segmento |
| Mapa municipal (5.570 polígonos, 4 medidas, filtro de região, clique abre perfil) | Migrado em 10/11/2026: mapa coroplético da plataforma em `#municipios`, sobre a malha oficial do IBGE (1,3 MB, pedida junto com o arquivo dos municípios, só quando o bloco se aproxima da tela), nas 4 medidas, com filtro de região e clique que abre o perfil. Cinco classes por quantis no lugar do sombreado entre os percentis 5 e 95; medida e região na URL |
| Lista "Maiores" (25) ao lado do mapa | `ConsultaMunicipal`: 25 maiores por medida e região, calculados no navegador como antes |
| "O que os dados mostram" (4 achados com selo) | Lista abaixo dos números, com a natureza de cada um |
| 1. Como o Brasil mora: barras, prosa, soma x total, alerta, "não coletou" | Figura `#como-mora` (GraficoBarras, tabela, leitura, ressalva, complemento) |
| 2. Onde está: tabela das três medidas e nota de reconciliação | Capítulo `#onde-esta`, TabelaDados em R$ bilhões (antes, valor abreviado) |
| 2. Verbete 169: contas COSIF, "não distingue", alerta, fonte e inversão | Mesmo capítulo; a marca visual da conta "fora" virou a coluna "É crédito habitacional residencial?" |
| 2. Alerta de concentração contábil | Mesmo capítulo |
| 2. Gráfico da carteira PF por origem (4 séries) | Figura `#carteira-origem` com zoom e tabela dos 149 meses |
| 2. Três cartões do direcionamento | 3 NumeroIndicador no complemento da figura. As legendas "um nono do que vai para aquisição" e "praticamente inexistente" saíram: fração escrita à mão e adjetivo |
| 3. Quem financia: tabela das 15 maiores | Capítulo `#quem-financia` com as 35 instituições (antes, 15) |
| 3. Perfil do município (17 linhas com selo, maior participante, confiabilidade) | Em `#municipios`, com as mesmas 17 linhas e textos. Saiu a cor verde/amarela/vermelha da confiabilidade; ficou o texto |
| 4. Tabela por segmento | Capítulo `#peso`, TabelaDados |
| 4. Simulador Price e SAC (4 campos, 2 linhas, taxa mensal, avisos, referência por UF) | Capítulo `#simulador`, no envelope Modelo didático, rotulado "cálculo, não previsão"; mesmas fórmulas. A UF de referência, antes fixa em SP, ganhou seletor |
| 4. Tabela por UF (recolhida) | Mesmo capítulo `#peso`, TabelaDados recolhida, 27 linhas |
| 5. Alerta "lacuna não é demanda" e dois cartões de lacuna com leitura | Capítulo `#potencial`, 2 NumeroIndicador ESTIMADO com agrupamento, grupos, referência, especificação e ajuste |
| 5. "Por que a amostra é restrita" | Texto mantido, SEM os dois números escritos à mão no app.js (desvio de 1,45 e lacuna de R$ 2,5 trilhões sem a restrição): não estão na gold. Decidir se entram, com a fonte |
| 5. Ranking com alternância saldo/domicílios (25) e clique para o perfil | As duas tabelas à vista, uma abaixo da outra; o nome leva a `?municipio=<código>#municipios` |
| 6. Matriz de viabilidade (12), dicionário (11), "não autoriza concluir" (8) | Fatia método, tudo |
| Fórmulas do simulador (`simulador.formulas`) | Método, reescritas por extenso |
| Estado "painel indisponível" (`!D.ok`) | Página mínima com o motivo, sem número |

---

# Paridade: Desenrola Brasil

Vista antiga: `/observatorio/desenrola` (`public/obs/app.js`, `renderDesenrola`, linhas 5424 a 5897). Página nova: `/divida-das-familias/desenrola` (`src/app/divida-das-familias/desenrola/page.tsx`). Mesma gold (`public/obs/data/gold/desenrola.json`), mais `pulse.json` (séries de contexto) e `regulacao.json` (marcos), como na vista antiga.

Não vi a página no navegador. A conferência foi pelo HTML do servidor (teste) e pela leitura do texto renderizado.

| Bloco da vista antiga | Onde ficou na página nova | Observação |
|---|---|---|
| Cabeçalho (título, descrição, data-base, fontes) | Abertura do molde: H1, lead, recorte, limite e "Fontes, datas e siglas" | O guia da vista (`importa`, `ler`, `nao`) virou "Por que isso importa" e "Como interpretar" da figura `#alcance` e o limite da abertura |
| Parágrafo de abertura (o que foi o programa, faixas 1 e 2) | Lead da tabela `#arquitetura` (primeiro bloco da fatia de tabelas) | As regras de cada faixa estão na própria tabela, lidas da gold |
| Índice de seções (10 âncoras) | Navegação local logo abaixo dos números (10 âncoras) | Links de âncora, sem JavaScript |
| 4 números oficiais (elegíveis, renegociaram, regularizado, beneficiados) | Faixa de números da abertura | A nota de cada número, que era dica ao passar o mouse, agora fica à vista |
| Aviso "Esta base não cobre o programa inteiro", linhas fora do recorte e reconciliação | Figura `#alcance`, antes do gráfico (três notas à vista) | Texto da gold |
| 4 números do SCR (operações, volume, valor médio, conglomerados) | Figura `#alcance`, antes do gráfico | |
| "Como ler estes números" (5 termos) | Fatia de notas `#como-ler` (ParaLer) | |
| Linha do tempo (12 marcos com fonte) | Tabela `#linha-do-tempo` | Lista virou tabela à vista (data, marco, o que aconteceu, fonte) |
| Arquitetura do programa (tabela comparativa e alertas) | Tabela `#arquitetura` | Alerta da baixa de registro negativo na nota da tabela |
| Quadro de contexto: Desenrola Pequenos Negócios | Tabela `#pequenos-negocios` | Ganha período na base e número de grupos credores, que já estavam na gold |
| Filtro de faixa (ambas, só Faixa 1, só Faixa 2) | Legenda interativa dos gráficos de `#alcance` e `#valores` | Mudou de forma: as três séries estão no gráfico, a soma aberta e as faixas ocultas ao abrir (o padrão antigo). Dá para ver as três juntas, o que antes não dava. O estado não é compartilhado entre as duas figuras |
| Filtro de métrica (operações, volume) | Seletor "Medida da série" em `#alcance` | Volume em R$ milhões |
| Gráfico "Renegociações informadas ao SCR, por mês", com marcos | `#alcance` | Mesmos marcos (abre a Faixa 1, encerramento, Lei 14.690/2023 da gold de regulação); tabela equivalente com os 37 meses e as duas medidas |
| Concentração no tempo (durante e depois do programa) | Tabela `#concentracao-no-tempo` em `#alcance` | Barras viraram tabela, com as três seleções de faixa lado a lado |
| Participação de cada faixa | Tabela `#participacao-das-faixas` em `#alcance` | Barras viraram tabela; ganha a coluna de volume |
| Lacuna: funil do programa | Tabela `#lacunas-funil` | |
| Razão citada (cerca de 17%) | Nota à vista em `#alcance` | Calculada dos dois números oficiais da gold, como antes |
| Gráfico do valor médio por operação | Figura `#valores` | |
| Lacuna: valores e condições | Tabela `#lacunas-valores` | |
| "Os conceitos que não se confundem" (6) | Tabela `#conceitos` | Ganha a coluna "Está nesta base?" |
| Mapa por UF com 4 métricas | Figura `#onde`, mapa com seletor de medida | Malha oficial do IBGE da plataforma (`/energia/geo/uf.json`, carregada no navegador) no lugar dos contornos embutidos na gold. **Classes por quantis no lugar do sombreado logarítmico**: mesma finalidade, forma diferente |
| Ranking das 12 maiores UFs | `#onde`, barras ao lado do mapa | As 12 primeiras desenhadas e "Mostrar todas" para as 27 |
| Tabela de todas as UFs | Tabela equivalente de `#onde` (27 linhas) | |
| Lacuna: perfil dos beneficiários | Tabela `#lacunas-perfil` | |
| Aviso "não é um ranking de melhores e piores" | Ressalva à vista de `#credores` | |
| Participação nas operações (12 maiores) | `#credores`, barras | 12 desenhadas e "Mostrar todas" para os 59 |
| Nota de consolidação e componentes (dica) | "Como interpretar" de `#credores` e tabela recolhida com os componentes das 14 linhas consolidadas | Era dica ao passar o mouse; agora é tabela |
| Concentração (5 maiores e HHI) | Dois números em `#credores` | |
| Comparar até cinco conglomerados | Componente `CompararCredores` em `#credores` | Mesma regra: vinte maiores, até cinco, sem seleção mostra os cinco maiores |
| (não havia) | Tabela equivalente de `#credores` com os 59 grupos | Acréscimo exigido pelo molde, com dados da gold |
| Lacuna: comparação entre instituições | Tabela `#lacunas-credores` | |
| "O que aconteceu depois da renegociação" (prosa, lacuna e advertência) | Tabela `#depois` | |
| Seletor das 5 séries de contexto e gráfico com marcos | Figura `#contexto` | Tabela equivalente com as cinco séries |
| Evidências descritivas e associações | Dois parágrafos em `#contexto` | |
| Evidência causal (relatório, objeto, desenho, achados, conclusão, limite, link) | Tabela `#avaliacao` em `#contexto` | |
| Garantias e dimensão fiscal (prosa, lacuna, nota) | Tabela `#fiscal` | Os R$ 137 bi e R$ 25 bi agora são lidos da gold (eram texto fixo) |
| Matriz de viabilidade (barras por área) | Figura `#viabilidade`, barras empilhadas | |
| Tabela dos 29 indicadores | Tabela recolhida em `#viabilidade` | |
| Dicionário dos indicadores | Método e fontes | |
| Selos | Método e fontes | "Reportado" aparece com o selo Observado da plataforma (mesma definição); a página diz isso |
| Procedência e tratamento | Método e fontes | Hora da coleta no horário de Brasília |
| Downloads | Não havia na vista antiga; não foi criado | |

## Não migrado ou mudado, com motivo

1. **Sombreado logarítmico do mapa**: trocado por classes de quantis, que é o que o mapa da plataforma oferece.
2. **Contornos de UF embutidos na gold (`geo.paths`)**: não usados; a página usa a malha oficial que a plataforma já publica. O HTML fica sem geometria.
3. **Filtro de faixa único para duas seções**: virou legenda interativa por gráfico, sem estado compartilhado nem estado na URL.
4. **Bloco `lacunas` da gold (5 temas)**: a vista antiga não o exibia; a página nova também não.
5. **Estado de carregamento e "painel indisponível"**: a página é estática; com a gold indisponível a renderização falha no build em vez de publicar página vazia.

---

# Paridade: /observatorio/formal-employment (renderEmprego) → /emprego-formal

Gold: `public/obs/data/gold/emprego.json` (a mesma). Verificado por código e por `src/tests/familias-emprego-formal.test.ts`; desde 10/11/2026, o bloco dos pesos também no navegador (`src/tests/familias-paridade-browser.test.ts` e capturas em `docs/ux-2026-11-10/paridade`).

| Bloco da vista antiga | Onde ficou na página nova |
|---|---|
| Cabeçalho (título, descrição, selos observado/calculado, fontes) | Abertura do molde: H1, lead, recorte, limite, "Fontes, datas e siglas"; a natureza vai em cada número e figura |
| Pedagogia (q, importa, ler, não) | q = H1; importa = "Por que isso importa" da 1ª figura; ler = nota de "Para ler esta página"; não = limite da abertura |
| Botão "baixar CSV (seções)" | `BaixarCsv` na figura `#secoes`, mesmas 17 colunas e mesmas linhas (`setores`), com `ExportacaoComConta` |
| Síntese determinística (`D.sintese`) | Parágrafo logo abaixo dos números (`data-sintese`), texto da gold com mês no padrão brasileiro e "a/a" por extenso |
| Placar, 5 medidas | 4 números na faixa (vínculos, saldo do mês, saldo 12 m, variação 12 m com o desvio). A 5ª (admissões, desligamentos, rotatividade 12 m) está na nota da faixa, com fonte, período e natureza: o molde aceita no máximo 4 |
| Subnavegação fixa (Brasil, Seções, UFs, Score, Método) | Links de âncora abaixo da síntese (não fixos) |
| Brasil: gráfico do saldo mensal, 36 meses, com e sem ajuste | Figura `#brasil-saldo` (GraficoLinhas, 36 meses, em vínculos e não em milhares) |
| Brasil: gráfico da variação a/a com a média desde 2013 | Figura `#brasil-estoque` (linha da média como série fina) |
| Brasil: tabela dos últimos 12 meses | Tabela equivalente de `#brasil-saldo`, com os 72 meses da série (antes, 12) e o mês preliminar marcado |
| Seções: seletor de seção, gráfico seção x total com a média, frase da seção | Figura `#secoes`: `SerieEscolhida` (select, gráfico, frase com os mesmos campos) |
| Seções: tabela (10 colunas) em ordem crescente de z | TabelaDados na figura, mesma ordem, 9 colunas |
| Seções: minigráfico de 36 meses por linha e botão "gráfico" | Substituídos pelo seletor: a mesma série de 36 meses abre no gráfico e na tabela dele. Não há minigráfico na célula (o kit de tabela não tem) |
| Seções: cor verde/vermelha nos saldos | Removida de propósito (regra: cor não julga); o sinal fica no número |
| UFs: três ordens (saldo 12 m, retenção, saldo do mês) | `TabelaOrdenada`, os mesmos três botões |
| UFs: tabela (admissões, desligamentos, saldos, retenção, posições) com link para o estado | Mesmas colunas, posições em colunas próprias, link `/observatorio/states/<UF>` |
| UFs: minigráfico de 36 meses do saldo | Seletor de UF com gráfico do saldo mensal (36 meses) e frase da UF: ganho de leitura, mesmos dados |
| UFs: nota de retenção e conferência Ipeadata x SGS | "Como interpretar" e "Ressalva" da figura `#ufs`; acrescentado o `ufs_nao_identificado` da gold, que a vista antiga só citava no texto |
| Ponte para Estados | Link "painel Estados" depois da figura |
| Score: texto e barras de z por seção não agregada | Figura `#risco-setorial` (GraficoBarras, mesmas 18 seções, tabela equivalente) |
| Score: pesos 0,15 / 0,19 / 0,56 / 0,25 escritos à mão no app.js | Migrado em 10/11/2026, sem constante escrita à mão: os pesos não estão em `emprego.json`, mas estão na gold do próprio Risco setorial (`sectors.json`, `componentes.<id>.peso`: 0,5625, 0,25 e 0,1875, iguais nas 43 atividades, e peso zero para o estresse empresarial, em construção). A figura `#risco-setorial` os mostra em tabela (duas casas), com o que cada componente mede, a ressalva de que são escolha de método e não dado medido, e a frase do método da gold que traz os originais (0,45 / 0,20 / 0,15). O score por atividade não é exibido nem recalculado nesta página, como na vista antiga |
| Ponte para Risco setorial | Link depois da figura |
| Método: `D.metodo`, catálogo (5 linhas), limitações, cautelas, fontes com link e licença | Fatia método, tudo; catálogo em TabelaDados |
| Estado "painel indisponível" (`!D.disponivel`) | Página mínima com o motivo, sem número |

---

# Paridade: golpes-e-fraudes

Vista antiga: `fraudes` (`renderFraudes`, public/obs/app.js, linhas 8125 a 8407), `/observatorio/financial-fraud`. Página nova: `/divida-das-familias/golpes-e-fraudes`. Golds: `fraudes.json`, `pulse.json` (as mesmas).

| Bloco da vista antiga | Onde ficou | Observação |
|---|---|---|
| Cabeçalho, datas, selo de causalidade | Abertura e "Fontes, datas e siglas" | H1 é a pergunta já registrada em `observatorioAbas.ts` |
| Guia da página | Lead, limite e nota da faixa | |
| Legenda A a E | `LegendaGraus` na nota da faixa | |
| Síntese: 8 cartões + frase "nenhum cartão soma fontes" | Faixa (4 números, um por conceito, nenhum de imprensa) + capítulo `#sintese` com os 8 | A faixa traz um número de grau D (Febraban) e um de grau B (DataSenado), com o selo de grau e natureza "Estimado" e "Observado" |
| Cadeia fraude → crédito, com evidência por elo | Capítulo `#canais` | |
| Estelionato por ano (barras), conceito, nota de quebra | Figura `#dimensao` (GraficoBarras, em milhões), tabela com valores inteiros | |
| Devolução no MED: taxa oficial, acumulado de imprensa, quebra de método, ponte para o Pix | `#med` (dentro da figura): taxa, acumulado com a nota da gold, conceito, nota de quebra, link `/observatorio/pix` | "R$ 2,2 bi devolvidos (8,9%)" escrito à mão na vista antiga passou a vir da `nota` da gold; a âncora `#px-med` da ponte não foi mantida |
| Perdas reportadas pelos bancos (barras) | `#perdas-bancos` (tabela) | |
| Tentativas Serasa (barras) e incidentes no SFN (barras) | `#tentativas` e `#incidentes` (tabelas) | Períodos de duração diferente: a tabela diz que não formam série |
| Tipos de fraude (tabela) | Capítulo `#tipos` | A nota de cada tipo ganhou coluna própria |
| Quem é mais afetado: aviso, grupos, lacunas | Capítulo `#quem-sofre` | |
| Subnotificação: aviso, camadas, lacuna | `#subnotificacao` (no mesmo capítulo, como na vista) | |
| Explorador fraudes × crédito | Figura `#credito` (mesma peça do painel de apostas; janela desde jan/2019, marcos de fraude) | |
| Recuperação e mitigação | Capítulo `#mitigacao` | |
| Evidências e benchmarks | Capítulo `#evidencias` (recolhido) | |
| Linha do tempo | Capítulo `#linha-do-tempo` (recolhido) | |
| Metodologia e links de apoio | ParaLer (conceitos) + método; os links de apoio a vítimas saíram do fim do método e ficam à vista em `#med` | Mudança deliberada: a orientação "em caso de golpe" não fica recolhida |
| CSV, JSON, CSV do explorador | Método (CSV e JSON) e explorador (CSV do indicador) | |
| Subnavegação fixa e `fontePane` | Não migrados | Mesmos motivos do painel de apostas |

---

# Paridade: sancoes-e-reclamacoes

Vista antiga: `conduta` (`renderConduta`, public/obs/app.js, linhas 9341 a 9458), `/observatorio/conduct-enforcement`. Página nova: `/divida-das-familias/sancoes-e-reclamacoes`. Gold: `conduta.json` (a mesma).

| Bloco da vista antiga | Onde ficou | Observação |
|---|---|---|
| Cabeçalho, selos observado e calculado, fontes | Abertura, selo de natureza em cada número e figura | |
| Síntese determinística (`D.sintese`) | Nota da faixa de números, remontada dos campos da gold | A frase pronta da gold traz "R$ 72.3 milhões", "70.03 em 2026-3" (ponto decimal e período cru); a página não a exibe e escreve a mesma frase com os mesmos campos formatados |
| Placar de 5 números | Faixa com 4 (processos BCB, multas, inabilitados, processos CVM), cada um com o subtexto da vista; o 5º (índice mediano de reclamações) está na nota da faixa e na figura `#reclamacoes` | Teto de 4 números do molde |
| BCB ano a ano: linhas de decisões e inabilitações, linha de multas, tabela dos últimos 8 anos | Figuras `#bcb` (linhas) e `#bcb-multas` (barras), tabelas com os 14 anos | Multas por ano passaram de linha a barras; ano incompleto fora do gráfico e marcado "parcial" na tabela, como antes |
| Últimos 12 meses: barras de penalidade, frase de mediana, p90, PJ, PF e recurso | Figura `#bcb-12-meses` | O percentual com recurso repete a conta da vista antiga (recursos ÷ decisões) |
| Cobrança das multas (6 maiores situações, em barras) | `#cobranca`, tabela com as 9 situações, número e parcela | |
| Tempo citação → decisão; inabilitados por prazo (frase) | Texto e tabela recolhida de 21 prazos, com a coluna "encerram em 12 meses" | |
| CVM ano a ano (últimos 10), frase de duração | `#cvm-por-ano` (13 anos) e leitura da figura `#cvm` | |
| CVM fase atual (barras) e área instrutora (8 maiores, barras) | Figura `#cvm` (barras de fase) e tabela recolhida das 24 áreas | |
| Lista nominal com alternador BCB e CVM, caixa de rolagem | Capítulo `#recentes` (recolhido), `#recentes-bcb` (40) e `#recentes-cvm` (30), as duas no HTML, na ordem da gold | Sem alternador; nenhuma tabela ordenável (conferido por teste) |
| Reclamações: minigráfico, tabela dos últimos 8 trimestres em ordem inversa, nota, ponte para Instituições | Figura `#reclamacoes` (linha, tabela em ordem cronológica), link `/observatorio/institutions` | |
| Método, catálogo, cautelas, fontes com licença e nível | "Para ler esta página" e método | |
| CSV das decisões do BCB ano a ano | Na figura `#bcb` e no método | As três linhas de comentário `#` do CSV antigo viraram a coluna `fonte` |
| Estado "painel indisponível" | Página com ausência declarada (número sem valor, com o motivo da gold) | Ramo não exercitado pelo teste: a gold atual está disponível |
| Subnavegação fixa e `fontePane` | Não migrados | Mesmos motivos |
| `situacao_12m` da gold | Não usado | A vista antiga também não mostrava |
