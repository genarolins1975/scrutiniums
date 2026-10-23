# Avaliação das páginas: acessibilidade e responsividade

Registro exigido pelo `PLANO_IMPLEMENTACAO.md` (notas abaixo de 9 e verificações por página). Primeira rodada: 19/10/2026, Onda 1 da banca (`docs/BANCA_2026-10-19.md`).

## Como foi medido

- Aplicativo local (`next dev`) no branch da Onda 1, com sessão de desenvolvimento nas páginas com conta e sem sessão nas abertas.
- **axe-core 4.12** com as regras WCAG 2.0 e 2.1, níveis A e AA, na tela de 1440 px.
- **Teclado:** 40 tabulações a partir do topo; para cada foco, conferido se há indicação visível (contorno, sombra ou sublinhado) e se o foco avança sem armadilha.
- **Reflow e zoom de 200%:** rolagem horizontal medida a 1440 px, a 720 px com fator de escala 2 (equivalente a 200% em 1440) e a 390 px.
- **Não verificado nesta rodada:** leitor de tela (NVDA, VoiceOver ou TalkBack) e ampliação de texto isolada. A verificação automática não comprova conformidade integral.

## Resultado

| Página | Acesso | axe (violações) | Rolagem horizontal 1440 / 200% / 390 | Foco visível nas 40 tabulações |
|---|---|---|---|---|
| `/` | aberta | 0 | 0 / 0 / 0 | sim |
| `/perguntas/familias` | aberta | 0 | 0 / 0 / 0 | sim |
| `/observatorio-do-credito` | aberta | 0 (8 de contraste corrigidas nesta rodada) | 0 / 0 / 0 | sim |
| `/setor-eletrico/conta-de-luz` | aberta | 0 | 0 / 0 / 0 | sim |
| `/saneamento/municipio/2611606` | aberta | 0 | 0 / 0 / 0 | sim |
| `/saneamento/preco-regulado/simulador` | aberta | 0 | 0 / 0 / 0 | sim |
| `/eficiencia-estatal` | aberta | 0 | 0 / 0 / 0 | sim |
| `/gas-natural/gas-de-cozinha` | aberta | 0 | 0 / 0 / 0 | sim |
| `/territorio/metodologia` | aberta | 0 | 0 / 0 / 0 | sim |
| `/setor-eletrico` | com conta | 0 | 0 / 0 / 0 | sim |
| `/gas-natural` | com conta | 0 | 0 / 0 / 0 | sim |
| `/saneamento` | com conta | 0 | 0 / 0 / 0 | sim |
| `/contas-publicas` | com conta | 0 | 0 / 0 / 0 | sim |
| `/agronegocio` | com conta | 0 | 0 / 0 / 0 | sim |
| `/territorio` | com conta | 0 | 0 / 0 / 0 | sim |
| `/observatorio/map` (Crédito) | com conta | 0 | 0 / 0 / 0 | sim |
| `/eficiencia-estatal/indice-de-resultados` | com conta | 0 | 0 / 0 / 0 | sim |
| `/territorio/queimadas` | com conta | 0 | 0 / 0 / 0 | sim |

Correção feita: os rótulos das áreas na página aberta do Crédito e as categorias de sugestão no admin usavam bronze (`#966B48`) em texto pequeno sobre papel, abaixo de 4,5:1; passaram a bronze escuro (`#7C5638`).

## Para você, Onda 2

Rodada de 19/10/2026 do item "Caminho Para você em cada entrada" da Onda 2 (`docs/BANCA_2026-10-19.md`), pela checklist da página de entrada da skill (seção 4). O bloco é um componente único (`src/components/observatorios/ParaVoce.tsx`) com a lista central em `src/lib/observatorios/paraVoce.ts`; o teste `src/tests/para-voce.test.ts` reprova entrada sem o bloco, destino inexistente em `src/app`, número sem fonte ou período (ou lido de outra página que não o destino) e link fechado sem o selo "com conta" numa entrada aberta.

**Como foi medido.** `next dev` local (porta 3105) no branch do pacote, Playwright com Chromium, 1440 e 390 px, com sessão de desenvolvimento (cookie assinado) e sem sessão. Em cada rota: posição do topo do bloco, rolagem horizontal da página, cartões, números e selos dentro do bloco e axe-core 4.12 (WCAG 2.0 e 2.1, A e AA) restrito ao bloco a 1440 px. Capturas em `/tmp/q5-capturas` (tela inicial e recorte do bloco). Leitor de tela não verificado nesta rodada.

**Sem sessão.** As onze entradas com conta levam ao login com o destino preservado (`/entrar?de=...`; a irmã inglesa a `/en/entrar`); nenhuma mostra o bloco a quem não entrou. A única entrada aberta, `/eficiencia-estatal`, mostra o bloco com o selo "com conta" nos dois destinos fechados e sem selo no destino aberto, nas duas larguras.

| Entrada | Perguntas e destinos | Topo do bloco 1440 / 390 px | Rolagem horizontal | axe no bloco | Item 1: números na primeira tela | Item 2: destino a um clique | O que falta |
|---|---|---|---|---|---|---|---|
| `/setor-eletrico` (e `/en/setor-eletrico`) | Conta de luz → `/setor-eletrico/conta-de-luz` (aberta); falta de luz → `/setor-eletrico/qualidade`; Tarifa Social → `/setor-eletrico/inclusao-energetica/tarifa-social` | 1.121 / 1.595 | não | 0 | passa (três medidas com fonte e período) | passa: substitui os dois cartões "Qual pergunta você quer responder?"; inglês com destinos `/en` | o bloco fica abaixo da gravura de abertura, fora da primeira tela a 1440 px; a gravura `conta-gravura-v1.webp` saiu da entrada e o arquivo ficou sem uso (decisão do dono) |
| `/gas-natural` | Botijão → `/gas-natural/gas-de-cozinha` (aberta); GNV → `/gas-natural/gnv-e-gas-encanado` | 533 / 580 | não | 0 | parcial: os "Números para começar" ficam abaixo do fluxo; o bloco traz o botijão e o GNV na primeira tela | passa | levar os números de abertura para antes do fluxo |
| `/saneamento` | Município → `/saneamento/municipio` (aberta, sem número: busca); conta de água → `/saneamento/preco-regulado/simulador` (aberta); tarifa social → `/saneamento/tarifa-social` | 857 / 1.453 | não | 0 | passa | passa | a busca do município segue também na abertura, de propósito (busca no topo, ficha no cartão) |
| `/eficiencia-estatal` (aberta) | Escolas da capital → `/eficiencia-estatal/educacao-municipal-capitais`; saúde da capital → `/eficiencia-estatal/saude-capitais`; município → `/saneamento/municipio` (aberta) | 999 / 2.030 | não | 0 | passa (retrato da capital) | passa; selo "com conta" nos dois fechados, sem sessão | a 390 px o bloco vem depois do retrato inteiro (cerca de duas telas e meia) |
| `/contas-publicas` | Contas do estado → `/contas-publicas-estaduais`; despesa federal → `/contas-publicas/panorama`; metas → `/contas-publicas/metas` (sem número: consulta) | 1.035 / 1.632 | não | 0 | passa | passa: substitui o tríptico de caminhos, com os mesmos destinos e o do estado | a gravura do tríptico (`federal-gravura-v1.webp`) saiu da entrada (decisão do dono) |
| `/agronegocio` | Comida em casa → `/agronegocio/prato`; produção do estado → `/agronegocio/atlas` (sem número: exploração) | 783 / 1.456 | não | 0 | passa | passa | só duas perguntas: o agro tem pouca consulta pessoal publicada |
| `/observatorios/familias` | Conta de luz, botijão e conta de água (as três abertas) | 959 / 1.756 | não | 0 | passa | passa | "Quanto meu banco cobra?" entra quando o pacote Q1 for integrado |
| `/observatorios/servicos-publicos` | Capital → `/eficiencia-estatal` (aberta, sem número: consulta); escolas e saúde da capital | 996 / 1.801 | não | 0 | passa | passa | nada |
| `/territorio` (Território e Clima) | Fogo → `/territorio/queimadas`; desastres → `/territorio/desastres`; consulta de focos por município embutida no bloco | 970 / 1.726 | não | 0 | passa | passa: a seção "Teve fogo perto de você?" virou parte do bloco | os dois destinos também aparecem em "Os painéis do observatório", que é o índice completo |
| `/observatorios/contas-publicas` | Contas do estado, despesa federal e metas | 970 / 1.789 | não | 0 | passa | passa | nada |
| `/observatorios/energia-e-infraestrutura` | Conta de luz, município (Saneamento) e botijão (os três abertos) | 970 / 1.726 | não | 0 | passa | passa | nada |
| `/observatorios/economia` | Atraso das famílias → `/observatorio/credit`; comida em casa → `/agronegocio/prato` | 951 / 1.704 | não | 0 | passa | passa | "Quanto meu banco cobra?" e o simulador da parcela (pacote Q1) não existem neste branch; entram na integração |

Itens 3 a 7 da checklist não mudaram nesta rodada: o artefato didático, a busca e os caminhos por pergunta, o método recolhido e as imagens de cada entrada seguem como na Onda 1. Os números dos cartões são lidos pelos mesmos leitores dos destinos (camada aberta, sinais da inicial do Setor Elétrico, respostas dos capítulos do Saneamento e entrada do Território); na rodada todos vieram publicados, nenhum como indisponível.

## Setor Elétrico: didatismo, Onda 3

Rodada de 20/10/2026 do item da Onda 3 "Setor Elétrico: elevar o didatismo das páginas com nota 5,5 a 6,0 (Carga, Rede, Território)" (`docs/BANCA_2026-10-19.md`), critério de aceite "nenhuma página abaixo de 8 em didatismo". **É autoavaliação, feita por quem fez a mudança; não é revisão independente.** A revisão independente das entradas pela rubrica continua como item próprio da Onda 3.

**Escopo.** As oito páginas dos três módulos, não só as três entradas, porque as duas notas de 5,5 eram de páginas filhas: `/setor-eletrico/carga`, `/carga/clima-e-calendario`, `/carga/perfil-horario`, `/setor-eletrico/rede`, `/rede/balanco-e-exterior`, `/rede/programado`, `/rede/restricoes` e `/setor-eletrico/territorio`.

**Como foi medido.** `next dev` local (porta 3143), Playwright com Chromium, 1440 e 390 px, com sessão de desenvolvimento, antes e depois, página inteira e texto de `main`; recortes dos blocos novos nas duas larguras; `/en` de Rede e Minha região. Diagnóstico pela rubrica da skill (§10) e pelas observações da rodada r9 do instrumento de avaliação do Setor Elétrico (`docs/observatorios/energia/avaliacao/revisao_visual.json`, revisores agentes do próprio instrumento). Nenhuma página com rolagem horizontal, nas duas larguras, antes e depois. Leitor de tela e ampliação de texto isolada não verificados.

**O que derrubava a nota (r9).** Pergunta sem resposta na abertura (Minha região abria com "Escolha uma região" e o painel "Nenhuma escolha"); unidades e conceitos sem explicação no ponto de uso (MW, MWh e MWmed; carga contra geração; regime do ONS; balanço, perímetro, resíduo e tolerância; programado, verificado, percentis e limiar; ATLS, banda morta e energia não suprida; log × 100, fora da amostra, erro absoluto médio e referência ingênua; submercado, SIN e conjunto elétrico); gráficos principais sem frase de leitura; cartões da energia escondida com o nome da fronteira no sentido contrário ao do saldo; duas taxas de carga lado a lado sem dizer qual usar.

**O que mudou para o leitor.**

- Peças comuns (`src/components/energia/Didatica.tsx`): `ParaLer` (glossário no ponto de uso, cada termo em uma ou duas frases e, quando há, um exemplo calculado da gold da página), `LeituraGuiada` (uma frase factual sob o gráfico, do mesmo contrato do gráfico, sem causa) e `ModeloDidatico` (moldura do artefato, com o selo "Modelo didático", o que o modelo deixa de fora e a fonte dos números).
- Carga: a abertura responde com o número (média em MWmed dos 7 dias, a energia por dia em MWh e a variação contra os mesmos dias da semana); glossário de MW, MWh, MWmed (com a conversão dos 7 dias), carga contra geração, SIN e subsistemas e regime do ONS; modelo didático "Potência e energia num dia" (`HorasDoDia`): as 24 horas de um dia real da curva horária, com a soma (MWh), a média (MWmed), o pico e a hora mais baixa, escolha do dia e da hora, tabela das 24 horas e a comparação com a Carga de Energia Diária do mesmo dia; leitura guiada do gráfico de pontos e da série diária (o domingo como vale da semana, contado nas últimas 13 semanas completas); a frase sob a faixa diz qual das duas taxas é a principal.
- Clima e calendário: a abertura responde "Uma parte", com a diferença em pontos e em %, a parte do clima e calendário, a de nível e tendência e o resíduo; glossário de pontos (log × 100), modelo estatístico, fora da amostra, erro absoluto médio (com a referência ingênua), resíduo e intervalo de 80% (com a cobertura do SIN); modelo didático "Peça por peça" (cascata da diferença por região); leitura guiada do gráfico de partes, que diz que barra perto de zero não é falta de dado.
- Perfil horário: glossário de MMGD (com a parcela do último mês), carga global e líquida, curva de carga e Carga de Energia Diária, pico e hora de início (com a hora modal do ano).
- Rede: a abertura responde com a maior entrega dos 30 dias e quantas fronteiras tiveram energia nos dois sentidos; glossário de subsistema e fronteira, intercâmbio, fluxo bruto e saldo (com o exemplo da fronteira que mais escondeu), MWmed numa hora, sentido do nome e limite de transmissão; modelo didático "Ida e volta numa fronteira" (fluxo hora a hora, quatro fronteiras e sete dias, somas de cada sentido lidas da gold diária, saldo e energia escondida); leitura guiada do gráfico diário dos dois sentidos; os cartões da energia escondida nomeiam a fronteira sem sentido ("entre Norte e Nordeste").
- Balanço e exterior: a abertura responde "Quase sempre", com as horas em que a conta do SIN fecha e o ano das que não fecham; glossário de balanço, conta 1, conta 2, resíduo e tolerância, exterior e MWmed numa hora; modelo didático "A conta de uma região" (último mês completo, cinco regiões, com o mês de maior resíduo).
- Programado: glossário de programado, verificado, desvio, percentis, limiar material e sinal negativo, com o desvio médio em proporção do programa mediano e o maior desvio com sentido invertido.
- Restrições: glossário de fluxo acompanhado e limite, ATLS e banda morta (com os trechos conferidos do Submódulo 9.1), corte de carga e perturbação, energia não suprida (com os números de 12 meses) e limite de intercâmbio.
- Minha região: a abertura responde com um caso real (PLD do submercado e tarifa da distribuidora da maior cidade do primeiro submercado, cada um com a área a que vale); leitura guiada do mapa (UFs por submercado e municípios fora do SIN); modelo didático "Um endereço, várias áreas" (a maior cidade de cada submercado em caixas aninhadas: submercado, distribuidoras, conjuntos elétricos e município, com link para a ficha completa); glossário de SIN, submercado, distribuidora, conjunto elétrico, DEC e FEC e PLD contra tarifa.

Nenhum número foi escrito à mão: todos saem das golds e séries publicadas (`carga_detalhe.json`, `carga.json`, `rede_detalhe.json`, `rede_janela_horaria.json`, `territorio.json`, `territorio_municipios.json`); as datas de regime e de quebra também. O método continua recolhido (Fontes, datas e siglas; Analisar e Auditar).

**Notas por critério (§10).** "Antes" de Didática visual é a nota de didatismo da r9; os demais "antes" são leitura retroativa desta rodada sobre as capturas antigas, também autoavaliação.

| Página | Direção de arte | Hierarquia | Tipografia e acabamento | Densidade e profundidade | Didática visual | Comparabilidade | Interação e acessibilidade | Responsividade |
|---|---|---|---|---|---|---|---|---|
| `/setor-eletrico/carga` | 8 → 8 | 7,5 → 8 | 7 → 7,5 | 8 → 8 | 7,5 → 8,5 | 8 → 8,5 | 8 → 8 | 6,5 → 7 |
| `/carga/clima-e-calendario` | 7,5 → 8 | 7 → 8 | 7 → 7,5 | 7 → 8 | 5,5 → 8 | 7,5 → 8 | 8 → 8 | 7 → 7,5 |
| `/carga/perfil-horario` | 7,5 → 7,5 | 7 → 7,5 | 6,5 → 6,5 | 7,5 → 8 | 7 → 8 | 8 → 8 | 8 → 8 | 6 → 6 |
| `/setor-eletrico/rede` | 8 → 8,5 | 7,5 → 8 | 7,5 → 7,5 | 8 → 8 | 7,5 → 8,5 | 7,5 → 8,5 | 8 → 8 | 7 → 7,5 |
| `/rede/balanco-e-exterior` | 7 → 7,5 | 6,5 → 8 | 6,5 → 6,5 | 7 → 8 | 5,5 → 8 | 7,5 → 8 | 8 → 8 | 6,5 → 6,5 |
| `/rede/programado` | 7,5 → 7,5 | 7 → 7,5 | 7 → 7 | 7 → 7,5 | 6,5 → 8 | 7,5 → 8 | 8 → 8 | 6,5 → 6,5 |
| `/rede/restricoes` | 7,5 → 7,5 | 7 → 7,5 | 7 → 7 | 7,5 → 8 | 6,5 → 8 | 8 → 8 | 8 → 8 | 7 → 7 |
| `/setor-eletrico/territorio` | 7,5 → 8 | 6 → 8 | 7 → 7,5 | 7 → 8,5 | 6 → 8,5 | 8,5 → 9 | 8 → 8 | 7 → 7,5 |

Critério de aceite: atendido na autoavaliação (nenhuma página abaixo de 8 em Didática visual). Nenhuma página chega a 9 em todos os critérios.

**Evidência e limitação remanescente por página.**

| Página | Evidência | Limitação remanescente |
|---|---|---|
| Carga | Abertura com "83.771 MWmed nos 7 dias até 28/09/2026: 2.010.504 MWh por dia, 11,45% acima"; glossário com "83.771 MWmed durante 7 dias (168 horas) são 14.073.545 MWh"; artefato com 2.133.939 MWh, média de 88.914 MWmed e pico de 98.741 MW às 19h em 28/09/2026; leitura "o dia de menor carga do SIN foi o domingo em" 12 das últimas 13 semanas completas | A 390 px, as marcas do eixo do gráfico de pontos ainda se encostam e os rótulos das linhas são cortados (r9); "Últimos 28 dias" e "Mês corrente" repetem a mesma janela quando o mês tem 28 dias publicados (a página diz isso abaixo do gráfico) |
| Clima e calendário | Abertura "Uma parte", com +10,49 pontos (+11,06%), +2,53 de clima e calendário, +2,65 de nível e tendência e +5,32 de resíduo; cascata por região; leitura que explica as barras perto de zero | O seletor de seis variantes do modelo continua em Entender; a 390 px, o rótulo "Nível e tendência" do gráfico de partes segue truncado (r9) |
| Perfil horário | Glossário com a parcela de MMGD do último mês e a hora modal do pico | O gráfico dos últimos 7 dias segue sem marca de dia e o mapa de calor das horas do pico é cortado a 390 px (r9); nenhuma leitura guiada nova nesta página |
| Rede | Abertura com a maior entrega de 30 dias (3.492.734 MWh do Nordeste para o Sudeste/Centro-Oeste); artefato com 51.257 MWh do Sul para o Sudeste/Centro-Oeste e 25.729 MWh de volta em 29/09/2026, saldo de 25.528 MWh; os quatro cartões da energia escondida sem sentido no nome | A linha do saldo e a de Sul para Sudeste/Centro-Oeste ainda quase coincidem no gráfico diário; o submenu do módulo continua empilhado a 390 px |
| Balanço e exterior | Abertura "Quase sempre": 47.880 de 50.352 horas; artefato com as duas contas de ago/2026 por região e o mês de maior resíduo | Rótulos das barras empilhadas seguem truncados a 1440 e 390 px e a anotação do gráfico de resíduo mensal é cortada a 390 px (r9) |
| Programado | Glossário com o desvio médio de 914,4 MWmed como 36% do programa mediano da fronteira Norte → Nordeste e o maior desvio com sentido invertido | A seção "Os maiores desvios horários" continua só com o botão em Entender; rótulos de fronteira truncados a 390 px |
| Restrições | Glossário com os trechos conferidos do Submódulo 9.1 (10 minutos e banda morta) e 30.734,6 MWh em 343 registros de 277 perturbações | As siglas FBTA, FNS+NESE e FJUSC continuam sem definição em documento público conferido; a barra parcial de 2026 tem a mesma cor das completas |
| Minha região | Abertura com São Paulo (SP): PLD de R$ 135,25/MWh em 30/09/2026, o mesmo para 10 UFs, e tarifa da ELETROPAULO de R$ 789,38/MWh, a mesma para 24 municípios; artefato com as quatro maiores cidades por submercado, em caixas aninhadas; leitura do mapa | A camada padrão do mapa continua "Submercados"; o painel "Nenhuma escolha" ao lado do mapa continua alto e vazio a 1440 px; o HTML da página ficou maior (os quatro exemplos ficam no servidor) |

**Testes que mudaram de propósito.** `energia-rede.test.ts` e `energia-conteudo-r8-R.test.ts`: o rótulo do cartão da energia escondida passa a ser "entre Norte e Nordeste" (`entreFronteira`); a ordem "definição antes dos cartões" continua exigida. `energia-territorio.test.ts`: a abertura troca o enunciado da regra por um caso real; continua exigido que a regra apareça uma vez, que o limite ("Não permite concluir") fique à vista e, em `energia-conteudo-r8-T1.test.ts` (sem mudança), que a busca fique a menos de 2.000 caracteres do título.

**Capturas.** Antes e depois em `/tmp/claude-0/-home-user-scrutiniums/edbbf738-1d91-5b76-9c6e-d438c08d2fb4/scratchpad/onda3-energia/` (`antes/` e `depois/`, dobra e página inteira a 1440 e 390 px), fora do repositório.

## Molde único de entrada, Iniciativa 4

Rodada de 22/10/2026 da Iniciativa 4 do parecer de UX (`EntradaColecao`, `NumeroEscala`, `ModeloDidatico`, `SeloProntidao`, `Recolhido`), uma linha por entrada migrada. Medido no build de produção (`next start`) com sessão de teste: altura total e topo do primeiro número por `scripts/ux-medidas.mjs`, axe-core 4.12 (WCAG 2.0 e 2.1, A e AA) a 1440 px e rolagem horizontal a 1440 e 390 px. Notas da rubrica (seção 10 da skill observatorio-layout) na ordem: direção de arte, hierarquia, tipografia, densidade, didática, comparabilidade, interação e acessibilidade, responsividade. Autoavaliação, não revisão independente; leitor de tela não verificado.

| Entrada | PR | Altura 1440 / 390 (antes → depois) | 1º número 1440 / 390 | axe · rolagem | Rubrica | Limitação remanescente |
|---|---|---|---|---|---|---|
| `/observatorios/familias` | 1 | 5.802 → 6.003 / 11.390 → 10.988 | 580 / 582 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | A 390 px fica a 12 px do orçamento de 11.000; o modelo didático é a fatia mais alta (cerca de 3.000 px) |
| `/observatorios/servicos-publicos` | 1 | 4.953 → 5.147 / 10.624 → 10.503 | 580 / 617 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | O título ocupa quatro linhas a 390 px |
| `/observatorios/contas-publicas` | 1 | 5.231 → 5.446 / 10.283 → 10.214 | 552 / 556 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | Nenhuma nova |
| `/observatorios/energia-e-infraestrutura` | 1 | 5.067 → 5.279 / 10.218 → 9.745 | 551 / 590 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | Nenhuma nova |
| `/observatorios/economia` | 1 | 5.219 → 5.414 / 10.879 → 10.517 | 524 / 504 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | Nenhuma nova |
| `/territorio` | 2 | 5.607 → 5.574 / 11.733 → 10.998 | 569 / 549 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | A 390 px fica 2 px abaixo do orçamento; o H1 tem 53 caracteres e ocupa três linhas no celular |
| `/combustiveis` | 2 | 9.377 → 6.045 / 14.901 → 10.852 | 569 / 531 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | Nenhuma nova |
| `/conectividade` | 2 | 10.292 → 5.714 / 16.067 → 9.901 | 569 / 531 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | Nenhuma nova |
| `/educacao-municipal` | 2 | 7.178 → 4.923 / 10.659 → 8.016 | 533 / 539 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | O laboratório do Ideb usa os números das redes municipais do Brasil; o do município continua no resultado da consulta |
| `/custo-de-vida` | 2 | 10.065 → 7.586 / 15.970 → 12.873 | 569 / 549 | 0 · 0 / 0 | 8 · 7 · 8 · 7 · 9 · 8 · 8 · 7 | Acima do orçamento de entrada (6.500 / 11.000): o modelo didático (2.669 px a 1440) e a consulta com os nove grupos (1.649 px) são a maior parte; decisão do dono pendente |
| `/contas-publicas/previdencia` | 2 | 16.962 → 5.546 / 23.314 → 8.111 | 504 / 526 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | Nenhuma nova |
| `/agronegocio` | 2 | 6.463 → 4.833 / 12.036 → 8.420 | 513 / 488 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | Nenhuma nova |
| `/gas-natural` | 3 | 5.309 → 4.795 / 10.635 → 8.575 | 512 / 557 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | Nenhuma nova |
| `/saneamento` | 3 | 8.388 → 6.687 / 16.682 → 12.442 | 570 / 567 | 0 · 0 / 0 | 8 · 8 · 8 · 7 · 9 · 8 · 8 · 7 | Acima do orçamento de entrada; o diagrama do sistema (1.814 px a 1440, 3.633 a 390) e os quinze capítulos à vista são a maior parte |
| `/contas-publicas` | 3 | 7.284 → 6.298 / 13.656 → 11.557 | 530 / 510 | 0 · 0 / 0 | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 7 | A 390 px, 557 px acima do orçamento; os cartões do "Para você" com gravura e os oito capítulos à vista são a maior parte |
| `/contas-publicas-estaduais` | 3 | 11.172 → 6.244 / 19.529 → 10.571 | 484 / 505 | 0 (antes 2) · 0 / 0 | 8 · 8 · 8 · 8 · 8 · 8 · 8 · 8 | A escolha do estado passou a navegar pelo endereço; a ficha, as provas, a cobertura e o catálogo ficam em blocos recolhidos |
| `/eficiencia-estatal` | 4 | 9.342 → 6.056 / 16.884 → 9.948 | 484 / 505 | 0 · 0 / 0 (antes 8 a 390) | 8 · 8 · 8 · 8 · 9 · 8 · 8 · 8 | Sem nota composta na entrada (decisão de 19/10/2026): a escala traz as medianas de quatro condições do retrato e a régua das sete posições é a seção própria; a escolha da capital fica no "Para você" |
| `/setor-eletrico` | 4 | 12.835 → 7.870 / 24.923 → 14.076 | 574 / 538 | 0 · 0 / 0 (pt e en) | 8 · 8 · 8 · 7 · 9 · 8 · 8 · 7 | Acima do orçamento de entrada; o percurso da usina à tomada (1.215 px a 1440, 2.938 a 390), a gravura na escala e o laboratório são a maior parte, e o rodapé da coleção tem 1.123 px fixos |
| `/observatorio-do-credito` | 4 | 4.943 → 5.611 / 9.477 → 11.221 | 510 / 529 | 0 · 0 / 0 (com e sem sessão) | 8 · 8 · 8 · 7 · 9 · 8 · 8 · 7 | Acima da meta de 3.500 px a 1440 da página aberta: o modelo didático "Do juro básico ao atraso" (1.405 px), obrigatório no molde, não existia na entrada de antes; o rodapé da plataforma tem cerca de 900 px fixos |

No Grupo A (PR 2), as entradas que eram o próprio painel encolheram porque as seções longas foram para blocos recolhidos na mesma página; o primeiro número de antes não tem medida porque a marcação antiga não o identificava. A 1440 px as cinco entradas de observatório ganharam cerca de 200 px com a lista "O que este modelo deixa de fora", que o molde torna obrigatória; a 390 px, as listas de painéis das coleções passaram a duas colunas e o respiro vertical do molde ficou mais justo, sem retirar conteúdo.

No Grupo C (PR 4), o Setor Elétrico passa ao molde nos dois idiomas: os três números de abertura com fonte e período e a gravura do sistema na escala (a coluna de texto ao lado da paisagem, vazia desde 20/10/2026, ganhou a orientação "Da usina à tomada"); os seis grupos de páginas nos destinos, com o índice das 22 páginas em "Todas as páginas, por tema"; o percurso como seção própria; o laboratório "Potência não é energia" como modelo didático; e as perguntas com a prova, sobre o observatório, duas camadas e leituras, mapa conceitual, trilhas, conhecimento e "como ler e conferir" em blocos recolhidos, com fontes e atualidade no método. Na Eficiência, a grade dos seletores da capital deixou de estourar 8 px a 390.

## Pendências

- Teste com leitor de tela nas seis entradas e nas cinco consultas abertas.
- Ampliação de texto a 200% sem zoom de página (reflow de texto).
- Repetir a rodada a cada onda e acrescentar as páginas novas.
- Para você: decidir sobre as gravuras que saíram das entradas do Setor Elétrico e das Contas Federais; integrar as consultas do Crédito do pacote Q1 em Famílias e Economia; levar os números de abertura do Gás Natural para antes do fluxo.
