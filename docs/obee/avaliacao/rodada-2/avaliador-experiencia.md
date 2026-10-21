# Avaliação de experiência, rodada 2: painéis de educação do OBEE (Educação nas capitais)

## 1. Identificação e natureza da avaliação

* **Avaliador:** agente Claude Sonnet 5.5 (claude-sonnet-5-5), avaliador de experiência independente, em contexto limpo, sem acesso às avaliações da rodada 1, às correções do executor nem ao histórico do repositório. Lido da pasta de avaliação apenas `RUBRICA.md`.
* **Data da inspeção:** 09/10/2026 (dados do painel "capturados até 08/10/2026", gold gerada em 09/10/2026, hash de dados 326adb15ec058bd4).
* **Escopo de notas:** critérios A (layout e hierarquia), B (didática), C (utilidade), D (relevância e impacto social), H (visualizações), I (navegação e interação) e J (acessibilidade e responsividade), para os seis painéis: Panorama, Gastos, Atendimento, Resultados, Comparar capitais, Dados e métodos. Os critérios E, F, G e K são de outro avaliador; as observações sobre eles estão na seção 9, sem nota.
* **Natureza:** inspeção heurística feita por agente, no navegador (Chromium headless controlado por Playwright), com leitura do código de `src/` apenas para entender o que a tela mostra. **Não houve leitor de tela real, nem aparelho físico, nem usuários reais.** Os testes por perfil (seção 5) são simulações de agente: não há participantes, depoimentos, tempos nem taxas de sucesso. Toque foi emulado (`hasTouch`), não medido em dispositivo.
* **Princípio editorial:** as notas dizem respeito à qualidade dos painéis, não das administrações. Não se atribui eficiência a nenhuma capital neste relatório.

## 2. Resultado em uma linha

Nenhum bloqueio de aprovação encontrado; porém **nenhum dos seis painéis atinge 9,0 em todos os critérios de experiência** (notas de 7,8 a 9,0; a regra de aprovação, mínimo 9,0 em cada critério, não é cumprida no recorte A, B, C, D, H, I, J), com os pontos mais fracos em visualização de evolução (rótulos que colidem), eixo não zerado em Resultados sem aviso, largura de 320 px, siglas sem expansão no ponto de uso e a extensão de Dados e métodos.

## 3. Matriz de notas (painel | critério | nota | justificativa | evidência | correção necessária)

Avaliador: Claude Sonnet 5.5, avaliador de experiência, rodada 2. Capturas em `docs/obee/avaliacao/rodada-2/evidencias/experiencia/` (abreviado "ev/"). Rotas relativas a `/eficiencia-estatal/educacao-municipal-capitais`.

### Resumo das notas

| Painel | A | B | C | D | H | I | J | Menor |
|---|---|---|---|---|---|---|---|---|
| Panorama | 9,0 | 8,8 | 8,5 | 8,9 | 9,0 | 8,8 | 8,8 | 8,5 |
| Gastos | 8,6 | 8,7 | 8,8 | 8,8 | 8,2 | 8,8 | 8,5 | 8,2 |
| Atendimento | 8,9 | 8,6 | 8,4 | 8,7 | 8,7 | 8,9 | 8,7 | 8,4 |
| Resultados | 8,9 | 8,8 | 8,5 | 8,7 | 8,4 | 8,9 | 8,7 | 8,4 |
| Comparar capitais | 8,6 | 8,5 | 9,0 | 8,8 | 8,6 | 9,0 | 8,4 | 8,4 |
| Dados e métodos | 8,0 | 8,3 | 8,8 | 8,8 | 7,8 | 8,6 | 8,3 | 7,8 |

### Matriz completa

**Panorama** (rota `/`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 9,0 | A primeira tela traz título, subtítulo com universo e data de captura, e a primeira pergunta ("Quanto se gasta por habitante?") com menor valor, mediana e maior valor. Três blocos (recursos, atendimento, resultados) com hierarquia clara e sem cartões redundantes. Funciona de 320 a 1440 px sem rolagem horizontal. Parágrafos de perímetro e unidade acima do gráfico ficam densos. | ev/panorama-1440-pagina.png, panorama-320, 390, 768; medida: rolagem horizontal do documento nula nos 4 larguras | Encurtar o bloco de texto entre números e gráfico (unidade, perímetro) ou movê-lo para depois do gráfico |
| B | 8,8 | Cada número tem ano, base de preço ("R$ correntes"), universo ("26 capitais estaduais") e o que não é ("Não é gasto por aluno"). Ideb e Saeb são explicados no ponto de uso. DCA e RREO aparecem sem expansão no parágrafo de perímetro; não há `<abbr>` em nenhuma página. | ev/panorama-1440-pagina.png; consulta `abbr` = 0 | Expandir siglas na primeira ocorrência ou com `<abbr title>` e link ao glossário |
| C | 8,5 | Mostra faixa, mediana, extremos, referência nacional (R$ 2.125) com aviso de universo diferente e destaque de uma capital com frase de diferença para a mediana. Por ser entrada, não traz evolução em reais constantes, nem grupo de pares; remete a Gastos e Comparar. | `/?cap=recife`: "Recife (PE) registra R$ 1.172; a mediana das 26 capitais é R$ 1.160 (R$ 12 acima)"; ev/panorama-capital-recife-1440-pagina.png | Indicar, no bloco de gasto, o que falta ver antes de decidir (já há remissão ao painel Gastos); opcional: atalho para a evolução da capital destacada |
| D | 8,9 | Linguagem acessível, três perguntas de cidadão, aviso explícito de que "a leitura conjunta não demonstra causalidade", recorte compartilhável por URL (`?cap=`). Sem leitura sobre desigualdades (não há dado). | `/` seção "Entenda e confira os números"; teste de URL | Sem correção obrigatória; ver limitação de desigualdades na seção 9 |
| H | 9,0 | Gráfico de pontos horizontal por indicador com faixa central, mediana e extremos rotulados; escala de 0 a 10 para Ideb; sem colisões de rótulo detectadas nos 4 larguras; alternativa em tabela ("Gráfico/Tabela" e "Ver os valores de cada capital"); descrição textual em `role="img"`. | ev/panorama-320-pagina.png; detector de sobreposição de texto SVG sem ocorrências em `/` | Nenhuma obrigatória |
| I | 8,8 | Abas com setas, capital destacada preservada na URL e nos links de navegação, "Explorar gastos/atendimento" levam à medida, ano e capital. O botão "Comparar capitais" do rodapé do painel perde a capital (`/comparar` sem `cap`); o tamanho do JSON (6,7 MB) só é lido por leitor de tela. | `/?cap=recife` → clique "Explorar gastos": `/gastos?med=despesa_mat&ano=2025&cap=recife`; "Comparar": `/comparar`; `PanoramaInterativo.tsx:466` (`sr-only`) | Propagar `cap` ao botão Comparar; mostrar visivelmente tipo e tamanho do arquivo |
| J | 8,8 | axe-core 4.12.1: 0 violações em 1440, 390 e 320; foco visível de 2 px em todos os controles; abas navegáveis por setas; movimento reduzido tratado globalmente. Alvos do rodapé com 17 px de altura; sem teste com leitor de tela real. | ev/gastos-teclado-foco-grafico-1440.png; `globals.css:91`; script axe | Elevar a área de toque dos links do rodapé; validar com leitor de tela real |

**Gastos** (rota `/gastos`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,6 | Três cartões (total, por habitante, por matrícula) sempre visíveis com mediana e intervalo; manchete em frase com extremos; controles claros. O gráfico começa só depois de cerca de 1.350 px em 1440 e de mais de 1.500 px em 390; a manchete em fonte grande de duas a cinco linhas pesa; a visão Evolução ocupa cerca de 60% da largura deixando o lado direito vazio. | ev/gastos-1440-pagina.png, gastos-390-pagina.png, gastos-evolucao-1440-pagina.png | Encurtar manchetes longas; usar a largura disponível na Evolução |
| B | 8,7 | Boa distinção entre gasto total, por habitante e por matrícula, com "não é custo do aluno" no cartão; a visão "Do total ao numerador" mostra a ponte; "Perímetro" e o aviso de reais correntes. Siglas (DCA, RREO, MSC, PPC, ISCED, IPCA) sem expansão; o "Perímetro" mostra extremos das 26 capitais mesmo com grupo regional; texto da Evolução manda escolher "Moeda" enquanto o controle se chama "Valores". | `/gastos?cap=vitoria&grp=regiao`; `/gastos?med=despesa_hab&vis=evolucao`; ev/gastos-ponte-recife-1440-pagina.png | Sincronizar o perímetro com o grupo; renomear "Moeda" ou "Valores"; expandir siglas |
| C | 8,8 | Responde gasto total, por habitante e por matrícula, em reais correntes e de 2025 (IPCA), por ano de 2021 a 2025, posição diante de todas as capitais ou da região, exclusões com motivo, referência nacional calculada, lacunas ("O que este painel não mostra" e "Antes de decidir, falta saber…"). A evolução por habitante fica interrompida em 3 das 4 transições por mudança da base populacional; só 2024 a 2025 é contínuo. Grupos de pares limitados a todas e região. | ev/gastos-evolucao-1440-pagina.png; ev/gastos-evolucao-recife-reais-1440.png; CSV de série | Oferecer leitura alternativa da evolução (por exemplo, variação só da despesa total real) junto da série interrompida; discutir pares por porte em outro painel |
| D | 8,8 | Controle social: motivos de exclusão legíveis por capital, "Copiar link deste recorte", CSV e dicionário, referência nacional, aviso "menor gasto não demonstra eficiência". Contexto internacional mostrado (US$ 4.999 e US$ 13.334) ao lado das capitais, com ressalvas, pode induzir leitura de ranking. | `/gastos?med=despesa_mat&ano=2022` (3 capitais fora, ev/gastos-matricula-2022-1440-pagina.png) | Reforçar visualmente que o bloco internacional não é meta (hoje só no texto abaixo) |
| H | 8,2 | Dot plot com mediana, faixa central e média simples; capitais excluídas aparecem na própria linha com "fora da comparação"; teclado e tabela equivalentes. Defeitos: na Evolução, rótulos colidem com marcadores e entre si (R$ 673 e R$ 919 sob o marcador da mediana; R$ 11.327 sobre R$ 11.601 a 390 px; R$ 10.000 sobre R$ 8.481 em todas as larguras; "mudança de base" sobre "R$ 1.500" a 320 px); no eixo logarítmico a 320 px o rótulo "Mediana R$ 1,01 bilhão" é cortado e há uma só marca; a 320 px a área de pontos fica com cerca de 110 px. Sem rótulo direto para a linha da mediana e da capital na Evolução. | ev/gastos-evolucao-recife-reais-390.png; gastos-evolucao-matricula-natal-lacunas-390.png; gastos-evolucao-rotulo-colide-eixo-320.png; gastos-total-eixo-log-mediana-cortada-320.png; gastos-hab-grafico-320.png; detector de sobreposição em `/gastos?...vis=evolucao` | Resolver colisões (afastar rótulos do marcador da mediana, ocultar um de dois rótulos adjacentes); reduzir margem de rótulos de capital a 320 px; ancorar o rótulo da mediana |
| I | 8,8 | Estado inteiro na URL (`cap`, `med`, `ano`, `grp`, `moeda`, `vis`, `ot`), voltar do navegador restaura, "Copiar link" confirma ("Link deste recorte copiado"), capital persiste entre abas, capital excluída recebe "sem valor, fora da comparação". Na Evolução o controle Ano continua ativo, muda só o subtítulo e o bloco de referências e não o gráfico; o subtítulo diz "exercício 2025" sob série de 2021 a 2025. "Do total ao numerador" fica sem conteúdo até escolher capital, avisando. | `/gastos?...vis=evolucao&ano=2022` (diff do texto); t15 de URL; ev/gastos-total-ao-numerador-1440-pagina.png | Desativar ou explicar o Ano na Evolução; corrigir o subtítulo da série |
| J | 8,5 | axe: 0 violações; foco visível; setas, Home e End no gráfico, com área de status; sem rolagem horizontal do documento. Problemas de 320 px (área útil do gráfico, rótulo cortado no eixo log) e siglas sem `<abbr>`. | ev/gastos-teclado-foco-grafico-1440.png; axe; ev/gastos-total-eixo-log-mediana-cortada-320.png | Ver H; adaptar o layout do dot plot a 320 px |

**Atendimento** (rota `/atendimento`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,9 | Mesma estrutura do Gastos com seletor de etapa; manchete única com extremos; gráfico visível já na metade da primeira rolagem em 1440; densidade adequada. | ev/atendimento-1440-pagina.png, atendimento-320, 390, 768 | Nenhuma obrigatória |
| B | 8,6 | "Uma matrícula não é uma pessoa", "contadas à parte da rede" e "Alunos por turma não é alunos por professor" distinguem oferta de atendimento. Zero em escolas conveniadas (12 capitais) aparece na manchete ("vai de 0 em Belém (PA), Belo Horizonte (MG) e mais 10") sem explicar ao lado que zero significa nenhuma matrícula declarada ao Censo; o texto padrão de Referências cita "turmas menores" para uma medida de contagem. Dois "Brasil" para turma (22,0 do INEP rede municipal e 20,9 da OCDE, país inteiro), cada um rotulado, mas próximos. | `/atendimento?med=conveniadas&vis=tabela`; ev/atendimento-conveniadas-1440-pagina.png; ficha (ev/atendimento-sobre-este-dado-1440.png) item 10 "Ausências" só remete a outro indicador | Explicar zero junto do número; adaptar o texto padrão por medida |
| C | 8,4 | Responde quais etapas são atendidas (matrículas por etapa, turmas) e, à parte, conveniadas, com média, mediana e referência nacional da turma. Não informa cobertura sobre a população em idade escolar, nem demanda por vaga, nem recortes por renda ou deficiência (declarado). Contagens absolutas dependem do porte da capital e não há razão por população. | ev/atendimento-matriculas-1440-pagina.png; seção "O que este painel não mostra" | Apresentar uma razão de cobertura quando houver denominador válido |
| D | 8,7 | Tema central para famílias e conselhos (turma, etapa, conveniadas); torna visível a ausência de dados de cobertura e desigualdade. Sem dados para quem mais precisa do indicador (acesso, desigualdades). | Seção "O que este painel não mostra" | Registrar prazo ou caminho para cobertura |
| H | 8,7 | Dot plot adequado a valores por capital; eixo de turma parte de 0; referência Brasil tracejada; tabela e evolução; sem colisões de rótulo detectadas em 4 larguras nos estados testados. A 320 px mantém a compressão do gráfico. | detector de sobreposição `/atendimento*`; ev/atendimento-320-pagina.png | Mesma correção de 320 px do Gastos |
| I | 8,9 | Etapa, ano, grupo, ordem e visão com efeito claro; cartões trocam a medida; "Sobre este dado" é diálogo nativo com foco preso e Esc devolvendo o foco; rótulo de ano ("Ano do Censo Escolar") correto. | t7 diálogo; `/atendimento?med=conveniadas` | Nenhuma obrigatória |
| J | 8,7 | axe 0 violações; foco visível; teclado; sem rolagem horizontal. Limitações iguais às do Gastos (320 px, siglas). | axe; ev/atendimento-sobre-este-dado-1440.png | Idem Gastos |

**Resultados** (rota `/resultados`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,9 | Estrutura igual à do Atendimento; cartões de aprovação, Ideb e Saeb com texto de conceito; manchete clara. Na Evolução do Ideb a manchete concatena a nota de rodapé ("…para 4,8 em 2025. Em 2021: edição afetada pela pandemia…"). | ev/resultados-1440-pagina.png; ev/resultados-evolucao-natal-1440-pagina.png | Separar a nota da manchete |
| B | 8,8 | Ideb e Saeb definidos no cartão ("de 0 a 10, combina nota no Saeb e fluxo escolar; edições bienais"); aviso "O resultado observado não mede o efeito da gestão municipal" e "periodicidade própria, não coincide com o ano da despesa". Siglas Saeb, INEP e Ideb explicadas; "pontos na escala Saeb" sem exemplo. | `/resultados`; texto de Referências | Exemplo de leitura do Saeb em pontos |
| C | 8,5 | Resultados por edição, etapa e disciplina (Saeb), série histórica de 2005 a 2025 com marca de 2021, referência nacional INEP. Sem recortes por grupo de estudantes (declarado); sem metas do Ideb. | `/resultados?vis=evolucao&cap=natal`; `/resultados?med=saeb` | Nenhuma obrigatória |
| D | 8,7 | Resultado educacional para famílias e conselhos, com nota expressa de não causalidade; desigualdades de resultado ausentes por falta de dado, declaradas. | Seção "O que este painel não mostra" | Registrar caminho para dados desagregados |
| H | 8,4 | Eixo do dot plot de Ideb vai de 4,5 a 7 (Saeb de 200 a 250; taxa de aprovação de 88% a 100%), com hastes que começam na borda esquerda do eixo; a diferença entre Natal (4,8) e Curitiba (6,9) fica visualmente exagerada e não há aviso de eixo não zerado; no Panorama o mesmo Ideb usa 0 a 10. Na Evolução, a nota "1" fica no topo da coluna de 2021, longe do ponto; linhas sem rótulo direto. | ev/resultados-1440-pagina.png; ev/resultados-ideb-grafico-320.png; `ExploradorTema.tsx:418,445` (`zero` só para despesa, matrículas, conveniadas e turma) | Ancorar o eixo em zero ou remover as hastes e avisar "eixo não parte de zero"; harmonizar com o Panorama |
| I | 8,9 | Seleção de edição bienal, etapa, disciplina e visão com efeito claro; estado em URL; capital destacada. | `/resultados?med=saeb`; `?vis=evolucao&cap=natal` | Nenhuma obrigatória |
| J | 8,7 | axe 0 violações; foco; teclado; sem rolagem horizontal. Cor do ponto de capital destacada distinta mais rótulo (não só cor). | axe; ev/resultados-320-pagina.png | Idem Gastos |

**Comparar capitais** (rota `/comparar`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,6 | Primeira tela clara, mas em 390 px o gráfico só aparece após cerca de 1.500 px de controles; a tabela completa tem 12 colunas, abrangendo 1.997 px de largura em 1440. | ev/comparar-390-pagina.png; ev/comparar-tabela-cruzada-1440.png | Recolher controles em mobile; apresentar um resumo antes da tabela |
| B | 8,5 | Frases de uso e de cautela na tabela ("a leitura conjunta não indica causa nem efeito"; períodos no cabeçalho de cada coluna); siglas sem expansão; "Diferença para a mediana do grupo" refere-se apenas à medida escolhida, o que é dito só no cabeçalho. | Texto da tabela completa | Indicar na coluna de diferença que a mediana é da medida escolhida |
| C | 9,0 | Reúne gasto, população, matrículas, turma, aprovação, Ideb e Saeb na mesma linha, com diferença para a mediana, linhas de resumo (mediana, média, mínimo, máximo, capitais com valor), grupos por região, destaque de até 5 capitais, CSV da tabela e ordenação (`aria-sort`, persistida em `ot`). Limitação: pares só por região. | `/comparar?vis=tabela&dest=…`; CSV `obee_tabela_comparativa_2025_anos_iniciais_nominal.csv` (288 linhas); ev/comparar-tabela-cruzada-1440.png | Pares por porte seriam valiosos (fora do escopo de nota) |
| D | 8,8 | Instrumento de controle social: lado a lado, destaque compartilhável por URL, exportação; aviso de que a ordem por valor não é classificação de eficiência. | `/comparar?dest=aracaju,cuiaba,maceio,rio-de-janeiro`; rodapé do painel | Nenhuma obrigatória |
| H | 8,6 | Mesma qualidade do dot plot de Gastos mais tabela cruzada com colunas agrupadas e coluna ativa realçada; a 320 px a tabela mostra cerca de 1,5 colunas por vez com a capital fixa em 100 px de 286, e linhas altas. | ev/comparar-tabela-cruzada-320.png, comparar-tabela-cruzada-390.png | Alternativa de leitura em cartões por capital em telas estreitas |
| I | 9,0 | Controles se adaptam à medida (some "Valores" para Ideb e turma, aparece "Etapa"); destaque até 5 com regra explícita ("a mais antiga sai"); colunas por grupo; ordenação por teclado; clicar na capital destaca; copiar link; CSV. | t8, t9, t19, t24 | Nenhuma obrigatória |
| J | 8,4 | axe 0 violações; região rolável com rótulo e `tabindex`; botões de ordenação de 44 px. A 320 px a rolagem em duas direções dentro da caixa é trabalhosa; a mensagem "Em tela estreita, a visão Todas mostra as medidas centrais" ajuda. | axe `/comparar?vis=tabela&dest=…` em 320 (176 verificações de contraste "incompletas", sem violações); ev/comparar-tabela-cruzada-320.png | Rever a tabela para 320 px |

**Dados e métodos** (rota `/metodos`)

| Critério | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,0 | Índice de âncoras no topo funciona (destino a 96 px do topo); seções com título; fichas recolhidas com "Abrir". Mas a página tem 16.411 px de altura em 1440 e 32.270 px em 320, cerca de 6.900 palavras, com parágrafos longos e tabelas largas. | ev/metodos-1440-topo.png, metodos-320-topo.png; medida da página | Dividir em páginas ou abas por tema; resumo curto de dez linhas no topo |
| B | 8,3 | Glossário completo (DCA, RREO, MSC, mediana, razão agregada, ISCED, PPC), exemplos de reprodução por indicador, "definição avaliada e descartada" explicada. Jargão pesado (modalidade 90, função 12, elementos 01, 03, 05) sem ordem de leitura por perfil; linguagem de processo interna visível ("Rodada 6", "PR #117, commit 8ad77db"). | texto de `/metodos` | Camada leiga no topo; mover histórico de desenvolvimento para nota de versão sucinta |
| C | 8,8 | Permite reconstruir um indicador: fórmula, fontes, capturas com sha256, validações V01 a V19, 12 CSV estáticos e o JSON da gold (todos respondem 200), comandos de reprodução. | t2 de links; `/eficiencia/series/*.csv` | Mapa "do número na tela à linha do CSV" |
| D | 8,8 | Torna visíveis limitações e ausências (DF fora, sem ajuste por renda, classificação funcional por município); apoia controle social e reprodução. | Seção "Limitações gerais" | Nenhuma obrigatória |
| H | 7,8 | Adaptado: aqui o equivalente de "visualização" são as tabelas e quadros. A matriz de referências tem 11 colunas e 1.604 px de largura, com rolagem horizontal mesmo em 1440; a tabela de perímetro por capital é legível; não há figuras de apoio. | ev/metodos-matriz-referencias-tabela-1440.png, ev/metodos-matriz-referencias-tabela-390.png; detector de largura | Reformatar a matriz de referências em fichas por candidata |
| I | 8,6 | Âncoras do índice, fichas abríveis, links externos com "abre em nova aba", todos os links internos retornam 200; sem filtro ou busca, sem "voltar ao topo" verificado. | `links.cjs`: 54 internos sem erro; 10 externos | Busca ou filtro por indicador; "voltar ao índice" |
| J | 8,3 | axe 0 violações; tabelas com região rolável com rótulo; 32.270 px de rolagem vertical em 320. Links "Série completa em CSV" e rodapé com 17 px de altura. | axe `/metodos`; `m1.cjs` | Elevar área de toque; reduzir extensão |

## 4. Matriz detalhada por painel (os cinco itens exigidos por nota)

Os cinco itens: (1) evidência observável (rota, estado, captura ou código); (2) requisitos atendidos; (3) limitações remanescentes; (4) por que não recebe nota inferior; (5) quem avaliou. O item (5) é o mesmo em todas as linhas: **Claude Sonnet 5.5, avaliador de experiência, rodada 2, 09/10/2026**, e não se repete abaixo.

### Panorama

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 9,0 | `/` em 320, 390, 768, 1440 (ev/panorama-*-pagina.png) | Pergunta, recorte e informação principal na primeira tela; três blocos com pesos distintos; sem rolagem horizontal; tipografia consistente | Bloco de texto de unidade e perímetro denso; cabeçalho a 768 px com "Comparar capitais" e "Dados e métodos" desalinhados | Hierarquia demonstrada nos 4 larguras; nenhum defeito grave |
| B 8,8 | Texto de `/`; ficha "Fonte e critérios" | Unidade, ano, universo e "não é" junto ao número; Ideb e Saeb explicados | Siglas DCA e RREO sem expansão; sem exemplo ilustrado do que é "faixa central" | Todo número tem unidade, período e universo próximos |
| C 8,5 | `/?cap=recife` | Posição da capital frente à mediana e à referência nacional; remissões a Gastos e Comparar | Sem evolução nem pares | Responde as perguntas centrais de uma entrada |
| D 8,9 | Rodapé "Entenda e confira"; `?cap=` | Linguagem acessível, aviso de causalidade, recorte por URL | Sem dados de desigualdade | Utilizável sem formação especializada |
| H 9,0 | `role="img"` + tabela; detector sem colisões | Escala 0 a 10 no Ideb; extremos rotulados; alternativa tabular | Gráficos pequenos, sem validação em dispositivo | Sem erros de escala, eixo ou rótulo encontrados |
| I 8,8 | Navegação testada (t21, t22) | Abas por setas; capital preservada na navegação superior; links de "Explorar" levam o recorte | Botão Comparar perde `cap`; tamanho do JSON só em `sr-only` | Efeito de cada seleção claro e URL sincronizada |
| J 8,8 | axe (3 larguras), foco, `prefers-reduced-motion` | 0 violações, foco 2 px, movimento reduzido | Sem leitor de tela real; rodapé com alvos de 17 px | Verificações automáticas e manuais coerentes; conformidade não declarada |

### Gastos

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 8,6 | `/gastos` (4 larguras); `?vis=evolucao` | Cartões de escala; manchete; controles agrupados | Gráfico abaixo da dobra; manchetes longas; Evolução subutiliza a largura | Estrutura previsível e sem excesso de elementos |
| B 8,7 | `?med=despesa_mat&ano=2022`; `?vis=detalhe&cap=recife` | "Não é gasto por aluno"; ponte do total ao numerador; estágio da despesa explicado | Siglas; perímetro sem sincronia com o grupo; "Moeda" x "Valores" | Distinção gasto, oferta e resultado demonstrada |
| C 8,8 | `?med=despesa&vis=evolucao&moeda=real&cap=campo-grande`; CSV | Total, por habitante, por matrícula; real e nominal; exclusões; lacunas | Evolução por habitante interrompida; pares só por região | Cobre quase todas as perguntas da rubrica com motivos de lacuna |
| D 8,8 | `?med=despesa_mat&ano=2022` | Motivos de exclusão por capital; CSV; link | Bloco internacional pode ser lido como ranking | Facilita controle social e reprodução |
| H 8,2 | ev/gastos-evolucao-*; ev/gastos-total-eixo-log-*; detector | Mediana, faixa, média; capitais excluídas na própria linha; tabela e teclado | Colisões de rótulo; 320 px comprimido; rótulo cortado no log | Os defeitos são pontuais e o gráfico principal em 1440 e 390 é correto |
| I 8,8 | t15, t21; `?...vis=evolucao&ano=2022` | URL completa, voltar funciona, copiar link com confirmação | Ano sem efeito no gráfico da Evolução; subtítulo incoerente | Seleções têm efeito claro e são reproduzíveis |
| J 8,5 | axe; ev/gastos-teclado-foco-grafico-1440.png | 0 violações; setas, Home, End; foco | 320 px; siglas; sem leitor de tela | Nenhuma barreira para tarefa essencial |

### Atendimento

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 8,9 | `/atendimento` (4 larguras) | Hierarquia limpa, gráfico cedo | Cartões de medida com textos longos em 320 | Densidade e espaço equilibrados |
| B 8,6 | `?med=conveniadas&vis=tabela`; ficha | Distinção rede e conveniadas; "matrícula não é pessoa" | Zero sem explicação ao lado; texto padrão de referências; dois "Brasil" | Conceitos centrais explicados no ponto de uso |
| C 8,4 | `?med=matriculas`; `?med=conveniadas` | Etapas, turma, referência nacional | Sem cobertura sobre população em idade escolar | Declara a lacuna e o que falta |
| D 8,7 | "O que este painel não mostra" | Tema relevante; ausências visíveis | Sem desigualdades | Potencial e limitações coerentes |
| H 8,7 | Detector; ev/atendimento-320-pagina.png | Escolha de gráfico adequada; eixo zero | Compressão em 320 | Sem colisões nem eixos enganosos |
| I 8,9 | t6, t7 | Seleções com efeito; diálogo com foco preso | Nenhuma relevante | Padrão de interação completo |
| J 8,7 | axe; diálogo | 0 violações; foco preso e Esc | Sem leitor de tela | Verificações coerentes |

### Resultados

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 8,9 | `/resultados` (4 larguras) | Estrutura clara | Manchete da evolução mistura nota | Hierarquia sólida |
| B 8,8 | `/resultados`; `?med=saeb` | Conceitos de Ideb e Saeb; não causalidade | "Pontos na escala Saeb" sem exemplo | Teste de explicar o indicador provavelmente atendido |
| C 8,5 | `?vis=evolucao&cap=natal` | Série 2005 a 2025; edição; referência nacional | Sem grupos de estudantes | Anos de observação claros |
| D 8,7 | Seção "não mostra" | Aviso de não causalidade; tema central | Sem desagregação | Boa aderência às necessidades |
| H 8,4 | ev/resultados-1440-pagina.png; `ExploradorTema.tsx:418,445` | Dot plot adequado, referência Brasil, faixa | Eixo não zerado sem aviso, com hastes; nota de rodapé distante | Valores rotulados nos extremos mitigam |
| I 8,9 | URL e seleção | Ano bienal; disciplina | Nenhuma relevante | Efeito de cada seleção claro |
| J 8,7 | axe | 0 violações | Mesmas do Gastos | Verificações coerentes |

### Comparar capitais

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 8,6 | ev/comparar-390-pagina.png | Primeira tela clara | Controles longos em mobile; tabela larga | Estrutura previsível |
| B 8,5 | Texto da tabela | Cautela e períodos por coluna | Siglas; mediana da medida escolhida pouco explícita | Avisos claros |
| C 9,0 | CSV; tabela cruzada | Múltiplas medidas na linha; diferença; resumo; regiões; destaque | Pares só por região | Requisitos demonstrados |
| D 8,8 | Link por URL | Compartilhável, controle social | Sem desigualdades | Mecanismos de comunicação demonstrados |
| H 8,6 | ev/comparar-tabela-cruzada-320.png | Tabela e gráfico equivalentes | Largura de 320 px | Boa leitura em 390 e 1440 |
| I 9,0 | t9, t19, t24 | Controles adaptativos; destaque; ordenação | Nenhuma relevante | Requisitos de interação demonstrados |
| J 8,4 | axe; região rolável | 0 violações; botões de 44 px | Rolagem em 2 eixos a 320 | Rotulagem e teclado corretos |

### Dados e métodos

| Crit. | (1) Evidência | (2) Requisitos atendidos | (3) Limitações | (4) Por que não menos |
|---|---|---|---|---|
| A 8,0 | Altura e palavras da página | Índice, seções, fichas recolhidas | Extensão e densidade | Conteúdo organizado em seções navegáveis |
| B 8,3 | Glossário; exemplos | Termos definidos | Jargão e linguagem de processo | Definições presentes |
| C 8,8 | CSV estáticos; V01 a V19 | Reprodução | Mapa número a linha ausente | Permite reconstruir indicador |
| D 8,8 | Limitações gerais | Ausências visíveis | Extensão | Controle social facilitado |
| H 7,8 | ev/metodos-matriz-* | Tabelas legíveis | Matriz larga | Informação íntegra |
| I 8,6 | Âncoras; links | Navegação interna | Sem busca | Sem links mortos |
| J 8,3 | axe; ev/metodos-320-topo.png | 0 violações | 32.270 px a 320 | Estrutura semântica |

## 5. Testes de tarefas (inspeção heurística por agente, sem usuários reais)

Perfis: F = familiar ou cidadão; P = professor ou jornalista; G = gestor ou conselho; Q = pesquisador. "Sucesso" significa que o agente, simulando o perfil, completou a tarefa no navegador; não é taxa nem tempo. "Intervenção" é o que exigiria mudança no produto ou ajuda externa.

| # | Tarefa | Rota e passos | F | P | G | Q | Erros e obstáculos | Intervenção necessária |
|---|---|---|---|---|---|---|---|---|
| 1 | Gasto por habitante e por matrícula de uma capital | `/gastos?cap=recife`: seletor "Capital"; os três cartões mostram R$ 1,86 bilhão, R$ 1.172, R$ 18.590 com a mediana | Sucesso | Sucesso | Sucesso | Sucesso | Nenhum erro; "por matrícula" é razão orçamentária, o cartão explica | Nenhuma |
| 2 | Comparar com grupo elegível e identificar a referência | `/gastos?cap=vitoria&grp=regiao`: "mediana das 4 capitais", texto "Define a mediana…", legenda do gráfico | Sucesso com esforço | Sucesso | Sucesso | Parcial | Só "todas" e "região"; "Região da capital escolhida" exige escolher capital antes; "metade central" é termo técnico; pares por porte inexistentes | Pares por porte ou população (Q); explicar "metade central" em linguagem simples (F) |
| 3 | Interpretar mudança em reais constantes | `/gastos?med=despesa&vis=evolucao&moeda=real&cap=campo-grande`; `med=despesa_hab` com `moeda=real` | Parcial | Sucesso com esforço | Sucesso | Sucesso | Série por habitante interrompida em 3 de 4 transições; manchete diz "dois períodos"; texto manda escolher "Moeda"; manchete "passou de R$ 8.481 para R$ 11.601" não cita "reais de 2025" | Manchete com a base de preço; explicação visual da quebra |
| 4 | Entender por que uma observação foi excluída | `/gastos?med=despesa_mat&ano=2022`: linha "fora da comparação (motivo abaixo)", "3 capitais fora desta comparação", "Ver o motivo completo" | Sucesso com esforço | Sucesso | Sucesso | Sucesso | Vocabulário (MSC, DCA, "função 12", "intraorçamentárias") sem expansão no ponto de uso | Frase leiga antes do motivo técnico |
| 5 | Distinguir rede municipal, função Educação e população residente | Cartões de Gastos, "Perímetro", "Do total ao numerador", glossário em `/metodos` | Sucesso com esforço | Sucesso | Sucesso | Sucesso | Definições dispersas entre telas; "rede municipal" explicada só no glossário e na ficha | Quadro curto "o que cada número cobre" |
| 6 | Localizar atendimento e resultado sem confundir períodos | `/atendimento` ("Ano do Censo Escolar"), `/resultados` ("Edição bienal"), tabela de `/comparar` com período no cabeçalho de cada coluna, aviso "não coincidem com o ano da despesa" | Sucesso | Sucesso | Sucesso | Sucesso | Na tabela cruzada, Ideb 2025 fica ao lado de despesa 2025; o cabeçalho esclarece, mas o alinhamento visual sugere correspondência | Marcar visualmente o grupo de colunas por período |
| 7 | Exportar o recorte e reconhecer limitações fora do site | `/gastos?med=despesa_hab&ano=2022&cap=natal&vis=tabela`: "Baixar estes valores (CSV)", "Dicionário das colunas (CSV)" | Parcial | Sucesso | Sucesso | Sucesso | CSV (32.842 bytes, 26 linhas, 36 colunas, `;` com BOM) traz estado, elegibilidade, conferência, nota, universo, versão, hash; ilegível para leigo; na tabela cruzada, `mediana_do_grupo` e `medida_de_referencia` se repetem em linhas de outras colunas | Linha de cabeçalho "leia antes de usar" no próprio CSV; evitar repetir a mediana de outra medida |
| 8 | Reproduzir um indicador a partir da documentação | `/metodos`: ficha, fórmula, "Exemplos de reprodução" (Aracaju, 2025), `python3 -m pipeline.eficiencia.run`, CSV estáticos | Não aplicável na prática | Parcial | Parcial | Sucesso com esforço | Documentação extensa; reprodução com Python não verificada por este avaliador (E, F, G e K são de outro avaliador) | Roteiro de uma página "do número na tela ao CSV" |

## 6. Problemas priorizados

**Alta (impedem 9,0 no critério afetado; nenhum é bloqueio de aprovação)**

1. **Rótulos colidem nas evoluções de Gastos** (critério H, A). R$ 673 e R$ 919 ficam sob o marcador e a linha da mediana (`/gastos?vis=evolucao&cap=recife&moeda=real`, 390 e 1440); R$ 11.327 sobre R$ 11.601 a 390 px e R$ 10.000 sobre R$ 8.481 em todas as larguras (`/gastos?med=despesa_mat&vis=evolucao&moeda=real&cap=natal`); "mudança de base" sobre "R$ 1.500" a 320 px. Capturas: ev/gastos-evolucao-recife-reais-390.png, gastos-evolucao-matricula-natal-lacunas-390.png, gastos-evolucao-rotulo-colide-eixo-320.png. Risco: valor ilegível ou lido como o da mediana.
2. **Eixo de Resultados não parte de zero, sem aviso, com hastes desenhadas da borda** (H). Ideb de 4,5 a 7, Saeb de 200 a 250 e aprovação de 88% a 100% em `/resultados` (ev/resultados-aprovacao-1440-pagina.png); o Panorama usa 0 a 10 para o mesmo Ideb. Risco: leitor interpreta diferença de 4,8 a 6,9 como muito maior do que a escala de 0 a 10 sugere.
3. **320 px compromete o gráfico principal** (H, J, A). Área de pontos de cerca de 110 px, rótulo "Mediana R$ 1,01 bilhão" cortado no eixo logarítmico com uma única marca de eixo; tabela cruzada com 1,5 coluna visível. Capturas: ev/gastos-hab-grafico-320.png, gastos-total-eixo-log-mediana-cortada-320.png, comparar-tabela-cruzada-320.png.
4. **Evolução por habitante pouco legível como tendência e com sinais incoerentes** (I, B, C). 3 de 4 transições interrompidas; manchete refere "dois períodos"; texto manda escolher "Moeda" para um controle chamado "Valores"; subtítulo "exercício 2025" sob série de 2021 a 2025; seletor Ano ativo sem efeito no gráfico.

**Média**

5. **Siglas sem expansão no ponto de uso** (B): DCA, RREO, MSC, ISCED, PPC, IPCA, Siconfi; nenhum `<abbr>` nas páginas; glossário só em Dados e métodos e sem links a partir dos termos. O "Perímetro" em toda visão de Gastos usa DCA e RREO.
6. **"Perímetro" não acompanha o grupo de comparação** (B, C). Com `grp=regiao` (Sudeste, 4 capitais), o texto cita Macapá (AP) e Porto Alegre (RS), que não estão no grupo.
7. **Manchetes sem base de preço e com nota concatenada** (B, D): "passou de R$ 8.481 em 2021 para R$ 11.601 em 2025" em reais de 2025, sem dizer na frase; na Evolução do Ideb a manchete inclui "Em 2021: edição afetada pela pandemia…". Frases viram citação e perdem a ressalva.
8. **Zero em escolas conveniadas sem explicação ao lado** (B): 12 de 26 capitais com 0 nos anos iniciais; a explicação (nenhuma matrícula declarada, confirmada na Sinopse) está na ficha e em Métodos. Texto padrão de referências ("turmas menores") não se aplica à medida.
9. **Contexto internacional e nacional lado a lado com as capitais** (D). Em `/gastos?med=despesa_mat`, US$ 4.999 (Brasil) e US$ 13.334 (média OCDE) em destaque com ressalvas; em Atendimento há dois "Brasil" para turma (22,0 e 20,9). As ressalvas existem, mas a leitura rápida pode virar ranking.
10. **Dados e métodos: extensão e jargão** (A, B, J). 16.411 px a 1440 e 32.270 px a 320; "Rodada 6", "PR #117, commit 8ad77db" e primeira pessoa ("Incluí-la") são linguagem de processo em página pública; matriz de referências com 1.604 px de largura.
11. **CSV da tabela cruzada repete `mediana_do_grupo` de outra medida em linhas de Ideb, turma e outras** (D, C): há `medida_de_referencia`, mas a coluna em formato longo convida a uso indevido.
12. **Botão "Comparar capitais" do Panorama perde `cap`**; "Baixar dados" não informa visualmente o tipo e o tamanho (JSON de 6,7 MB) (I).
13. **Situação "Incluída, com nota" em todas as 26 linhas da tabela** (`/gastos?...vis=tabela`), com a nota (metadado da população) escondida em "abrir detalhe": ruído que dilui notas realmente importantes (B).

**Baixa**

14. Cabeçalho a 768 px com "Comparar capitais" acima e "Dados e métodos" na linha das abas (ev/gastos-768-pagina.png).
15. O balão de valor cobre pontos vizinhos (ev/gastos-teclado-foco-grafico-1440.png).
16. Parâmetros de URL inválidos (`ano=1999`, `med=xxx`) caem no padrão sem aviso.
17. Linhas de evolução sem rótulo direto (mediana tracejada e capital; legenda só abaixo) e nota de rodapé "1" no topo da coluna de 2021, longe do ponto.
18. Alvos de links do rodapé com 17 px de altura (espaçamento vertical atende ao mínimo de 24 px de WCAG 2.5.8, mas abaixo do conforto de 44 px).
19. Rótulos de eixo em `--cor-mineral` sobre a faixa central: 4,47:1 (limiar 4,5:1); fora da faixa 4,92:1. Sem ocorrência confirmada em texto sobre a faixa.

**Riscos de interpretação indevida (resumo)**

* Eixo não zerado em Resultados (item 2) pode exagerar diferenças.
* Manchete de variação em reais sem a base de preço na frase (item 7).
* Gasto por matrícula próximo de valores por estudante da OCDE (item 9), mesmo com "outro universo".
* Série por habitante interrompida pode ser lida como "sem mudança" ou "sem dado" (item 4).
* Zeros em conveniadas lidos como ausência de dado (item 8).
* Colunas de ordenação e "diferença para a mediana" podem ser lidas como classificação; o texto negando a classificação existe e é claro.

Linguagem de julgamento: varredura por termos como melhor, pior, eficiente, ineficiente, desperdício, inchado, ranking, causa, efeito em todo o texto das páginas inspecionadas encontrou apenas negações e ressalvas ("não demonstra causalidade", "menor gasto não demonstra eficiência"). "Acima" e "abaixo" da mediana ou da referência são usados de modo descritivo.

## 7. Bloqueios de aprovação

**Nenhum bloqueio encontrado**, no escopo da experiência. O que foi testado:

* Valores incorretos: coerência de números entre tela, tabela e CSV em amostras. Mediana de despesa por habitante 2025 de R$ 1.160 em Panorama, Gastos e Comparar; tabela de `/gastos?med=despesa_hab&ano=2022&cap=natal&vis=tabela` com 26 linhas iguais ao CSV (26 linhas, Natal R$ 632); `/gastos?med=despesa_mat&ano=2022` com 23 capitais incluídas na tela, no resumo ("23 de 26") e no CSV (3 com valor vazio e motivo). Não é auditoria de cálculo (critério F, outro avaliador).
* Ausência tratada como zero: capitais excluídas aparecem como "sem valor, fora da comparação", com valor vazio no CSV; zeros de conveniadas são valores observados (Métodos V09).
* Exclusão no gráfico mas não no resumo ou CSV: consistentes nas amostras acima.
* Ressalva essencial escondida: o tamanho do JSON de 6,7 MB só para leitor de tela (baixo risco); demais ressalvas visíveis.
* Afirmação causal ou julgamento de eficiência: varredura de texto sem ocorrências.
* Perda funcional relevante, barreira a tarefa essencial: as 8 tarefas têm caminho no navegador; nenhuma foi impedida.

Observação: a nota de H do Gastos (8,2) e as de A, H e J nos itens de 320 px decorrem de defeitos de apresentação documentados, não de bloqueio.

## 8. Protocolo, ambiente e limitações

* **Ambiente:** Linux (kernel 6.18), Chromium headless da instalação Playwright 1.56.1 (`/opt/pw-browsers/chromium-1194`), servidor de produção local em `http://localhost:3100`, rota base `/eficiencia-estatal/educacao-municipal-capitais`. Rede local, medições de laboratório; nenhuma medição de desempenho foi tomada como "experiência real". Tempos de carga observados (cerca de 1,8 a 2,2 s até rede ociosa) são apenas informativos e não entram nas notas.
* **Larguras:** 320x800, 390x800/900, 768x900, 1440x900, com `deviceScaleFactor` 1; toque emulado por `hasTouch` e `isMobile` em 390.
* **Estados inspecionados:** `/`; `/?cap=recife`; `/gastos` (padrão, `cap=sao-paulo`, `cap=vitoria&grp=regiao`, `med=despesa_mat&ano=2022` com 3 capitais fora, `med=despesa_hab&ano=2022&cap=natal&vis=tabela`, `med=despesa_hab&vis=evolucao` com e sem `cap` e `moeda=real`, `med=despesa&eixo=log`, `med=despesa_mat&cap=recife&vis=detalhe`); `/atendimento` (turma, matrículas, conveniadas, tabela); `/resultados` (Ideb, aprovação, Saeb, evolução de Natal); `/comparar` (padrão, destaque de 4 capitais, tabela completa, ordenação, mudança de medida); `/metodos`.
* **Verificações automáticas:** axe-core 4.12.1 (regras wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa e best-practice) em 12 estados por 3 larguras (1440, 390, 320): **0 violações**; "incompletas" apenas `color-contrast` (SVG e fundos compostos). Contraste verificado à parte por cálculo: texto HTML sem falhas na amostra; pontos neutros 3,71:1 sobre o papel e 3,37:1 sobre a faixa (acima de 3:1 para elementos gráficos); eixo `--cor-mineral` 4,92:1 sobre o papel.
* **Verificações manuais:** teclado (ordem de tabulação, foco de 2 px, setas, Home e End nos gráficos; abas por setas; diálogo com foco preso e retorno do foco por Esc); estrutura de títulos e marcos (um `main`, `header`, `footer`, `nav` com rótulos, `lang="pt-BR"`); `prefers-reduced-motion` (animações 0, transições a 0,00001 s, rolagem automática); alvos de toque (medidos por bounding box); detector de sobreposição e corte de texto SVG em 24 estados por 4 larguras; links (54 internos e 13 CSV estáticos com resposta 200; 10 externos não acessados); downloads de CSV (valores, série, tabela cruzada, dicionário) e cópia de link com leitura da área de transferência; voltar do navegador.
* **Limitações:** sem leitor de tela real; sem aparelho físico; sem ampliação de 200% de texto nem tema de alto contraste do sistema; sem validação de impressão; sem usuários; páginas externas não abertas; cálculo e reprodução dos indicadores não auditados (E, F, G e K de outro avaliador). A nota 9,0 ou mais só foi atribuída onde há requisitos demonstrados, e nenhuma nota chegou a 9,5, pois falta validação adicional (leitor de tela real, aparelhos, usuários).

## 9. Observações para critérios de outros avaliadores (sem nota)

* **E (referências e comparabilidade):** pares só por região; sem pares por porte ou população (`Gastos`). Referência nacional "calculada pelo OBEE" (mediana R$ 2.125 de 5.060 municípios) aparece como linha no gráfico das capitais, com rótulo "Municípios do país" e aviso de universo diferente no Panorama. Em `/atendimento` há duas referências "Brasil" de definições distintas para turma.
* **F (rigor):** razão agregada e média simples explicadas lado a lado; Natal 2022 está incluída na despesa por habitante e excluída na despesa por matrícula (verificação da MSC contra a DCA), o que a tela explica, mas é visível como diferença de elegibilidade entre medidas. A despesa por matrícula usa numerador de aplicação direta enquanto total e por habitante usam a função inteira sem intraorçamentárias.
* **G (rastreabilidade):** CSV de recorte com estado, elegibilidade, conferência, universo, versão metodológica, data e hash; dicionário em CSV; 12 séries e JSON de gold; versões 1.1 a 1.3. O CSV da tabela cruzada repete mediana de outra medida (item 11).
* **K (confiabilidade técnica):** console sem erros de aplicação nas sessões; um `reqfail` em `/?_rsc=…` (cancelamento de pré-carregamento ao navegar) sem efeito visível; JSON de 6,7 MB oferecido ao público geral.

## 10. Lista de capturas (PNG em `docs/obee/avaliacao/rodada-2/evidencias/experiencia/`)

Página inteira ("pagina") ou primeira tela ("topo"), com largura no nome.

* Panorama: `panorama-320-pagina.png`, `panorama-390-pagina.png`, `panorama-768-pagina.png`, `panorama-1440-pagina.png`, `panorama-capital-recife-1440-pagina.png`
* Gastos, padrão e tabela: `gastos-320-pagina.png`, `gastos-390-pagina.png`, `gastos-768-pagina.png`, `gastos-1440-pagina.png`, `gastos-capital-sp-1440-topo.png`, `gastos-tabela-natal-2022-1440.png`
* Gastos, por matrícula 2022 com capitais fora: `gastos-matricula-2022-390-pagina.png`, `gastos-matricula-2022-1440-pagina.png`
* Gastos, evolução: `gastos-evolucao-320-pagina.png`, `gastos-evolucao-390-pagina.png`, `gastos-evolucao-768-pagina.png`, `gastos-evolucao-1440-pagina.png`, `gastos-evolucao-recife-reais-390.png`, `gastos-evolucao-recife-reais-1440.png`, `gastos-evolucao-matricula-natal-lacunas-390.png`, `gastos-evolucao-matricula-natal-lacunas-1440.png`, `gastos-evolucao-rotulo-colide-eixo-320.png`
* Gastos, outras: `gastos-hab-grafico-320.png`, `gastos-total-eixo-log-mediana-cortada-320.png`, `gastos-teclado-foco-grafico-1440.png`, `gastos-ponte-recife-390-pagina.png`, `gastos-ponte-recife-1440-pagina.png`, `gastos-total-ao-numerador-1440-pagina.png`
* Atendimento: `atendimento-320-pagina.png`, `atendimento-390-pagina.png`, `atendimento-768-pagina.png`, `atendimento-1440-pagina.png`, `atendimento-matriculas-1440-pagina.png`, `atendimento-conveniadas-1440-pagina.png`, `atendimento-sobre-este-dado-1440.png`
* Resultados: `resultados-320-pagina.png`, `resultados-390-pagina.png`, `resultados-768-pagina.png`, `resultados-1440-pagina.png`, `resultados-aprovacao-390-pagina.png`, `resultados-aprovacao-1440-pagina.png`, `resultados-evolucao-natal-1440-pagina.png`, `resultados-ideb-grafico-320.png`
* Comparar capitais: `comparar-320-pagina.png`, `comparar-390-pagina.png`, `comparar-768-pagina.png`, `comparar-1440-pagina.png`, `comparar-tabela-completa-1440-pagina.png`, `comparar-tabela-cruzada-320.png`, `comparar-tabela-cruzada-390.png`, `comparar-tabela-cruzada-1440.png`
* Dados e métodos: `metodos-320-topo.png`, `metodos-390-topo.png`, `metodos-768-topo.png`, `metodos-1440-topo.png`, `metodos-matriz-referencias-tabela-390.png`, `metodos-matriz-referencias-tabela-1440.png`

Nota sobre a captura de `metodos-matriz-referencias-tabela-*`: mostra a tabela de fontes e capturas (a terceira tabela da página); a matriz de referências, com 1.604 px de largura, foi medida por script, não capturada isoladamente.
