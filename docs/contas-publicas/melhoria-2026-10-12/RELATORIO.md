# Relatório de melhoria dos painéis de Contas Públicas Federais

Data de referência: 12/10/2026 · Base avaliada: branch `main`, commit `ed2b020` · Escopo: rotas `/contas-publicas`, `/contas-publicas/[capitulo]`, `/contas-publicas/dados`, `/contas-publicas/metodologia`.

Público do painel: cidadão leigo, jornalista, estudante e gestor não especialista. Exigência: rigor máximo no dado, didática e acabamento visual de referência internacional.

## 1. Síntese executiva

**Estado atual.** O rigor de dados é alto e raro: proveniência por arquivo com SHA256, conciliações documentadas, ausência separada de zero, ressalvas visíveis e 30 testes do domínio aprovados. A camada de comunicação ainda fala para quem já domina finanças públicas. O leigo encontra números em escala que não lê bem (R$ 5.835,4 bi), termos técnicos sem definição imediata (dotação, empenho, liquidação, localizador, acima da linha), cores que mudam de significado entre painéis e nenhum artefato que mostre o percurso do dinheiro de ponta a ponta.

**Cinco decisões que destravam o salto de qualidade.**

1. Criar um formatador numérico único com escala automática (trilhão, bilhão, milhão), sinal de menos tipográfico e precisão fixa por tipo de medida.
2. Instituir tokens de cor semânticos e eliminar o uso do bronze para quatro significados distintos.
3. Construir seis artefatos didáticos com dados já integrados, sem nova fonte: régua de R$ 100 pagos, escada dos estágios da despesa, ponte fiscal do RTN, ciclo de vida dos restos a pagar, barra de cumprimento por meta e régua de R$ 100 de custo.
4. Introduzir glossário embutido (termo sublinhado com definição acessível) e uma página de glossário com referência normativa para cada verbete.
5. Corrigir sete incoerências de rigor e layout listadas na seção 4 antes de qualquer embelezamento.

**Nota atual (autoavaliação, não independente).** Média ponderada pela rubrica do projeto entre 6 e 7 em todas as páginas; didática visual é o critério mais baixo (4 a 6). Meta: 9 em cada critério, demonstrado com capturas e verificação manual.

## 2. Método e evidência coletada

| Evidência | Resultado |
|---|---|
| Leitura integral do código das 5 rotas e 6 componentes de `src/components/contas-publicas/` e dos modelos em `src/lib/contas-publicas/` | Base do diagnóstico por tela |
| Capturas de página inteira em 1440 px e 390 px, 8 rotas, servidor Next local em 12/10/2026 | Seis capturas "antes" nesta pasta |
| axe-core, regras WCAG 2.0 A/AA e 2.1 AA, 5 rotas em 1440 px | 0 violações automáticas. Não substitui leitor de tela, teclado e zoom de 200%, que **não foram verificados** |
| `npx vitest run src/tests/contas-publicas*.test.ts` | 4 arquivos, 30 testes aprovados |
| Rolagem horizontal da página em 390 px | Ausente nas 8 rotas |

Altura das páginas em 390 px, medida na captura: início 11.282 px (13,4 telas de 844 px), catálogo 11.443 px, metas 8.038 px, custos 7.826 px.

## 3. Diagnóstico por tela

Formato: **Evidência** (o que está na tela ou no código) · **Inferência** (efeito provável no leitor leigo) · **Recomendação**.

### 3.1 Início (`/contas-publicas`)

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| I1 | Primeira tela em 390 px ocupada por título, lead e três perguntas; nenhum número até a segunda tela (captura `antes-inicio-celular.jpg`) | O leigo não recebe resposta concreta antes de rolar | Abrir com três respostas curtas calculadas dos dados (ver artefato A0) | Alta |
| I2 | "Pago no exercício R$ 5.054,2 bi" (SIOP, exercício 2025, base atualizada em 24/01/2026) sem indicar que 35,1% desse valor é Amortização da Dívida (R$ 1.771,6 bi), que inclui refinanciamento | Leitura provável: "o governo gastou R$ 5 trilhões com o cidadão". É o maior risco de interpretação errada do observatório | Mostrar o cartão com decomposição imediata: dívida (juros + amortização) R$ 2.135,1 bi, 42,2% do pago, e demais grupos; artefato A1 | Crítica |
| I3 | Valores em "R$ 5.835,4 bi" e "R$ 2.332,6 bi" | Bilhões com quatro dígitos são mal lidos por leigos; "5.835" é confundido com 5 bilhões | Escala automática: "R$ 5,84 trilhões"; manter valor exato no detalhe | Crítica |
| I4 | Texto "o saldo foi de R$ -42,9 bilhões. A diferença nominal é de R$ -18,8 bilhões" (RTN, edição jul/2026) | Sinal negativo com hífen e "diferença negativa" de um déficit é ambíguo: piorou ou melhorou? | Frase calculada em linguagem natural: "O déficit primário passou de R$ 42,9 bi em 2024 para R$ 61,7 bi em 2025, aumento nominal de R$ 18,8 bi, sem correção pela inflação" | Alta |
| I5 | Gráfico "Resultado em anos completos" com escala de ±800; 2020 em R$ 743,3 bi de déficit comprime 2021 (R$ 35,1 bi) a 2,2% da largura | Anos recentes parecem iguais; a pandemia domina a leitura | Manter escala comum e anotar 2020 diretamente; oferecer alternância "ocultar 2020 e reescalar" com aviso visível de mudança de escala | Média |
| I6 | Seção "O percurso da gestão" sem classe `cp-section`: o título encosta na linha de fonte do RTN (captura `antes-inicio-fiscal.jpg`) | Quebra de ritmo; parece parte do painel fiscal | Aplicar `cp-section` | Alta, correção trivial |
| I7 | Painéis de orçamento e fiscal repetidos integralmente no início e nos capítulos `execucao` e `panorama`; fichas apontam para `/contas-publicas#...` | Duplicação, página inicial longa, dois endereços para o mesmo conteúdo | No início, versão resumida (artefato A0 e A1) com link; painel completo só no capítulo; fichas apontam para o capítulo | Média |
| I8 | Percentuais com precisão variável: "24%" ao lado de "42,9%" (função `percentual` com `maximumFractionDigits:1`) | Aparência de descuido; leitor supõe arredondamentos diferentes | Uma casa decimal fixa em participações | Alta, correção trivial |

### 3.2 Panorama e Execução (`/contas-publicas/panorama`, `/contas-publicas/execucao`)

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| E1 | Caixa "Contrato metodológico inicial" exibida no topo de capítulos que já têm dados observados | Contradição: o leitor não sabe se pode confiar nos números abaixo | Texto de status derivado do estado real: "Dados observados para X; pendente Y" | Alta |
| E2 | "Cinco estágios, uma escala" em barras quase idênticas (5.719,4 a 5.054,2) | A diferença relevante (o que não avançou de um estágio ao outro) fica invisível | Artefato A2, escada com degraus: 2025 teve R$ 456,0 bi de dotação atualizada não empenhada, R$ 224,7 bi empenhados não liquidados e R$ 100,5 bi liquidados não pagos no exercício | Alta |
| E3 | Juros e amortização em bronze; o mesmo bronze indica déficit, 2024 em custos e redução em custos | Cor sem significado estável; o leitor associa bronze a "ruim" | Tokens semânticos (seção 6) | Alta |
| E4 | Termos sem definição no ponto de uso: dotação, empenho, liquidação, GND, acima da linha, programação financeira | Abandono ou leitura incorreta | Glossário embutido (artefato A7) | Alta |

### 3.3 Restos a pagar (`/contas-publicas/restos-a-pagar`)

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| R1 | Na abertura de 2026, os cartões "Saldo a pagar" e "Total inscrito e reinscrito" mostram o mesmo valor, R$ 391,55 bi (base RAP 2026, Tesouro, publicada em 29/01/2026) | Dois cartões iguais parecem erro | Na abertura, substituir o segundo cartão pela participação de 2025 na origem do saldo (R$ 325,15 bi, 83,0%) ou pela participação de não processados | Alta |
| R2 | 22 barras de exercício de origem, com cauda de valores abaixo de R$ 1 bi visualmente nula | Gráfico longo, pouca informação por pixel | Faixas de idade (origem no ano anterior, dois a três anos, quatro a cinco, seis ou mais) com tabela exata preservada | Média |
| R3 | O conceito de RAP é explicado em parágrafo; não há representação do ciclo | O leigo não entende por que um compromisso de 2019 ainda está aberto | Artefato A4, linha do tempo do empenho até pagamento ou cancelamento | Alta |
| R4 | Visão de encerramento: pagamentos, cancelamentos e saldo como três barras separadas | A identidade base = pago + cancelado + saldo não é vista como partição | Barra única 100% empilhada com rótulos diretos | Média |

### 3.4 Custos (`/contas-publicas/custos`)

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| C1 | No grupo "Todos os custos", os dois destaques do bloco escuro apontam o mesmo componente, Financeiros (+R$ 167,4 bi e +10,4% real; RFC 2025, publicado em 17/06/2026) | Repetição ocupa o espaço mais nobre da página | Quando o vencedor coincidir, fundir em um destaque e liberar o espaço para a maior queda | Média |
| C2 | Nomes de categorias contábeis (Financeiros, Outros Custos, Previdenciários e Assistenciais) sem descrição | O leigo não sabe o que é "Financeiros" | Uma linha de definição por categoria, extraída do próprio RFC com página citada; sem texto inventado | Alta |
| C3 | Bloco escuro `#182b36` destoa do restante editorial claro e não existe em outros painéis | Quebra de identidade visual | Avaliar superfície clara com régua de destaque; se mantido, transformá-lo em componente reutilizado | Baixa |
| C4 | Variação de Outros Custos (−34,5% nominal) é efeito da revisão metodológica de 2024, explicada só em nota abaixo da tabela | Leitor atribui a queda a gestão | Anotar a barra de Outros Custos e Previdenciários diretamente com "classificação revisada" | Alta |

### 3.5 Metas e entregas (`/contas-publicas/metas`)

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| M1 | Em 390 px, a tabela rola horizontalmente e as colunas Meta, Realizado e Razão ficam fora da tela; a primeira dobra mostra apenas títulos cortados | A tarefa principal da página não é realizável no celular | Linha em duas camadas: título curto e barra de cumprimento com números abaixo, sem rolagem; tabela completa como alternância | Crítica |
| M2 | Localizadores aparecem como código ("36901 · 0035"); o nome do local só existe no detalhe | Seis linhas iguais de "8585 Atenção à Saúde" sem distinção legível | Exibir nome do localizador na linha | Alta |
| M3 | Razão apresentada só como número: "205,78%", "2,64%" | Sem referência visual da meta, o leitor não percebe a distância | Artefato A5, barra com marca da meta atual e da original, cor neutra, extensão além de 100% preservada | Alta |
| M4 | Precisão variável: "100%", "100,8%", "93,53%" | Descuido aparente | Uma casa decimal fixa | Alta, correção trivial |
| M5 | Detalhe da programação aparece abaixo das 25 linhas, longe da linha escolhida | Perda de contexto ao clicar | Painel lateral fixo no desktop; no celular, expansão logo abaixo da linha | Média |
| M6 | Todos os títulos sublinhados como links | Textura pesada, hierarquia plana | Sublinhado apenas em foco ou hover; affordance pela linha inteira | Média |

### 3.6 Catálogo (`/contas-publicas/dados`) e Metodologia

| # | Evidência | Inferência | Recomendação | Prioridade |
|---|---|---|---|---|
| D1 | Cinco botões de download empilhados antes de qualquer conteúdo | Ruído para o leigo; prioridade invertida | Bloco único "Dados abertos" ao final, em tabela com conteúdo, formato, tamanho e data | Média |
| D2 | 24 fichas em sequência; 20 com "Integração pendente" | Sensação de painel vazio | Matriz de cobertura 12 capítulos × estado (artefato A10) acima da lista, filtro por estado | Alta |
| D3 | Contagem "4 indicadores têm recortes observados", mas a página de custos já publica dados | Incoerência entre catálogo e painéis | Explicitar "4 indicadores com recorte observado e 1 painel complementar de custos, que não homologa indicador" | Alta |
| D4 | Metodologia: oito cartões de regras em texto corrido | Correto, porém árido | Cada regra com um exemplo concreto do próprio painel (ex.: "Pago no exercício não inclui RAP: veja R$ 391,55 bi em restos a pagar") | Baixa |

## 4. Incoerências de rigor a corrigir primeiro

1. Caixa "Contrato metodológico inicial" em capítulos com dados (E1).
2. Contagem de cobertura do catálogo que ignora o painel de custos (D3).
3. Ausência de alerta de refinanciamento no número mais visível do site (I2).
4. Precisão percentual variável em orçamento e metas (I8, M4).
5. Sinal negativo com hífen e frase ambígua sobre variação do déficit (I4).
6. Cor bronze com quatro significados (E3).
7. Espaçamento ausente na seção do percurso (I6).

## 5. Artefatos didáticos propostos

Todos usam dados já presentes em `src/lib/contas-publicas/snapshots/`. Nenhum exige fonte nova, exceto A9, que fica condicionado à homologação.

| Código | Artefato | Pergunta que responde | Dados | Forma | Regra de rigor |
|---|---|---|---|---|---|
| A0 | Três respostas na abertura | "Quanto o governo federal pagou?", "Arrecadou mais do que gastou?", "Quanto ficou para pagar depois?" | `dados.json`, `rap.json` | Três frases com número, período e fonte, cada uma com link ao capítulo | Frases geradas pelo mesmo contrato dos gráficos; nenhuma adjetivação |
| A1 | Régua de R$ 100 pagos | "De cada R$ 100 pagos em 2025, para onde foi?" | SIOP 2025, pago por GND | Barra 100% ou grade 10 × 10 com rótulos diretos: R$ 35,1 amortização, R$ 7,2 juros, R$ 45,6 outras despesas correntes, R$ 7,9 pessoal, R$ 3,4 inversões, R$ 0,8 investimentos (SIOP, exercício 2025) | Arredondamento pelo maior resto para somar 100 (investimentos tem participação exata de 0,748% e recebe o décimo residual); nota de que amortização inclui refinanciamento; não chamar o restante de "gasto com serviços" |
| A2 | Escada dos estágios | "Quanto do autorizado avançou em cada etapa?" | SIOP, cinco estágios | Escada com degraus rotulados pela diferença entre estágios | Diferença não é desperdício nem economia; texto fixo explicando reserva, contingenciamento e RAP |
| A3 | Ponte fiscal | "Como a receita vira resultado primário?" | RTN, identidades conciliadas | Cascata: receita total, menos transferências a estados e municípios, receita líquida, menos quatro grupos de despesa, resultado | Só usar porque as identidades são exatas e testadas; anotar "acima da linha, não apura meta fiscal" |
| A4 | Ciclo de vida do RAP | "Por que existe compromisso de 2019 aberto em 2026?" | Conceito e `rap.json` | Linha do tempo: empenho, inscrição em 31/12, reinscrição, pagamento ou cancelamento; abaixo, faixas de idade | Processado e não processado como estados na inscrição; não inferir atraso |
| A5 | Barra de cumprimento por meta | "Quanto do prometido foi entregue nesta ação?" | AFFO 2025 | Barra horizontal do realizado com marcador da meta atual e marcador tracejado da original; acima de 100% a barra ultrapassa o marcador | Cor única neutra; sem verde ou vermelho; ausência e meta não positiva como estados textuais |
| A6 | Régua de R$ 100 de custo | "De cada R$ 100 de custo contábil da União em 2025, qual a natureza?" | RFC 2025 | Barra 100% com drill por grupo, sincronizada ao seletor existente | Nunca somar pai e filho; itens fora do custo em régua separada |
| A7 | Glossário embutido | "O que significa este termo?" | Textos normativos (MTO, Manual de Contabilidade Aplicada ao Setor Público, glossário do Tesouro) | Termo com sublinhado pontilhado, definição em popover acessível por teclado e toque, link à página `/contas-publicas/glossario` | Cada verbete com fonte e data de consulta; nenhuma definição sem referência |
| A8 | Faixa de proveniência padronizada | "De onde vem e quando é este número?" | Metadados dos snapshots | Componente único com fonte, período de referência, publicação, captura, perímetro, unidade e natureza (observado ou calculado) | Datas de referência, publicação e captura distintas; nulas exibidas como "não identificada" |
| A9 | Escala humana (por habitante e % do PIB) | "Quanto isso representa por pessoa ou na economia?" | **Fonte nova**: população IBGE e PIB IBGE | Conversões ao lado dos totais | Só após homologação, com referência temporal compatível. Não implementar nesta fase |
| A10 | Matriz de cobertura | "O que já tem dado e o que falta?" | `catalogo.ts` | Grade 12 capítulos × estados (observado, parcial, pendente) com contagem | Estado derivado do catálogo, sem edição manual |

## 6. Sistema visual

**Tokens semânticos** (mapear aos tokens existentes em `src/app/globals.css`, verificar contraste mínimo de 4,5:1 para texto e 3:1 para marcas gráficas):

| Papel | Uso | Base sugerida |
|---|---|---|
| `--cp-foco` | Série principal, ano corrente | `--cor-obee-dark` |
| `--cp-referencia` | Ano anterior, meta, comparação | Cinza azulado neutro, não bronze |
| `--cp-financeiro` | Juros, amortização, custos financeiros | Bronze escuro, apenas para esta categoria |
| `--cp-negativo` | Valores abaixo de zero em eixo divergente | Tom distinto de `--cp-financeiro`, sem vermelho |
| `--cp-pendente` | Estados ausente, pendente, não calculável | Hachura ou contorno, nunca preenchimento colorido |

**Formatador único** em `src/lib/contas-publicas/formato.ts`, substituindo `bilhoes`, `moeda`, `bi`, `n` e `percentual` espalhados:

* Moeda com escala automática: a partir de R$ 1 trilhão, duas casas ("R$ 5,05 trilhões"); entre R$ 1 bilhão e R$ 1 trilhão, uma casa ("R$ 391,5 bilhões"); abaixo, "milhões" com uma casa.
* Forma curta "tri", "bi", "mi" só em gráficos; cartões e frases usam a palavra completa.
* Sinal de menos tipográfico U+2212; sinal de mais explícito apenas em variações.
* Participações e razões com uma casa decimal fixa; variação em pontos percentuais escrita "p.p." e distinta de variação percentual.
* Valor exato sempre disponível em `title`, tabela ou detalhe.

**Tipografia de números.** Algarismos tabulares em todas as tabelas e cartões; alinhamento à direita.

**Movimento.** Transição de barras de até 200 ms ao trocar filtro, desligada sob `prefers-reduced-motion`.

## 7. Plano de execução

| Fase | Conteúdo | Critério de aceite |
|---|---|---|
| 1 · Rigor e coerência | Seção 4 inteira; formatador único; tokens semânticos | Nenhum número em "bi" acima de 999; nenhum hífen como sinal; status coerente em todos os capítulos; testes do formatador |
| 2 · Artefatos com dados existentes | A0 a A6, A8, A10 | Cada artefato com pergunta, unidade, período, fonte, tabela equivalente ou valores exatos, teste de identidade (somas a 100, ponte fecha) |
| 3 · Leitura e mobilidade | A7 glossário; metas responsivo (M1, M2, M5); catálogo (D1, D2); RAP (R1, R2, R4) | Tarefa principal de cada página realizável em 390 px sem rolagem horizontal da tabela essencial; teclado e foco verificados manualmente |
| 4 · Novas fontes | A9 com PIB e população; série real com IPCA | Fonte homologada com hash, referência temporal e testes, conforme `INICIO_DO_PROJETO.md` |

## 8. Rubrica atual por página

Autoavaliação baseada em código e capturas. Não independente. Escala do projeto: 5 a 6 funcional com problemas, 7 a 8 bom com limitações, 9 excelente demonstrado.

| Critério | Início | Exec./Panorama | RAP | Custos | Metas | Catálogo | Metodologia |
|---|---|---|---|---|---|---|---|
| Direção de arte | 7 | 7 | 7 | 8 | 6 | 6 | 7 |
| Hierarquia | 6 | 7 | 6 | 7 | 5 | 5 | 7 |
| Tipografia e acabamento | 6 | 6 | 7 | 7 | 6 | 7 | 7 |
| Densidade e profundidade | 6 | 7 | 6 | 7 | 6 | 5 | 7 |
| Didática visual | 5 | 5 | 5 | 6 | 4 | 5 | 6 |
| Comparabilidade | 7 | 8 | 8 | 8 | 8 | 8 | 9 |
| Interação e acessibilidade | 7 | 7 | 7 | 7 | 6 | 7 | 7 |
| Responsividade | 6 | 7 | 7 | 7 | 4 | 6 | 7 |

Interação e acessibilidade limitadas a 7 porque leitor de tela, navegação por teclado e zoom de 200% não foram verificados.

## 9. O que não fazer

* Não criar nota, ranking ou semáforo de eficiência a partir de execução, cumprimento de meta ou variação de custo.
* Não publicar média de cumprimento entre produtos heterogêneos.
* Não somar estágios orçamentários, nem pais e filhos de custos, nem RAP com pago no exercício.
* Não comparar o acumulado de 2026 com o ano fechado de 2025.
* Não deflacionar nem converter em % do PIB sem fonte homologada.
* Não usar verde e vermelho para indicar bom ou ruim.
* Não alterar snapshots, importadores ou contratos de dados por motivo estético.

## 10. Arquivos desta pasta

* `RELATORIO.md`: este documento.
* `PROMPT_CHATGPT.md`: instrução de implementação para agente de código.
* `antes-*.jpg`: capturas de 12/10/2026, servidor local, base `ed2b020`.

