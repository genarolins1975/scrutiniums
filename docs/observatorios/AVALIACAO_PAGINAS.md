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

## Pendências

- Teste com leitor de tela nas seis entradas e nas cinco consultas abertas.
- Ampliação de texto a 200% sem zoom de página (reflow de texto).
- Repetir a rodada a cada onda e acrescentar as páginas novas.
- Para você: decidir sobre as gravuras que saíram das entradas do Setor Elétrico e das Contas Federais; integrar as consultas do Crédito do pacote Q1 em Famílias e Economia; levar os números de abertura do Gás Natural para antes do fluxo.
