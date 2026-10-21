# Avaliação de experiência, rodada 1

**Identificação:** Avaliador de experiência, agente independente, rodada 1. Critérios pontuados: A, B, C, D, H, I, J. Os critérios E, F, G e K são de outro avaliador e não são pontuados aqui.

**Natureza da avaliação:** inspeção heurística feita por um agente de IA, com navegador real (Chromium via Playwright), leitura do código e dos dados. Não há participantes, depoimentos, tempos nem taxas de sucesso. Nenhum leitor de tela real foi usado. As notas são privadas e valem para a qualidade dos painéis, não das administrações.

**Resultado em uma linha:** nenhum painel atinge 9,0 em todos os critérios. Notas entre 6,8 e 8,3. Há um defeito de verdade na evolução de gasto por habitante (o título diz que o gráfico marca a ruptura de série e o gráfico não marca), cortes de rótulos em 320 px, e dois controles sem indício de que abrem (Comparar e Métodos).

---

## 1. Matriz (painel, critério, nota)

Resumo das notas. O detalhe, com justificativa, evidência e correção, está na seção 2.

| Painel | A Layout | B Didática | C Utilidade | D Relevância | H Visualizações | I Navegação | J Acessib. e responsiv. | Mínima |
|---|---|---|---|---|---|---|---|---|
| Panorama | 8,3 | 7,3 | 7,0 | 7,8 | 7,6 | 8,0 | 8,2 | 7,0 |
| Gastos | 8,2 | 7,8 | 8,2 | 7,6 | 7,3 | 8,3 | 7,4 | 7,3 |
| Atendimento | 8,2 | 7,6 | 7,4 | 7,5 | 7,5 | 8,2 | 7,4 | 7,4 |
| Resultados | 8,2 | 7,5 | 7,4 | 7,4 | 7,5 | 8,2 | 7,4 | 7,4 |
| Comparar capitais | 7,6 | 7,2 | 7,6 | 7,5 | 7,5 | 7,2 | 6,9 | 6,9 |
| Dados e métodos | 6,8 | 7,4 | 7,0 | 7,4 | 7,2 | 6,8 | 7,3 | 6,8 |
| **Mínima por critério** | 6,8 | 7,2 | 7,0 | 7,4 | 7,2 | 6,8 | 6,9 | |

Não há painel filho que mereça nota própria: o diálogo "Sobre este dado" e as visões Gráfico, Tabela, Evolução e Detalhe (por etapa, composição, ponte) são estados de Gastos, Atendimento e Resultados e foram avaliados dentro deles.

Regra de aprovação (9,0 em cada critério, em cada painel): **não atendida em nenhuma das 42 células.** Possíveis bloqueios de aprovação que encontrei, para o avaliador dos critérios E e F confirmar: (a) título da evolução afirma que o gráfico marca uma ruptura que o gráfico não desenha (seção 4, P1); (b) causa possível de ressalva essencial pouco visível: motivo de exclusão de capital fica 1.300 a 1.900 px abaixo da frase que o anuncia (P4). Não afirmo bloqueio de dados: não recalculei valores.

### 2. Matriz detalhada

Em toda linha, o avaliador é o mesmo (agente independente, rodada 1) e a nota é inspeção heurística. "Por que não menos" é a justificativa para não receber nota inferior. Capturas em `evidencias/experiencia/`.

#### 2.1 Panorama (raiz, `?cap=`, `?med=`)

| Crit. | Nota | Justificativa (atende; limita; por que não menos) | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,3 | Atende: pergunta, recorte e número principal na primeira tela (título, subtítulo "Quanto se gasta, quem é atendido e quais resultados são observados", mediana, menor e maior com nome da capital), três capítulos numerados, bandas de contexto separadas do dado. Limita: no celular a faixa e os rótulos empilham (Curitiba, mediana e mínimo ficam coladas); a segunda e a terceira seção só mostram uma medida cada. Por que não menos: hierarquia limpa, sem cartões redundantes, ~480 palavras. | panorama-padrao-1440; panorama-capital-curitiba-390 | Separar melhor os rótulos de capital e mediana quando o valor é próximo (390 px). |
| B | 7,3 | Atende: cada capítulo diz o que o número é ("Não é gasto por aluno", "Razão orçamentária, não custo do aluno"), frases factuais com a capital. Limita: "Qual é o Ideb?" não define Ideb nem expande a sigla na página (só no diálogo); INEP, Siconfi/STN, "R$ correntes" não são explicados no texto visível; a aba Total usa escala logarítmica, dita só no título do eixo ("escala logarítmica"), sem explicar o que isso muda. Por que não menos: o diálogo "Fonte e critérios" resolve a um clique, e as definições curtas das abas existem. | Texto de `main` (busca por Ideb, INEP, corrente); panorama-total-escala-log-natal-1440 | Definir Ideb e "R$ correntes" em uma linha no próprio capítulo; avisar na aba Total que a escala é logarítmica e o que isso significa para a distância entre pontos. |
| C | 7,0 | Atende: gasto por habitante, por matrícula e total com mediana, extremos, faixa central e contexto nacional (R$ 2.125 de 5.060 municípios, marcado como outro universo); capital opcional; links para aprofundar. Limita: não há valores reais (só "R$ correntes"); atendimento é só alunos por turma de anos iniciais (não responde "quem é atendido": quantas matrículas, quais etapas); resultado é só Ideb de anos iniciais; sem grupo de pares. Por que não menos: é entrada, e leva a Gastos, Atendimento, Resultados e Comparar preservando a capital. | panorama-padrao-1440; teste de tarefas T1, T3, T6 | Dizer no capítulo 02 que atende só um recorte e abrir um caminho de uma ação para matrículas e etapas; indicar, na aba de gasto, que existe a versão em reais de 2025 em Gastos. |
| D | 7,8 | Atende: pergunta de família ("quanto se gasta, quem é atendido, quais resultados"), sem jargão no título, aviso de que a leitura conjunta não demonstra causalidade, link para baixar dados, link para métodos. Limita: nenhuma visão de acesso, cobertura ou desigualdade (só médias da rede municipal); download é um JSON de 6,7 MB cujo formato e tamanho só aparecem para leitor de tela (`sr-only`). Por que não menos: transparência de universo e período acima do usual e compartilhamento por URL. | `FaixaConferir` em `PanoramaInterativo.tsx`; panorama-padrao-1440 | Mostrar o formato e o tamanho do download à vista; oferecer CSV do recorte no Panorama. |
| H | 7,6 | Atende: faixa horizontal com mínimo, mediana, faixa central e capital destacada; gráfico de pontos de referência para atendimento e resultados com eixo 0 a 10 no Ideb; tabela equivalente por alternância; gráficos com `role="img"` e resumo textual. Limita: escala logarítmica na aba Total sem aviso destacado; rótulos próximos se sobrepõem (min e capital em Por matrícula); estado Tabela fica em estado local, não na URL. Por que não menos: valores nunca dependem de hover. | panorama-total-escala-log-natal-1440; árvore de acessibilidade (img com rótulo) | Aviso curto de escala log; afastar rótulos. |
| I | 8,0 | Atende: abas por seta, Home e End; capital e aba na URL; voltar e avançar percorrem as escolhas (testado: 3 voltas coerentes); capital acompanha a navegação para Gastos, Atendimento e Resultados. Limita: o botão Gráfico/Tabela não vai à URL; "Baixar dados" é o JSON completo; o `cap` acompanhado chega a Comparar, que o ignora (P8). Por que não menos: nada exige instruções externas e o efeito de cada controle é imediato. | Roteiro t6/hist (Playwright): URLs `?cap=florianopolis&med=despesa`, histórico | Levar Tabela/Gráfico à URL; fazer Comparar acolher `cap`. |
| J | 8,2 | Atende: axe 0 violações (WCAG 2.0 a 2.2 AA e boas práticas) em 320, 390, 768 e 1440; foco visível (2 px) em todas as 34 paradas de Tab testadas (na página Gastos); link "Pular para o conteúdo"; zoom de página a 200% e 400% sem rolagem horizontal; alvos de 44 px; movimento reduzido tratado em `globals.css`. Limita: leitor de tela real não verificado; a 320 px com texto a 200% o H1 transborda; links do rodapé têm 17 px de altura. Por que não menos: nenhum problema funcional de teclado ou de reflow no painel. | `axe.mjs`; `kb.mjs`; `zoom.mjs`; panorama-topo-320 | Reduzir H1 em 320 px com texto ampliado; aumentar alvo dos links do rodapé (componente compartilhado). |

#### 2.2 Gastos (`/gastos`)

| Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,2 | Atende: cabeçalho, três escalas lado a lado como cartões que também são seletor, título que enuncia o achado ("vai de R$ 702 em Belém (PA) a R$ 2.362 em Vitória (ES)..."), controles junto do gráfico, referências depois. Limita: o gráfico só começa abaixo da dobra em 1440 x 900 (y ≈ 1.250) e quase na terceira tela em 390; o bloco de cartões repete mediana e extremos que reaparecem na seção de referências. Por que não menos: fluxo claro e sem parede de texto. | gastos-padrao-1440; gastos-padrao-768 | Subir o gráfico (compactar o cabeçalho) ou deixar a seção de referências só com o que o título e os cartões não trazem. |
| B | 7,8 | Atende: cada escala traz definição e "o que não é"; distinção gasto por habitante, por matrícula e total; "Valores nominais" e "Reais de 2025 (IPCA)" explícitos; diálogo "Sobre este dado" com "O que mede" e "O que não mede" em linguagem simples (16 campos). Limita: o padrão é nominal (a frase "passou de R$ 232,2 milhões em 2021 para R$ 566,4 milhões em 2025" aparece sem aviso de inflação fora do subtítulo pequeno); motivos de exclusão em jargão ("DCA", "intraorçamentárias") sem tradução; evolução por habitante tem título que descreve a limitação e não a série (P1); linha tracejada "Municípios do país" fora da legenda. Por que não menos: o texto central é inteligível para quem não conhece o orçamento. | gastos-capital-curitiba-reais-1440; gastos-2021-capital-excluida-1440; gastos-dialogo-sobre-este-dado-390 | Tornar real o padrão ou avisar, junto da frase, que o valor é corrente; traduzir DCA e intraorçamentária no motivo; incluir a referência nacional na legenda. |
| C | 8,2 | Atende T1, T3, T4, T5 (seção 3): com a capital escolhida, os três cartões dão total, por habitante e por matrícula juntos; reais constantes em um toque; evolução com mediana de comparação; exclusões listadas; referência nacional calculada e contexto internacional declarado como outro universo; CSV do recorte. Limita: o grupo de comparação é sempre as 26 capitais (sem porte, região ou pares escolhidos); evolução sem valores por ponto (só último); a evolução e o detalhe não têm CSV. Por que não menos: é o único painel em que a resposta ao conjunto de perguntas da rubrica está a no máximo 4 ações. | Roteiro t8, t9, t12, csv.mjs | Permitir grupo de pares (porte ou região, com critério explícito); rótulos dos valores na evolução; CSV da série. |
| D | 7,6 | Atende: urgência e ressalva ao lado do número ("Não é gasto por aluno"); link de recorte copiável; funciona sem formação técnica na primeira camada. Limita: não aborda acesso, cobertura nem desigualdade dentro da cidade; o título "Gastos" sem pergunta cidadã na camada de entrada. Por que não menos: o recorte é compartilhável e a limitação principal está à vista. | gastos-capital-curitiba-reais-1440 | Frases de uso ("como ler") curtas para famílias e conselhos. |
| H | 7,3 | Atende: gráfico de pontos por capital em escala comum, mediana rotulada, faixa central, extremos nomeados, capital destacada, ordem alfabética ou por valor, escala log opcional só em Total com explicação, tabela equivalente, sem eixo duplo. Limita (verificado): (1) a 390 px os rótulos do eixo "R$ 2.000" e "R$ 3.000" se sobrepõem, e o eixo vai a R$ 3.000 para um máximo de R$ 2.362; (2) a 320 px os nomes "Belo Horizonte (MG)" e "Campo Grande (MS)" são cortados à esquerda e "R$ 2.362" à direita; (3) na evolução por habitante, 25 das 26 capitais exibem o título "o gráfico marca a ruptura", e o gráfico é uma linha contínua sem marca (SVG sem elemento para isso); (4) o SVG da evolução é `aria-hidden` e só mostra o valor do último ano. Por que não menos: a base (pontos, mediana, faixa) é a escolha certa para a pergunta. | gastos-grafico-eixo-sobreposto-390; gastos-rotulos-cortados-320; gastos-evolucao-ruptura-sem-marca-1440; `clip2.mjs`, `clip.mjs`, `t11.mjs` | Desenhar a quebra (linha interrompida e marca) ou retirar a afirmação; limitar o eixo ao máximo arredondado e filtrar ticks que colidem; reservar margem de rótulo em 320 px; rotular todos os pontos da evolução ou mostrar valor ao foco. |
| I | 8,3 | Atende: todo o recorte na URL (`cap`, `med`, `ano`, `etapa`, `moeda`, `disc`, `vis`, `ord`, `eixo`); voltar e avançar coerentes (testado, 6 passos); parâmetros inválidos caem para o padrão sem erro; Copiar link com aviso (e mensagem útil se a área de transferência é negada); CSV; diálogo com foco preso e retorno do foco ao botão (Esc testado). Limita: parâmetros inválidos não avisam (só a seleção mostra o valor efetivo); em Detalhe, o controle "Valores" continua visível mas o texto traz "R$ correntes" (inócuo); a frase "o motivo está ao lado" aponta para um bloco 1.300 a 1.900 px abaixo (P4). Por que não menos: nenhuma ação do painel ficou sem efeito claro na visão principal. | Roteiros t13 (20 URLs), hist.mjs, dlg.mjs, t25.mjs | Esconder "Valores" no Detalhe; ancorar o motivo de exclusão junto do título ou do ponto. |
| J | 7,4 | Atende: axe 0 violações em oito estados; teclado (setas, Home, End no gráfico; grupo com rótulo que cita a tabela); foco visível; zoom 200% e 400% sem rolagem horizontal; alvos de 44 px; sem cor como único canal (capital destacada tem tamanho, negrito e legenda). Limita: cortes a 320 px e sobreposição a 390 px (H); SVG `aria-hidden` com resumo só no grupo; leitor de tela real não verificado. Por que não menos: o conteúdo continua acessível pela Tabela equivalente. | `axe.mjs`; `clip2.mjs`; gastos-foco-teclado-1440 | Corrigir clipping; garantir tabela equivalente ao lado do gráfico (link âncora). |

#### 2.3 Atendimento (`/atendimento`)

| Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,2 | Mesma estrutura de Gastos: três medidas (Matrículas na rede, Em escolas conveniadas, Alunos por turma), título que enuncia o achado. Limita: os três cartões misturam unidades diferentes (34.844 matrículas, 34, 25,0) na mesma linha; o cartão "Em escolas conveniadas" mostra "34" (mediana de 0 a 9.097), sem explicar a mediana de zeros. Por que não menos: hierarquia consistente. | atendimento-padrao-1440 | Mostrar a quantidade de capitais com zero conveniadas ao lado da mediana. |
| B | 7,6 | Atende: "Uma matrícula não é uma pessoa", "contadas à parte da rede", etapa só onde existe, zeros legítimos da etapa (0, 0,0%) tratados com soma conferida ("Soma das etapas: 246.325, igual ao total da rede"), nota sobre educação especial. Limita: a seção de referências repete "Menor gasto não demonstra eficiência..." em página que não trata de gasto (cópia do tema Gastos); o texto do contexto internacional (OCDE) é longo e traz outro universo. Por que não menos: o painel distingue matrícula, conveniada e turma com clareza. | atendimento-padrao-1440; atendimento-matriculas-por-etapa-1440 | Trocar o aviso de referência por um específico de atendimento (média de turma não mede qualidade nem oferta de vagas). |
| C | 7,4 | Atende: etapas e populações atendidas por capital (detalhe por etapa com barras e %), turma média com referência nacional INEP de 22,0, comparação com mediana. Limita: nenhuma medida de cobertura (matrículas em relação à população em idade escolar), demanda ou fila; não responde "quem fica de fora"; sem recortes de desigualdade. Por que não menos: responde "quem é atendido na rede" com o dado que existe. | atendimento-padrao-1440; matriculas-por-etapa | Dizer explicitamente que o painel mostra a rede, não a cobertura da população; planejar medida de cobertura. |
| D | 7,5 | Atende: etapas (creche a EJA) visíveis, conveniadas separadas, notas ao pé. Limita: ausência de cobertura e de desigualdades não é registrada como ausência socialmente relevante (só em Métodos); EJA e profissional aparecem como zeros sem comentário. Por que não menos: torna visíveis as etapas atendidas, que é a primeira pergunta de famílias. | atendimento-matriculas-por-etapa-1440 | Registrar na própria página "o que este painel não mostra" (cobertura, demanda). |
| H | 7,5 | Atende: gráfico de pontos, barras de composição por etapa com percentual e soma conferida, tabela. Limita: mesmos cortes a 320 px e sobreposição de eixo; nenhum marcador para capitais com mais de uma ressalva. Por que não menos: barras de composição são a forma correta para parte do todo. | atendimento-matriculas-por-etapa-1440; `clip2.mjs` | Corrigir clipping. |
| I | 8,2 | Atende: mesma mecânica de Gastos, `etapa` válida por medida (as opções se limitam ao que existe); Detalhe por etapa disponível só com capital escolhida (diz isso). Limita: em Detalhe, o seletor "Etapa de ensino" continua visível sem efeito. Por que não menos: nenhum estado de erro alcançável (varredura de 39 recortes mostra cobertura menor que 26 em alguns anos e etapas, sempre com explicação). | `empty.mjs`; atendimento-matriculas-por-etapa-1440 | Ocultar o seletor de etapa no Detalhe. |
| J | 7,4 | Idem Gastos (axe 0; teclado; foco; zoom). Mesmos cortes a 320 px. Por que não menos: reflow e alvos corretos. | `axe.mjs`; `clip2.mjs` | Corrigir clipping. |

#### 2.4 Resultados (`/resultados`)

| Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 8,2 | Estrutura igual às demais; título do gráfico enuncia o achado ("O Ideb nos anos iniciais vai de 4,8 em Natal (RN) a 6,9 em Curitiba (PR) e Teresina (PI)"), empates nomeados. Limita: eixo começa em 4,5 (aceitável para pontos, mas sem aviso). Por que não menos: hierarquia consistente. | resultados-padrao-1440 | Informar o eixo truncado em uma linha. |
| B | 7,5 | Atende: edição bienal explícita, "Ano letivo", aprovação separada de Ideb e Saeb, "escala própria por disciplina", nota de pandemia em 2021. Limita: Ideb e Saeb não têm a sigla expandida no corpo (só no glossário e no diálogo); a seção de referências repete o aviso de gasto; nenhum aviso na página de que resultado educacional depende de contexto e não é efeito da gestão (só no Panorama e em Métodos); mensagem de exclusão com jargão ("Código '--' na planilha do INEP"). Por que não menos: os períodos estão sempre ao lado do número. | resultados-padrao-1440; resultados-aprovacao-finais-2021-excluidas-1440; `t24.mjs` | Incluir ressalva própria do tema (contexto socioeconômico e amostragem do Saeb); traduzir mensagens de exclusão; expandir siglas. |
| C | 7,4 | Atende: Ideb, aprovação e Saeb por etapa e ano, em recorte comparável (23 a 26 capitais conforme a etapa, com contagem exibida), referência INEP, pandemia anotada. Limita: sem contexto de composição do alunado, sem associação com gasto (por decisão, correta); a evolução de aprovação não rotula pontos; a anotação de pandemia ("1") aparece no topo do eixo e não junto do ponto de 2021. Por que não menos: período e universo do resultado estão corretos e à vista. | resultados-aprovacao-evolucao-natal-1440 | Ancorar a anotação no ponto; acrescentar rótulos. |
| D | 7,4 | Atende: resultados observados por etapa, com explicação das capitais sem dado e de por quê ("a rede municipal não tem matrícula na etapa no Censo 2021"). Limita: leitura sem desigualdade interna, sem contexto; a opção "Por valor, crescente" em resultados convida a ler como ranking sem contraponto na página. Por que não menos: o painel preserva a ausência como ausência. | resultados-aprovacao-finais-2021-excluidas-1440 | Aviso de uso da ordenação em Resultados. |
| H | 7,5 | Gráfico de pontos adequado; mediana e referência nacional visíveis; evolução com mediana tracejada e nota de que o número de capitais varia entre anos. Limita: mesmos cortes a 320 px; rótulo da anotação desacoplado do ponto. Por que não menos: sem eixo duplo nem cores moralizantes. | resultados-aprovacao-evolucao-natal-1440 | Idem H de Gastos. |
| I | 8,2 | Igual a Gastos: URL, histórico, CSV, disciplina (Matemática e Língua Portuguesa), ano que cai na edição anterior quando o ano pedido não é edição (ex.: `ano=2022` mostra 2021 e o seletor mostra 2021). Por que não menos: o efeito é visível no seletor. | `t13.mjs` | Avisar quando o ano pedido na URL foi ajustado. |
| J | 7,4 | Idem Gastos. Por que não menos: reflow e teclado corretos, axe 0. | `axe.mjs`; `clip2.mjs` | Corrigir clipping. |

#### 2.5 Comparar capitais (`/comparar`)

| Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 7,6 | Atende: a primeira tela mostra a pergunta, a medida, o recorte e o gráfico das 26 capitais; a tabela tem grupos de colunas rotulados. Limita: sem capital destacada, o gráfico é idêntico ao de Gastos (redundante); o seletor de capitais fica num bloco fechado sem indício visual; a tabela tem 12 colunas e rolagem dentro de rolagem. Por que não menos: o painel não usa elementos de ornamento e a estrutura é previsível. | comparar-padrao-1440; comparar-tabela-completa-1440 | Abrir o seletor por padrão ou dar-lhe indício de expansão; destacar o que a página acrescenta ao Gastos (tabela cruzada). |
| B | 7,2 | Atende: "Ordem por valor não é classificação de eficiência", linha "razão agregada" explicada, cabeçalhos de colunas com o grupo e a etapa. Limita: a coluna Saeb não diz a disciplina no cabeçalho; texto longo sobre a edição e a cobertura antes da tabela; "Diferença para a mediana do grupo" aplica a uma medida escolhida acima e o nexo exige leitura. Por que não menos: avisos de comparação corretos e visíveis. | comparar-tabela-completa-1440 | Inserir a disciplina no cabeçalho do Saeb; ligar visualmente o seletor de Medida à coluna destacada. |
| C | 7,6 | Atende: duas formas de comparação (gráfico por medida e tabela cruzada das 9 medidas com mediana, média, mínimo e máximo), até 5 capitais destacadas, ordenar por qualquer coluna, CSV da tabela de 261 linhas autoexplicativo (36 colunas no CSV de recorte). Limita: não há grupo de pares (porte, região); só a ordenação serve a "pares"; a tabela a 320 ou 390 px mostra uma coluna por vez. Por que não menos: é o único lugar que cruza gasto, atendimento e resultado de uma mesma capital. | `cmp.mjs`; comparar-tabela-390; csv.mjs | Pares com critério explícito; em celular, alternar para visão por capital (cartão). |
| D | 7,5 | Atende: compartilhável (URL com `dest`), aviso sobre ordem. Limita: em celular a tabela cruzada é pouco utilizável, sem coluna fixa para comparação entre duas capitais; nenhum contexto de desigualdades. Por que não menos: facilita controle social ao permitir verificar a própria cidade ao lado de outras. | comparar-tabela-320 | Visão de duas capitais lado a lado para celular. |
| H | 7,5 | Atende: mesmo gráfico de pontos; tabela com destaque de coluna e linha. Limita: cortes a 320 px e sobreposição de eixo a 390 px (idem Gastos); "Tabela completa" sem barras ou escala de apoio. Por que não menos: tabela é a forma adequada para cruzar medidas. | `clip.mjs`; comparar-tabela-completa-1440 | Idem H de Gastos. |
| I | 7,2 | Atende: URL com `dest`, `vc`, `ot`, `od`; ordenar por cabeçalho (aria-sort); limpar destaques; limite de 5 com aviso; Copiar link; CSV. Limita (verificado): (1) "Destacar capitais" é um `details` sem marcador nem chevron (`display:flex` suprime o marcador), parece rótulo estático; (2) o menu Gastos, Atendimento e Resultados repassa `?cap=` para `/comparar`, que o ignora (destaque "nenhuma"); (3) marcar a sexta capital remove a mais antiga sem aviso no momento (o aviso fica dentro do bloco fechado); (4) nome da capital na tabela é botão com aparência de link e sem `aria-pressed`. Por que não menos: os controles são previsíveis depois de descobertos. | comparar-destacar-sem-indicio-de-abrir-1440; `t20.mjs`; `cmp.mjs` | Chevron ou botão "Escolher capitais"; acolher `cap` como destaque; `aria-pressed` nos botões da tabela. |
| J | 6,9 | Atende: tabela em região rolável com teclado, `aria-sort`, legenda; axe 0 violações (incluindo o estado de tabela com destaques). Limita: a 320 px a tabela mostra a coluna Capital e uma única coluna (286 px de largura útil, conteúdo de 1.016 px) em caixa com rolagem vertical e horizontal aninhadas; a coluna ordenada pode estar fora da vista; cortes de rótulo no gráfico (320 px). Por que não menos: nada impede a tarefa (rolar, ordenar, baixar) e o painel avisa sobre a rolagem. | comparar-tabela-320; comparar-tabela-390; `cmp2.mjs` | Alternativa em cartões por capital no celular; fixar a coluna da medida escolhida. |

#### 2.6 Dados e métodos (`/metodos`)

| Crit. | Nota | Justificativa | Evidência | Correção necessária |
|---|---|---|---|---|
| A | 6,8 | Atende: abre com "Como ler" em três famílias de medidas; fichas listadas; uso de tipografia para separar seções. Limita: 6.477 palavras, 16.400 px em 1440 e 29.500 px em 320; 13 subseções h3 numeradas por código interno (V02 a V19, M01 a M04, "Política 1.2", "seed", sha256) no corpo; só dois links de âncora no topo e nenhum índice persistente. Por que não menos: o início organiza o assunto e a divisão em duas partes (como ler, fichas e reprodução) é correta. | metodos-topo-1440; metodos-topo-390; `t4.mjs` | Índice lateral ou fixo; mover validações e códigos internos para uma camada secundária. |
| B | 7,4 | Atende: glossário (DCA, RREO, Siconfi, liquidada, intraorçamentária, IPCA...), "O que está incluído, período, fonte" por família, parágrafos que dizem o que não se infere ("menor gasto não demonstra eficiência"). Limita: vocabulário de contabilidade (modalidade 90, MSC, natureza C e D) entra sem rampa; as validações usam códigos; não há exemplo numérico trabalhado do indicador principal (despesa por habitante). Por que não menos: o texto explica o que cada indicador não é. | metodos-topo-1440 | Sequência didática: exemplo numérico com uma capital antes das regras; resumo de uma linha por validação. |
| C | 7,0 | Atende: para o pesquisador, traz fórmula, perímetro, conferência DCA e RREO, exclusões com a capital e o ano, matriz de referências aceitas e rejeitadas, fontes e capturas. Limita: para gestor e conselho, o essencial (o que muda a decisão) não está destacado; são 45 `details` e nenhuma síntese de limitações no topo. Por que não menos: é rara a transparência sobre o que foi rejeitado e por quê. | `t4.mjs`; `t26.mjs` | Resumo de "o que este painel não permite concluir" no início. |
| D | 7,4 | Atende: facilita controle social (links diretos para séries em CSV e para fontes oficiais, avisos de pendências). Limita: o leitor leigo não chega aqui por si e a densidade o afasta. Por que não menos: nenhuma ressalva essencial fica fora da página. | `t4.mjs` | Ponte a partir de cada "Sobre este dado" para a seção correspondente. |
| H | 7,2 | Adaptado (não há gráficos): três tabelas com legenda, região rolável rotulada e foco; barras de composição só nas visões de Gastos. Limita: tabelas largas (705, 832 e 1.467 px em 286 px) exigem rolagem horizontal no celular. Por que não menos: tabelas têm `caption` e região acessível. | `t26.mjs` | Quebrar a matriz em cartões em celular. |
| I | 6,8 | Limita (verificado): 44 dos 45 `summary` usam `display:flex` e perdem o marcador de expansão; os "Exemplos de reprodução" são 8 linhas que parecem texto estático e só abrem ao clique; sem índice, sem "voltar ao topo". Atende: a ficha completa abre em lista com "ABRIR"; links diretos `#como-ler` e `#metodos`. Por que não menos: nenhum estado quebra e o diálogo "Sobre este dado" a partir dos painéis alcança a mesma ficha. | metodos-exemplos-reproducao-1440; `t5.mjs` | Chevron nos `summary`; índice de seções. |
| J | 7,3 | Atende: axe 0 violações; tabelas em regiões com rótulo e `tabindex`; foco visível. Limita: com texto a 200% em 390 px a página tem 531 px de largura (sobra de `dt`, `dd` e blocos de código `block` sem quebra); alvos pequenos em rodapé. Por que não menos: o reflow por zoom de página funciona (720 e 360 px sem rolagem horizontal). | `zoom.mjs` | Permitir quebra de linha em `code` e `dt`. |

---

## 3. Testes de tarefas (inspeção heurística por agente)

Fonte: execução real no navegador (Chromium, Playwright) em 1440, 390 e 320 px. São simulações de perfis feitas por um agente: não há usuário real, tempo ou taxa de sucesso. "Intervenção" é qualquer ajuda de fora (documentação, código) de que o perfil precisaria. Registrei o número de ações (cliques e seleções) do caminho mais curto, apenas como indicador de esforço.

Perfis: **F** familiar ou cidadão; **P** professor ou jornalista; **G** gestor ou conselho de educação; **Q** pesquisador.

| # | Tarefa | Perfis | Caminho (tela) | Resultado | Obstáculos e erros |
|---|---|---|---|---|---|
| 1 | Gasto por habitante e por matrícula de uma capital | F, P, G | Panorama: "Destacar capital" (Natal), ler a frase e trocar a aba Por matrícula (2 a 3 ações). Ou Gastos: escolher a capital, os três cartões mostram R$ 654,6 milhões, R$ 835 e R$ 11.601 de uma vez (1 ação). | Sucesso | No Panorama o valor sai em R$ correntes, sem explicar; em Gastos as três escalas lado a lado são o melhor caminho. |
| 2 | Comparar com um grupo elegível e identificar a referência | P, G, Q | Gastos: título e subtítulo dizem "26 de 26 capitais", mediana R$ 1.160 e a diferença ("R$ 27 acima"); seção "Referências para ler o número" mostra mediana, média, razão agregada e faixa central. | Sucesso parcial | O único grupo é "todas as capitais estaduais". Quem queira pares por porte ou região não consegue definir (Comparar permite destacar até 5 capitais, mas a mediana segue sendo de 26). |
| 3 | Interpretar mudança em reais constantes | P, G | Gastos: escolher capital, "Evolução", "Reais de 2025 (IPCA)" (3 ações). Frase: "passou de R$ 290,9 milhões em 2021 para R$ 566,4 milhões em 2025" (em reais de 2025). | Sucesso para total e matrícula; falha de leitura para por habitante | Em despesa por habitante o título da evolução fala da ruptura de base populacional, em 25 de 26 capitais, e o gráfico não marca a ruptura (P1); o padrão é nominal, e a frase nominal não alerta para inflação. |
| 4 | Entender por que uma observação foi excluída | F, Q | Gastos com `ano=2021`: bloco "1 capital fora desta comparação: Campo Grande (MS), perímetro distinto..." (a 1.300 px abaixo do gráfico). Resultados: "Boa Vista (RR): Não aplicável" com o motivo. | Sucesso com esforço | O gráfico não tem linha para a capital excluída; escolhida a capital, a frase diz "o motivo está ao lado" mas o motivo está bem abaixo; jargão ("DCA", "intraorçamentárias", "Código '--' na planilha do INEP"). |
| 5 | Distinguir rede municipal, função Educação e população residente | F, P, Q | Gastos: cartões ("Despesa liquidada ÷ população residente. Não é gasto por aluno"; "aplicação direta ÷ matrículas da rede municipal"), diálogo "O que não mede", Métodos "Três famílias de medidas". | Sucesso | A distinção está em três camadas (cartão, diálogo, métodos); a camada de Métodos é extensa. |
| 6 | Localizar atendimento e resultado sem confundir períodos | F, P, G | Panorama com capital: capítulos 02 e 03 mostram "2025" (Censo) e "edição 2025" (Ideb) em linhas separadas; Resultados mostra "edição" e "Ano letivo" no seletor. Comparar, tabela: nota "Ideb e Saeb usam a edição 2025". | Sucesso | Gasto (exercício), matrícula (Censo, maio) e Ideb (edição) têm períodos diferentes e isso só se vê lendo as legendas; no celular, a tabela esconde colunas. |
| 7 | Exportar o recorte e reconhecer limitações fora do site | P, Q | Gastos ou Resultados: "Baixar estes valores (CSV)" (arquivo `obee_gastos_despesa_hab_2023.csv`, 26 linhas, 36 colunas com universo, grupo de comparação, estado do dado, motivo de exclusão, nota, versão metodológica, hash, fonte). Comparar: tabela completa (261 linhas). | Sucesso | CSV só existe em Gráfico e Tabela (não em Evolução nem Detalhe); o Panorama só oferece o JSON de 6,7 MB (formato e tamanho só no texto para leitor de tela); a 36 colunas repete longos textos em todas as linhas. |
| 8 | Reproduzir um indicador a partir da documentação | Q | Métodos: ficha (fórmula, numerador, denominador), série CSV com `numerador` e `denominador`, "Como reproduzir" (comandos do pipeline), "Exemplos de reprodução" (Aracaju, 2025). | Sucesso parcial | Os 8 exemplos passo a passo cobrem despesa total, subfunção, matrículas, conveniadas, turma, aprovação, Ideb e Saeb; **não cobrem despesa por habitante nem por matrícula nem população**, os indicadores principais; os exemplos estão em `details` sem indício de abrir. |

Resumo por perfil, sempre como inspeção heurística:

* **F (familiar ou cidadão):** consegue 1, 5 e 6 sem ajuda. Esbarra em 4 (jargão de contabilidade) e em termos como Ideb e "R$ correntes", não explicados no Panorama.
* **P (professor ou jornalista):** consegue 1, 2, 3 (total) e 7. Corre risco de usar "Por valor, crescente" em Resultados como ranking, pois a página não alerta (ver P6).
* **G (gestor ou conselho):** consegue 1, 2 e 6. Não obtém pares comparáveis por porte nem região (limite de C) nem informação de cobertura.
* **Q (pesquisador):** consegue 4, 5, 7 e quase 8. Precisa abrir `details` sem indício para os exemplos.

Nenhuma tarefa foi bloqueada (sem barreira total). A tarefa 3 (por habitante) e a 8 (indicadores principais) têm falhas parciais.

---

## 4. Problemas priorizados

Gravidade alta: bloqueio ou barreira a tarefa essencial. Média: prejudica compreensão ou confiança sem impedir a tarefa. Baixa: refinamento.

### Alta

**P1. Título da evolução diz que o gráfico marca a ruptura, e o gráfico não marca.** Em `/gastos?med=despesa_hab&vis=evolucao`, 25 das 26 capitais exibem como título: "Entre 2021 e 2025 a população de referência muda de base (estimativa, Censo ou relação do DOU): os valores desses dois períodos não são diretamente comparáveis, e o gráfico marca a ruptura." O SVG é uma linha contínua, sem interrupção, marca ou anotação (código: `fraseEvolucao` em `src/lib/eficiencia/frases.ts` linha 154 afirma; `MiniSerie` em `src/components/eficiencia/graficos.tsx` não tem tratamento de `quebraSerie`). O leitor vê uma alta de ~55% em reais entre 2021 e 2022 (Curitiba, real) desenhada como tendência, e o título não diz o que a série mostra. Afeta tarefa 3. Evidência: `gastos-evolucao-ruptura-sem-marca-1440.png`; `t11.mjs`. **Correção:** desenhar a ruptura (quebra da linha e marca no ano de mudança de base) e manter o título factual da série, com a ressalva em linha própria; ou, enquanto isso, retirar a afirmação sobre o gráfico. Possível bloqueio ("ressalva essencial escondida" ou afirmação sobre a visualização não sustentada): sinalizo para o avaliador de E e F confirmar.

**P2. Em 320 px, nomes de capitais e valor máximo são cortados nos gráficos de pontos** (Gastos, Atendimento, Resultados, Comparar). "Belo Horizonte (MG)" e "Campo Grande (MS)" perdem os primeiros caracteres (lidos como "3elo" e ":ampo"); "R$ 2.362" é cortado à direita a 320 e 360 px. A 390 px, "R$ 2.000" e "R$ 3.000" do eixo se sobrepõem, e o eixo se estende a R$ 3.000 para um máximo de R$ 2.362. A rubrica exige funcionar em 320 e 390 px sem esconder informação essencial. Evidência: `gastos-rotulos-cortados-320.png`, `gastos-grafico-eixo-sobreposto-390.png`, `clip2.mjs`, `clip.mjs`. **Correção:** margem esquerda do gráfico calculada pelo maior rótulo, truncamento com reticências e título completo na tabela, filtro de ticks por colisão, domínio do eixo limitado ao máximo arredondado.

**P3. Comparar e Métodos têm controles sem indício de que abrem.** `Destacar capitais` (Comparar) e os 8 exemplos de reprodução e demais `summary` de Métodos (44 de 45) perdem o marcador por `display:flex`; parecem texto estático. Sem abrir "Destacar capitais", o leitor não encontra como destacar capitais, uma das duas funções principais da página. Evidência: `comparar-destacar-sem-indicio-de-abrir-1440.png`, `metodos-exemplos-reproducao-1440.png`, `cmp.mjs`, `t26.mjs`. **Correção:** chevron e estado visual no `summary` (ou botão com `aria-expanded`); abrir por padrão o seletor de capitais.

**P4. Capital excluída da comparação some do gráfico e a explicação fica longe.** A linha da capital simplesmente não existe no gráfico de pontos; a frase da capital escolhida diz "o motivo está ao lado" e o motivo está 1.300 a 1.900 px abaixo, em bloco "1 capital fora desta comparação". Afeta tarefa 4 (entender por que uma observação foi excluída). Evidência: `gastos-2021-capital-excluida-1440.png`; `t19.mjs` (motivo em y=2.118 px; gráfico termina em y=2.090). **Correção:** mostrar a linha da capital como "fora da comparação" no próprio gráfico, ou colocar o motivo logo abaixo da frase e trocar "ao lado" por uma âncora.

### Média

**P5. Panorama usa termos sem definição e escala logarítmica sem explicação.** "Qual é o Ideb?" não define Ideb nem expande a sigla; INEP, Siconfi/STN e "R$ correntes" só nas fichas; aba Total em escala log dita apenas no título do eixo. Evidência: `t15.mjs`, `panorama-total-escala-log-natal-1440.png`. **Correção:** uma linha de definição por capítulo; aviso de escala log.

**P6. Resultados e Atendimento herdam o aviso de gasto e não têm aviso próprio sobre o que resultado não é.** "Menor gasto não demonstra eficiência, e gasto maior não demonstra qualidade" aparece em páginas de turma e de Ideb; nenhuma delas diz que resultado depende de contexto e não mede a gestão, e Resultados oferece "Por valor, crescente". A advertência de causalidade só existe no Panorama (faixa final) e em Métodos. Risco de interpretação: ranking de qualidade da administração. Evidência: `t24.mjs`. **Correção:** aviso próprio por tema, perto da ordenação; manter a rubrica editorial.

**P7. Evolução sem valores por ponto e sem CSV; Detalhe sem CSV.** Só o último ano é rotulado; os demais valores exigem abrir "Ver tabela". O botão "Baixar estes valores (CSV)" não existe em Evolução nem em Detalhe. Evidência: `t23.mjs`, `t25.mjs`. **Correção:** rotular todos os pontos ou mostrar valor ao foco; oferecer a série em CSV.

**P8. Contexto da capital se perde ao ir para Comparar.** A navegação leva `?cap=natal` a `/comparar`, que o ignora (destaque "nenhuma"). Evidência: `t20.mjs`. **Correção:** acolher `cap` como destaque inicial.

**P9. Tabela cruzada a 320 e 390 px: uma coluna por vez, em caixa com rolagem aninhada.** Evidência: `comparar-tabela-320.png`, `comparar-tabela-390.png`. **Correção:** visão por capital em cartões ou comparação de duas capitais no celular.

**P10. Métodos é uma parede de texto técnica, sem índice.** 6.477 palavras, 16.400 px em 1440, 29.500 px em 320; códigos internos (V02 a V19, M01 a M04, "Política 1.2", "seed"). Evidência: `metodos-topo-1440.png`, `t4.mjs`. **Correção:** índice, resumo de limitações no topo, validações em camada secundária.

**P11. Exemplos de reprodução não cobrem os indicadores principais.** Faltam despesa por habitante, despesa por matrícula e população. Evidência: `t17.mjs`. **Correção:** acrescentar exemplos passo a passo.

**P12. Padrão nominal na evolução de gasto sem aviso junto da frase.** "passou de R$ 232,2 milhões em 2021 para R$ 566,4 milhões em 2025" (Aracaju, nominal) vs R$ 290,9 milhões em reais de 2025. O subtítulo tem "R$ correntes" em corpo pequeno. Evidência: `t12.mjs`. **Correção:** padrão em reais constantes na evolução, ou aviso junto da frase.

**P13. Painel não responde "quem fica de fora" (cobertura, desigualdades).** Atendimento mostra matrículas, etapas e turmas; não há cobertura nem recortes de desigualdade, e isso não está registrado como ausência na própria página. **Correção:** registro explícito do que o painel não mostra e plano de medida de cobertura.

### Baixa

* **P14.** Em Detalhe, "Valores" (Gastos) e "Etapa de ensino" (Atendimento) continuam visíveis sem efeito.
* **P15.** Linha tracejada de referência nacional não consta da legenda do gráfico de pontos (aparece só como rótulo no rodapé do gráfico).
* **P16.** Anotação de pandemia ("1") fica no topo do eixo, longe do ponto de 2021.
* **P17.** "Por valor, crescente" não tem opção decrescente nos gráficos (Comparar tabela tem).
* **P18.** Parâmetros inválidos de URL são aceitos em silêncio e a URL não é normalizada (`ano=1900` mostra 2021, `med=ideb` em Gastos mostra por habitante); o seletor mostra o valor efetivo.
* **P19.** Estado Tabela/Gráfico do Panorama não está na URL.
* **P20.** A 768 px o item "Comparar capitais" fica numa linha acima da navegação, desalinhado.
* **P21.** Sem JavaScript o painel mostra o recorte padrão e não o do link (página estática com estado lido no cliente).
* **P22.** Links do rodapé com 17 px de altura; a 390 px com texto a 200% o rodapé tem 30 px de rolagem horizontal (componente compartilhado, fora do painel).
* **P23.** Nome do observatório ("Eficiência Estatal") pode sugerir julgamento; o painel diz que não classifica. Observação editorial, sem nota.

### Riscos de interpretação indevida

1. **Ranking de qualidade:** "Por valor, crescente" em Resultados e Atendimento sem aviso próprio (P6).
2. **Causalidade entre gasto e resultado:** o aviso existe no Panorama (faixa final) e em Métodos, não nas páginas de tema. Os painéis não cruzam gasto e resultado numa mesma tela fora de Comparar (tabela cruzada com notas de limite, mas sem aviso próprio ali; só o rodapé).
3. **Ruptura de série lida como tendência:** P1 (a mais séria).
4. **Variação nominal como real:** P12.
5. **Referência nacional como meta:** bem tratada ("Esse valor não é diretamente comparável"; "não são meta"). Em Gastos a linha tracejada "Municípios do país R$ 2.125" está no mesmo gráfico das capitais; o texto abaixo adverte o universo diferente, mas a legenda não.
6. **Ressalvas escondidas:** nota informativa colapsada ("Nota", a exemplo de Aracaju: "Valor vigente no SIDRA...") é aceitável; ressalva material fica visível. O motivo de exclusão fica longe (P4).

---

## 5. Observações fora do meu escopo (critérios E, F, G, K)

* **Console:** só um erro, 404 de `/favicon.ico` (o site não declara ícone). Nenhum erro de script.
* **Peso:** cerca de 2,7 a 2,9 MB por página (sem compressão medida), com o RSC de rotas vizinhas pré-carregadas (Comparar 579 KB, Métodos 402 KB). Download completo em JSON é 6,7 MB. Não medi tempo.
* **Rastreabilidade:** CSV de recorte inclui `hash_dados`, `versao_metodologica`, `dados_gerados_em`, `fonte`, `numerador`, `denominador` (nas séries). Isso parece forte para G, mas não conferi os hashes.
* **Recomputação:** não recalculei valores; os resumos (mediana R$ 1.160 etc.) vieram da própria interface.
* **Ideb 2025 e Saeb 2025:** aparecem como edição existente; não verifiquei a fonte.

---

## 6. Bloqueios encontrados

Dentro do meu escopo (experiência), **nenhum bloqueio total de tarefa**: todas as 8 tarefas têm um caminho que dá resultado, duas com ressalvas (3 e 8). Candidatos a bloqueio de aprovação a confirmar pelo avaliador de E e F: P1 (afirmação sobre o gráfico) e P4 (ressalva essencial longe do dado).

---

## 7. Protocolo, ambiente e limitações

**Ambiente:** servidor local `http://localhost:3100` (build de produção, mantido por outros agentes); HEAD do repositório visto: `be2063947` (inclui só a rubrica sobre `277264514`). Não verifiquei se o build servido corresponde ao HEAD. Chromium de `/opt/pw-browsers/chromium` via Playwright, headless. Produção (`scrutiniums.com`) não verificada.

**Protocolo:**
1. Leitura da rubrica e do código das visões (`src/app/eficiencia-estatal/educacao-municipal-capitais`, `src/components/eficiencia`, `src/lib/eficiencia`).
2. Navegação em 320, 390, 768 e 1440 px nas 6 rotas, com capturas.
3. Interações reais: seleção de capital, abas, alternâncias, ordenação, Evolução, Detalhe, escala log, moeda real, destaque e limpeza de capitais, tabela completa, ordenação por coluna, CSV (3 downloads inspecionados), cópia de link (com e sem permissão), diálogos "Sobre este dado" (foco, Esc, retorno do foco), voltar e avançar (6 passos), 20 URLs inválidas ou de borda, varredura de 3 temas × 9 medidas × anos × etapas (cobertura de 22 a 26 capitais, nenhum estado vazio total alcançável).
4. Teclado: 34 paradas de Tab em Gastos com foco visível; setas no gráfico.
5. axe-core (WCAG 2.0, 2.1, 2.2 A e AA e boas práticas) em 10 estados × 4 larguras: 0 violações.
6. Zoom de página 200% e 400% (720 e 360 px), texto a 200% (raiz 32 px) em 390 e 320, espaçamento de texto WCAG 1.4.12, movimento reduzido (leitura de `globals.css`), contraste dos tokens (mineral sobre papel 4,92:1; carvão sobre papel 9,67:1).
7. Teste de tarefas em quatro perfis simulados.

**Roteiros usados** (rascunho, fora do repositório): `/tmp/claude-0/-home-user-scrutiniums/14988d95-8e30-552f-94af-d7de0041bce8/scratchpad/aval-exp/*.mjs`. Não usei os roteiros de `scripts/obee/` como prova.

**Não verificado:**
* Leitor de tela real (NVDA, VoiceOver, TalkBack): só árvore de acessibilidade do navegador.
* Toque real em dispositivo: só emulação de viewport; o código trata `pointerdown`, mas não testei gesto.
* Contraste dos elementos gráficos não textuais (pontos cinza neutro `--cor-obee-neutro`): não calculado.
* Navegadores além do Chromium; impressão.
* Produção e correspondência exata entre o build local e o HEAD.
* Exatidão numérica dos valores (critérios E e F).
* Tempo de carregamento percebido; piscada de conteúdo no primeiro quadro em links com estado (a página estática renderiza o padrão e hidrata o estado do link; não medi).

**Limitações do método:** inspeção por agente tem viés de quem conhece o código; os perfis não trazem a confusão de usuários reais. As notas refletem a ausência de requisitos demonstrados para 9, não um julgamento sobre as administrações.

---

## 8. Capturas (30 arquivos, 5,3 MB) em `evidencias/experiencia/`

Panorama: `panorama-padrao-1440`, `panorama-capital-curitiba-390`, `panorama-topo-320`, `panorama-total-escala-log-natal-1440`.
Gastos: `gastos-padrao-1440`, `gastos-padrao-768`, `gastos-capital-curitiba-reais-1440`, `gastos-evolucao-ruptura-sem-marca-1440`, `gastos-detalhe-ponte-matricula-1440`, `gastos-2021-capital-excluida-1440`, `gastos-grafico-eixo-sobreposto-390`, `gastos-rotulos-cortados-320`, `gastos-dialogo-sobre-este-dado-390`, `gastos-foco-teclado-1440`.
Atendimento: `atendimento-padrao-1440`, `atendimento-topo-390`, `atendimento-matriculas-por-etapa-1440`.
Resultados: `resultados-padrao-1440`, `resultados-saeb-390`, `resultados-aprovacao-evolucao-natal-1440`, `resultados-aprovacao-finais-2021-excluidas-1440`.
Comparar: `comparar-padrao-1440`, `comparar-destaques-768`, `comparar-destacar-sem-indicio-de-abrir-1440`, `comparar-tabela-completa-1440`, `comparar-tabela-390`, `comparar-tabela-320`.
Métodos: `metodos-topo-1440`, `metodos-topo-390`, `metodos-exemplos-reproducao-1440`.
