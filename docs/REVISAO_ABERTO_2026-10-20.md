# Revisão das páginas abertas e do mapa logado, 20/10/2026

Pedido do dono: analisar todos os painéis sem sessão e o mapa inicial da área logada à luz das skills `emil-design-eng`, `impeccable` e `design-taste-frontend` (com a `observatorio-layout` prevalecendo em conflito), incorporar a marca do FGV CERI na página inicial e nos painéis de infraestrutura, com o link para o site do centro.

Decisões do dono registradas nesta rodada:

- Painéis "ligados a infraestrutura" que levam a marca do CERI: Setor Elétrico, Gás Natural, Saneamento e Combustíveis. Mobilidade e Conectividade (coleções da Eficiência Estatal) ficam fora.
- Texto ao lado da marca: "Parceria técnica".

## Método

- Servidor local (`next dev`), capturas em 1440, 768 e 390 px, primeira tela e página inteira, sem sessão nas rotas abertas e com sessão assinada no mapa `/app/observatorios`, na entrada `/observatorios/energia-e-infraestrutura` e em painéis de amostra. Script em uso próprio (Playwright do ambiente); as medidas são do DOM renderizado: altura total, linhas do H1, elementos fora da largura, textos abaixo de 12 px, imagens quebradas.
- As skills `impeccable` e `design-taste-frontend` estão versionadas sem os scripts (`ORIGEM.md` de cada uma): não rodaram `impeccable context`, `detect`, `draw`, `inspect` nem `lint`. Vale o caminho "launcher unavailable" / "no Chrome or Node 22" das próprias skills: contexto lido diretamente da `observatorio-layout`, crítica feita sobre as capturas com as rubricas de `references/critique.md` (quatro critérios, pesos 40/30/20/10) e `reference/critique.md` (heurísticas). Sem detector automático, as contagens de padrões (eyebrows, numeração, filetes) são de leitura do código.
- Rotas abertas cobertas (lista de `src/lib/rotasPublicas.ts`): `/`, `/en`, as seis portas `/perguntas/<observatório>`, os aperitivos `/setor-eletrico/conta-de-luz`, `/saneamento/municipio`, `/eficiencia-estatal`, `/gas-natural/gas-de-cozinha`, a apresentação `/observatorio-do-credito`, a consulta `/combustiveis/no-meu-estado`, `/sobre` e `/entrar`. Metodologias, glossários, `/aprenda`, termos e privacidade não foram capturados (páginas de leitura, fora do pedido "painéis").
- Não verificado: leitor de tela, teclado completo, zoom 200 %, modo escuro (a plataforma não o oferece). O build de produção não rodou neste ambiente (`src/tests/i18n-home-browser.test.ts` depende dele e fica para o CI).

## Conflitos entre as skills e o sistema da casa (registrados, não alterados)

A `design-taste-frontend` proíbe eyebrow (rótulo pequeno em caixa alta acima do título), numeração 01/02/03, filetes de 1 px, palavra de destaque colorida no título e texto abaixo de 12 px. O sistema da Scrutiniums usa todos eles como identidade: a classe `.rotulo` (11,5 px, caixa alta, espaçada) nomeia seções e metadados em toda a plataforma; as portas e as lâminas da home são numeradas; cada cartão leva um filete de 3 px na cor do observatório; os títulos da home destacam uma expressão em bronze. Pelo `ORIGEM.md` da skill, nesses pontos prevalece a `observatorio-layout`, e o conflito fica aqui registrado. Consequência prática: pela rubrica da `design-taste-frontend`, toda página da plataforma tem teto 6,5 em "overall" enquanto esses dispositivos existirem; a nota abaixo é dada **dentro** do sistema da casa, não contra ele. Decisão do dono, se quiser rever: trocar eyebrows por títulos que carregam a informação, tirar a numeração das portas e subir `.rotulo` para 12 px (no domínio Energia já é 12 px).

## Achados por página

Escala: `design · usabilidade · criatividade · conteúdo → geral`, de 1 a 10, pela rubrica de `critique.md` da `design-taste-frontend`, dentro do sistema da casa. "Visto em um segundo" é a primeira impressão da primeira tela em 1440.

### Página inicial `/` (sem sessão)

- Visto em um segundo: o título em serifa e a grade de seis perguntas com um número cada. A tarefa da página está clara em cinco segundos.
- Medidas: 3.498 px de altura em 1440 (3.737 depois desta rodada, com o bloco da parceria), 6.700 em 390 (7.088 depois). H1 em 2 linhas no desktop e 3 no celular. Nenhuma rolagem lateral da página; os 69 elementos "fora da largura" em 390 são as células da matriz de fontes dentro de `.tabela-scroll`, com rolagem só na tabela, como a skill pede.
- Pontos fortes: primeira tela responde ao leitor com seis números com fonte e período; nenhuma foto decorativa; blocos secundários recolhidos (decisão A9 da banca) e no HTML.
- Problemas:
  1. Dois heróis em sequência: depois das seis perguntas vem outra composição de rótulo, título em serifa com destaque em bronze, parágrafo e botão ("Da informação dispersa ao conhecimento verificável"). O leitor recebe duas promessas antes de qualquer caminho. Fica como decisão do dono (a segunda composição carrega a conta e o índice das coleções).
  2. O resumo recolhido "De onde vêm as respostas" era um rótulo solto de 11 px numa linha, destoando dos outros blocos recolhidos (título em serifa com o sinal de mais). **Corrigido nesta rodada.**
  3. O cabeçalho em 390 px ocupa três linhas (marca e botão, navegação, idioma): 150 px antes do conteúdo. Decisão de arquitetura do cabeçalho (achado A7 da banca), não mexida aqui.
  4. H1 em 3 linhas no celular ("Entenda o Brasil pelas perguntas que importam."): a regra das duas linhas só se cumpre com título de até 32 caracteres. Copy do dono; não alterado.
- Notas: 7 · 8 · 7 · 8 → **7,4**.

### Mapa logado `/app/observatorios`

- Visto em um segundo: título-slogan ("O Brasil, sob diferentes perspectivas.") e uma lista longa. A tarefa (escolher para onde ir) só fica clara no segundo bloco.
- Medidas: 5.166 px em 1440 e 9.024 px em 390 antes; 5.231 e 9.245 depois (índice novo). Energia e Infraestrutura começava a 2.300 px do topo no desktop.
- Problemas:
  1. O destino mais procurado ficava a rolagem de distância, sem índice: viola "destino mais procurado a um clique, à vista" (`observatorio-layout`, §4). **Corrigido:** faixa "Ir direto" com os seis observatórios como âncoras logo abaixo da abertura e, para quem já esteve num observatório ou coleção (cookie de último acesso), o botão "Continuar em …" que faz o mesmo POST dos cartões.
  2. Três chamadas por observatório (chips das coleções, botão "Entrar no Observatório…", link "Resumo aberto do observatório") mais o botão de cada cartão: quatro formas de ação na mesma seção. O "Resumo aberto" leva quem tem conta à página aberta, menos profunda do que a que ele já pode ver. Recomendação: retirar o "Resumo aberto" do mapa logado ou movê-lo para o fim da seção. Não alterado (decisão do dono).
  3. O H1 é slogan; o `<title>` da página diz "Escolha seu observatório", que é a tarefa. Recomendação: trazer a tarefa para o H1 ou para a primeira frase. Não alterado.
  4. Densidade desigual: Famílias e Território e Clima não têm cartões; Serviços Públicos, Contas Públicas, Energia e Economia têm dois ou três. A grade de dois cartões deixa Gás Natural sozinho numa linha (meia largura vazia). Recomendação: um cartão por coleção com entrada ou nenhum, e grade que feche (três por linha quando houver três). Não alterado.
  5. Marca do CERI no observatório de infraestrutura: **feito**, compacta, sob a pergunta da seção Energia e Infraestrutura.
- Notas (rubrica de app screen, `references/app-screens.md`): a pergunta da tela é "para onde vou?", e a resposta agora está na primeira tela; o restante segue como estava. Heurísticas de Nielsen que mais pesam: reconhecimento (3/4 depois do índice, 2/4 antes), consistência (3/4), estética e minimalismo (2/4 pelos quatro tipos de chamada).

### Portas `/perguntas/<observatório>` (seis páginas)

- Visto em um segundo: trilha, rótulo do observatório, pergunta como H1 e três números com fonte, período e ressalva. Melhor primeira tela da camada aberta.
- Medidas: 3.347 a 3.876 px em 1440; 6.885 a 7.976 em 390. H1 em 2 linhas no desktop e 3 a 4 no celular (perguntas de 45 a 57 caracteres). Entre 27 e 36 textos abaixo de 12 px por página (todos `.rotulo` e os selos "com conta").
- Pontos fortes: cada número com fonte, período e nota; "Para o seu caso" com as consultas abertas; "No painel completo" com o selo "com conta" antes do clique; "O que ainda não respondemos" declara ausência em vez de inventar.
- Problemas:
  1. O selo "com conta gratuita" ao lado do rótulo da coleção em "No painel completo" tem 10 px: abaixo do piso de 12 px da própria `observatorio-layout` fora do domínio Energia. Recomendação: subir `.rotulo` e `SeloComConta` para 12 px na plataforma inteira (hoje só `.dominio-energia .rotulo` tem 12 px). Mudança de sistema; não feita nesta rodada.
  2. Em 390 px, a trilha "Os seis observatórios / …", o rótulo com filete, o H1 de quatro linhas e o parágrafo somam mais de uma tela antes do primeiro número. Recomendação: no celular, parágrafo depois dos números. Não alterado.
  3. Os cinco cartões de "Outras perguntas" no fim repetem a composição da home em versão menor (mesmo layout duas vezes na jornada). Aceitável como navegação; registrado.
- Notas: 8 · 8 · 7 · 9 → **7,9**.

### Aperitivo Conta de luz `/setor-eletrico/conta-de-luz`

- Visto em um segundo: pergunta clara, três controles, estado vazio honesto ("Escolha o município ou a distribuidora para ver a estimativa").
- Medidas: 1.777 px em 1440, 3.132 em 390 (agora 1.826 e 3.173 com a faixa da parceria). Um texto abaixo de 12 px.
- Problemas:
  1. No estado vazio, o bloco "Estimativa mensal" já mostra bandeira, data da tarifa e fonte em três colunas antes de haver estimativa: metadado sem número. Recomendação: mostrar bandeira, data e fonte junto com o resultado, e no estado vazio só a frase. Não alterado (contrato de dado do módulo; precisa de teste próprio).
  2. O cabeçalho do módulo tem quatro faixas (barra comum, grupos, páginas do grupo, agora a parceria): 245 px de chrome em 1440. A faixa da parceria foi desenhada no mínimo (44 a 52 px, alinhada à direita, sem fundo). Se o dono preferir, ela cabe no fim da página; a decisão de colocá-la no cabeçalho é para a marca estar à vista em "todos os painéis", como pedido.
- Notas: 8 · 8 · 7 · 8 → **7,8**.

### Aperitivo Saneamento `/saneamento/municipio`

- Visto em um segundo: pergunta, recorte, um campo de busca. A metade direita da tela fica vazia do campo até o convite (hole, não rest).
- Medidas: 1.705 px em 1440 (1.754 depois), 3.052 em 390. H1 em 3 linhas no celular.
- Problemas:
  1. Metade direita vazia na área de busca em 1440. Recomendação: ao lado do campo, três exemplos clicáveis de municípios (capitais) ou o número que a página já tem (5.571 municípios) como figura. Não alterado.
  2. O convite lista 14 itens em duas colunas: mais longo que o conteúdo aberto. É o contrato do aperitivo; registrado.
- Notas: 7 · 8 · 6 · 8 → **7,2**.

### Aperitivo Minha capital `/eficiencia-estatal`

- Visto em um segundo: herói escuro com grade de fundo, pergunta e seletor; depois quatro resultados com posição entre as 26 capitais.
- Problemas:
  1. A grade de fundo do herói é decoração sem função (padrão de linhas). Recomendação: fundo chapado. Não alterado.
  2. Quatro números em verde-azulado de 44 px com a caixa "Posição" em tom claro: a composição funciona, mas é a única página aberta com herói escuro (as demais usam marfim). Consistência entre aperitivos: decisão do dono.
- Notas: 7 · 8 · 7 · 9 → **7,6**.

### Aperitivo Gás de cozinha `/gas-natural/gas-de-cozinha`

- Visto em um segundo: pergunta, seletor de estado, o preço médio do Brasil em destaque (R$ 114,33, set/2026, 14.167 revendas).
- Problemas:
  1. O título "Botijão de 13 kg no Brasil, setembro de 2026" leva uma régua azul decorativa de 2 px sob o texto, sem função. Recomendação: retirar. Não alterado.
  2. Texto de método (três parágrafos) antes do convite, na área aberta: bom para credibilidade, mas é a página aberta mais textual. Registrado.
- Notas: 8 · 8 · 7 · 8 → **7,8**.

### Consulta Combustíveis `/combustiveis/no-meu-estado`

- Visto em um segundo: faixa "Consulta aberta, sem conta", pergunta, dois controles, quatro preços com menor e maior da pesquisa e a conta do tanque.
- Problemas:
  1. A faixa de aviso no topo mais a navegação da coleção empurram a pergunta para 250 px no desktop. É o contrato da leva 2 (`AvisoConsultaAberta`); registrado.
  2. A nota do diesel ("segundo a ANP, hoje o produto é o óleo diesel B S500 comum") faz o terceiro cartão mais alto que os outros três: linha irregular de cartões (`ragged-row`). Recomendação: nota abaixo da grade, não dentro de um cartão. Não alterado.
- Notas: 8 · 8 · 7 · 9 → **7,9**.

### Apresentação do Crédito `/observatorio-do-credito`

- Visto em um segundo: título em serifa com "Crédito" em bronze, quatro números de escala com fonte e data, dois botões.
- Medidas: 4.785 px em 1440 e 9.435 em 390: a página aberta mais longa. 38 textos abaixo de 12 px.
- Problemas:
  1. Nove seções em sequência (escala, para o seu caso, painel completo, o que dá para responder, diagnóstico, o que muda, coleta diária, conta, rodapé) com o mesmo padrão de rótulo e título: sameness, e comprimento acima do dobro das outras páginas abertas. Recomendação: recolher "O que muda em relação a consultar as fontes direto" e "Coleta diária" como na home. Não alterado (página de referência do dono; mudança de arquitetura).
  2. "Atualização atrasada" aparece numa caixa com borda bronze: estado documentado, correto.
- Notas: 7 · 7 · 7 · 9 → **7,2**.

### Sobre `/sobre` e Entrar `/entrar`

- `/sobre`: sete seções numeradas (01 a 07), coluna única, texto completo e verificável; cumpre a tarefa. Numeração é padrão da casa. Nota 7 · 9 · 6 · 9 → **7,6**.
- `/entrar`: cartão centrado com borda, dois campos, botão preto, alternativa por SMS. Funcional; única página com cartão sombreado leve. Nota 7 · 9 · 6 · 8 → **7,4**.

## O que mudou nesta rodada

1. **Marca do FGV CERI** (`src/components/layout/ParceriaTecnica.tsx`, `src/lib/parceiros.ts`, `public/home/parceiros/`):
   - arquivos oficiais do kit "Marca_CERI_Endosso" (EPS do Illustrator, 02/05/2019) convertidos sem redesenho com Ghostscript e pdftocairo; só o lockup colorido e o de fundo escuro foram publicados, os cinco EPS ficam registrados por sha256 em `manifesto.json`;
   - a pasta `/home` é aberta, por isso a marca carrega sem sessão;
   - link para `https://ceri.fgv.br/` em nova aba, alt com o nome por extenso;
   - home: faixa "Parceria técnica" no fim da primeira seção (depois de "De onde vêm as respostas", antes do segundo herói), com a frase que diz onde a marca aparece. Em português nas duas homes: o contrato da home inglesa (`src/tests/suporte/i18n-home.ts`) fixa as quatro seções do `<main>` e as dez regiões, então a faixa vive dentro da região portuguesa das perguntas; na faixa dos cabeçalhos do Setor Elétrico em inglês o rótulo e o alt saem em inglês (a fundação pela sigla, porque o detector de português sem marca lê "Fundação" como vazamento);
   - painéis de infraestrutura: faixa no fim do cabeçalho de `CabecalhoEnergia`, `CabecalhoGas`, `Cabecalho` (Saneamento) e `CabecalhoCombustiveis`, o que cobre painel completo e aperitivo (122 páginas, pelo grep de uso dos quatro cabeçalhos);
   - entrada `/observatorios/energia-e-infraestrutura` e seção Energia e Infraestrutura do mapa logado: versão compacta;
   - teste `src/tests/parceria-ceri.test.ts`: manifesto confere com os arquivos (sha256, bytes, rota aberta), SVG só com desenho, link e alt no componente, presença nos quatro cabeçalhos, na home, na entrada e no mapa, e ausência nos demais cabeçalhos.
2. **Mapa logado**: índice "Ir direto" e "Continuar em …" (`src/app/app/(foco)/observatorios/page.tsx`, `escolha.module.css`).
3. **Home**: resumo "De onde vêm as respostas" no mesmo desenho dos outros blocos recolhidos (`src/components/home/HeroPerguntas.tsx`).
4. `docs/i18n/cobertura.json` regenerado.

Limite conhecido da marca: o kit recebido só tem o lockup de endosso (nome do centro em três linhas pequenas). Abaixo de uns 60 px de altura essas linhas viram textura; "FGV CERI" continua legível e o alt diz o nome completo. Na faixa dos cabeçalhos a marca tem 32 px no celular e 36 px em tela larga. Se o CERI fornecer o símbolo isolado, ele substitui a faixa sem mudar o resto.

## Decisões pendentes do dono

1. Sistema: eyebrows, numeração, filetes, destaque colorido e `.rotulo` abaixo de 12 px fora da Energia (conflito com a `design-taste-frontend`).
2. Mapa logado: retirar "Resumo aberto" para quem tem conta; H1 com a tarefa; grade dos cartões que feche.
3. Home: manter ou fundir os dois heróis.
4. Aperitivos: consistência do herói escuro da Minha capital; metade vazia do Saneamento; metadado no estado vazio da Conta de luz; régua decorativa do Gás; nota do diesel fora do cartão.
5. Crédito aberto: recolher duas seções.
6. `/sobre`: a seção "Financiamento" diz "sem financiamento externo, patrocínio ou publicidade"; a parceria técnica não é financiamento, mas uma linha "Parcerias técnicas: FGV CERI" em `config/institucional.json` (com par em inglês) deixaria a home e o Sobre coerentes. O teste `institucional.test.ts` trava os campos decididos em 14/10/2026; precisa de decisão para abrir um campo novo.
