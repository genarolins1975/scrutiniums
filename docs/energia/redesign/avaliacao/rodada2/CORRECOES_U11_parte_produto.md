# Correções pedidas pelas avaliações independentes: unidade U11

Fonte: produto em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote3/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/inclusao-energetica` | 7 | 0 |
| `/inclusao-energetica/tarifa-social` | 7 | 1 |
| `/inclusao-energetica/cobertura` | 7 | 0 |
| `/inclusao-energetica/orcamento` | 7 | 0 |
| `/inclusao-energetica/acesso` | 7 | 0 |

## `/inclusao-energetica`

### A, Layout e hierarquia: nota 8.0 (produto)

- O H1 'Para quem a energia pesa mais?' cobre só o primeiro dos quatro painéis; o título da aba cita Tarifa Social, cobertura, orçamento e acesso.
- O par 4,4% e 2,5% aparece no cartão, na frase e no gráfico; blocos de texto de 45 a 120 palavras no fim do painel.
- Em 390 px a linha de referência e a linha de base cruzam rótulos de categoria.
- Três camadas de navegação empilhadas no topo (menu, grupo, capítulos nas filhas); a síntese não mostra a barra de capítulos.
- Justificativa do avaliador: Primeira tela clara e hierarquia bem resolvida, mas o título cobre um quarto do conteúdo, os mesmos números se repetem, os blocos de texto são longos e em celular linhas cruzam rótulos do gráfico.

### B, Didática: nota 8.0 (produto)

- 'Por que isso importa' (pergunta 2 da abertura) fica recolhido no fim do primeiro painel.
- Razão de médias só é explicada depois do gráfico, no bloco 'Como interpretar'.
- Definição de Estimado, Observado e Calculado só como tooltip; glossário de siglas recolhido.
- Rótulo 'O que mudou' sobre uma pesquisa de período único não descreve mudança.
- Justificativa do avaliador: Cuidado exemplar com unidades e limites, mas a razão pela qual a medida importa e a definição das etiquetas de natureza do dado ficam escondidas, e termos como razão de médias vêm depois do gráfico.

### J, Navegação e interação: nota 8.0 (produto)

- 'Onde aprofundar' omite Peso no orçamento; a barra de capítulos das filhas não existe na síntese.
- Três camadas de navegação no topo; em 390 px chegam a cerca de 220 px nas filhas.
- Analisar e Auditar acrescentam só quatro parágrafos e abrem dois blocos; o ganho de profundidade na síntese é pequeno.
- Justificativa do avaliador: Estado na URL, profundidade persistente e fichas bem tratadas, mas a síntese não oferece a barra de capítulos das filhas, omite um capítulo na lista de aprofundamento e os níveis acrescentam pouco.

### C, Utilidade: nota 8.5 (produto)

- 'Onde aprofundar' lista três dos quatro capítulos; Peso no orçamento só tem link no texto corrido.
- Para comparar territórios ou ver séries é preciso sair da síntese; Tarifa Social e acesso aparecem só como cartões numéricos.
- Justificativa do avaliador: A síntese cumpre a tarefa principal e mostra os quatro indicadores com unidades, mas depende de links para qualquer comparação territorial ou temporal e a lista de aprofundamento omite o capítulo de orçamento.

### D, Impacto social: nota 8.5 (produto)

- Recortes territoriais ficam nas páginas filhas; a síntese não mostra desigualdade entre regiões ou UF.
- Linguagem técnica (razão de médias, proxy, UC) exige leitura atenta de leitor leigo.
- Justificativa do avaliador: Tema de grande interesse social, com desigualdade por renda, acesso e benefício e limites honestos; falta mostrar na própria síntese a desigualdade territorial, e a linguagem ainda é técnica para leigos.

### I, Visualizações: nota 8.5 (produto)

- Em 390 px a linha tracejada e a linha de base cruzam rótulos de categoria e valores.
- Tarifa Social e acesso aparecem só como cartões numéricos, sem visual de série ou mapa.
- Justificativa do avaliador: O único gráfico é bem escolhido e acessível, com referência e tabela; em celular as linhas cruzam rótulos, e os demais temas da síntese não têm visualização.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Definição de Estimado, Observado e Calculado só em title: invisível a teclado e toque.
- Rótulos de gráfico em 11 px; linhas cruzam rótulos em 390 px.
- Com texto em 200% e janela de 640 px o seletor de profundidade excede a tela.
- Leitor de tela real não testado.
- Justificativa do avaliador: Base técnica sólida, confirmada por axe e por teste manual de teclado, contraste e 320 px; restam definições só em tooltip, textos pequenos nos gráficos e a ausência de teste com leitor de tela.

## `/inclusao-energetica/tarifa-social`

### Bloqueios

- (produto) {"tipo": "ressalva essencial escondida", "descricao": "Mapa 'Desconto médio por fatura' e 'Desconto das faturas', tabela por UF e histórico exibem desconto negativo para o Espírito Santo (menos R$ 11,5 milhões e menos R$ 41,84 por fatura em mar/2026, com 273.840 'faturas com desconto') e para o Rio de Janeiro em 4 meses de 2025, sem nota. O valor contradiz a definição 'fatura com desconto' e define o mínimo da legenda. Não verifiquei a origem (estorno, ajuste ou erro de sinal); cabe ao avaliador técnico.", "evidencia": "Playwright com ?ts.mapa=desconto&ts.uf=ES: 'SELEÇÃO Espírito Santo (ES): menos 11,5 R$ milhões, classe menos de 5,6' e resumo 'Valores de menos 11,5 R$ milhões a 98,9 R$ milhões'; tabela 'Espírito Santo | ES | Sudeste | 273.840 | menos 11,5 | menos 41,84 | 78'; tabela do histórico de ES em 'Desconto das faturas (R$ milhões)': menos 7,8 em mai/25, menos 12,1 em jul/25, menos 13,4 em ago/25; arquivo inclusao_cde_mensal_uf.csv com ES negativo em todos os 11 meses e RJ em jun a set/2025; nenhum texto da página cita valor negativo."}

### I, Visualizações: nota 7.0 (produto)

- Valor negativo de desconto para o ES (e para o RJ em 4 meses de 2025) exibido em mapa, tabela e histórico sem nota.
- Barra de 2026 (valor orçado) sem diferenciação visual; rótulo do ano truncado em 1440 px.
- Anotações cortadas em 390 px; série mensal fragmentada; eixo sem gridline acima de 40.
- Mapa padrão por contagem absoluta de faturas, com classes que dependem do tamanho da UF.
- Rótulos de categoria cruzados pela linha de base nas barras em 390 px.
- Justificativa do avaliador: Boa escolha de gráficos e tratamento honesto de meses incompletos, mas valores negativos sem nota, barra orçada igual às demais, anotações cortadas no celular, série em pedaços e mapa de contagem bruta pesam na nota.

### J, Navegação e interação: nota 7.5 (produto)

- Salto ao topo ao trocar o indicador do mapa e no primeiro clique em UF.
- Frase-resposta e cartões não acompanham a Medida escolhida.
- Lista de opções do campo de UF permanece aberta cobrindo controles abaixo até Esc.
- O título do gráfico não informa o intervalo ao usar 12 meses, 5 anos ou 10 anos (só a linha de status informa).
- Justificativa do avaliador: Estado na URL, comparação de UF, tabelas com exportação e mensagens de erro bem resolvidos, mas a página salta ao topo em controles do meio, a frase-resposta fica fixa e a lista do campo de UF cobre o conteúdo.

### K, Acessibilidade e responsividade: nota 7.5 (produto)

- Anotações de evento cortadas em 390 px (perda de informação no celular).
- Texto de 10 e 11 px em eixos e rótulos.
- Definições de natureza do dado só em tooltip.
- Tabelas largas (até 1.102 px) pedem rolagem lateral; colunas numéricas ficam fora da primeira tela.
- Leitor de tela real não testado.
- Justificativa do avaliador: Base de acessibilidade boa (axe, teclado, contraste), mas anotações cortadas no celular, textos de 10 e 11 px, definições só em tooltip e tabelas largas reduzem a nota; leitor de tela não testado.

### A, Layout e hierarquia: nota 8.0 (produto)

- Quatro cartões do mesmo peso; 17.246.524 UC (05/2025) e 17.155.135 faturas (03/2026) quase iguais convidam à comparação direta.
- Em 390 px as anotações dos gráficos de linha ficam cortadas (perdem 'jan/2022' e 'jul/2025').
- A série mensal da CDE aparece em cinco pedaços soltos (cheio, tracejado e um ponto isolado em mar/2026).
- Hero longo: lead de quase 50 palavras mais bloco de defasagem com dois itens antes do primeiro gráfico.
- Justificativa do avaliador: Primeira tela forte, com números datados e aviso de defasagem, mas quatro cartões de mesmo peso, anotações cortadas no celular e uma série mensal fragmentada reduzem a leitura.

### B, Didática: nota 8.0 (produto)

- MPV só é expandida no glossário recolhido; ESS não tem definição no Entender e, no Auditar, o glossário a define como encargo, mas a página a usa como distribuidora.
- Natureza do dado só em tooltip; 'Por que isso importa' recolhido.
- Muitos conceitos em sequência (SCS, CDE, DMR, mês completo, despacho) no nível Entender.
- Sem remissão no texto à página Conta de luz, onde a CDE compõe a fatura.
- Justificativa do avaliador: Boa separação entre UC, fatura e DMR e entre as duas séries, mas siglas sem expansão (uma delas definida de forma diferente do uso), etiquetas de natureza só em tooltip e muitos conceitos seguidos pesam para o leigo.

### C, Utilidade: nota 8.0 (produto)

- A comparação entre UF do desconto médio fica comprometida pelo valor negativo do ES, sem nota.
- O mapa padrão mostra contagem absoluta de faturas, que repete o tamanho da população da UF.
- UC (SCS até mai/2025) e faturas (CDE até mar/2026) não se emendam; não há série única até hoje.
- Justificativa do avaliador: Atende a tarefa de dimensionar e localizar a Tarifa Social, mas a comparação por UF perde valor com o desconto negativo do ES sem explicação, o mapa padrão é contagem bruta e as duas séries não se emendam.

### D, Impacto social: nota 8.0 (produto)

- Desconto negativo no ES e queda de SP em jul/2025 sem nota podem levar jornalista a conclusão errada.
- Mapa de contagem absoluta favorece leitura por tamanho da UF, não por alcance do benefício; a proxy de alcance está em outra página.
- Justificativa do avaliador: Relevância social alta e limites honestos, mas pontos sem explicação (ES negativo, queda de SP) e um mapa de contagem absoluta enfraquecem o uso por jornalistas e conselhos.

## `/inclusao-energetica/cobertura`

### J, Navegação e interação: nota 7.5 (produto)

- Salto ao topo no clique em UF no mapa.
- Mapa municipal só em Analisar e sob demanda, sem pista no nível padrão.
- O título do gráfico de série não acompanha o intervalo escolhido.
- Justificativa do avaliador: Interação rica e previsível, com estado na URL e mensagens de erro úteis, mas a página volta ao topo no clique em UF, o mapa municipal exige trocar de nível sem aviso e o título da série não acompanha o período.

### C, Utilidade: nota 8.0 (produto)

- O detalhe municipal, mais útil a conselhos locais, só aparece em Analisar e sob demanda.
- A razão não responde onde há lacuna (a própria página diz); o leitor recebe um indicador de sensibilidade, não de decisão.
- A série nacional vai só até mai/2025 (SCS) enquanto o número principal é mar/2026 (CDE).
- Justificativa do avaliador: Atende bem a leitura da proxy por UF com os dois denominadores, mas o mapa municipal fica no nível Analisar e a série nacional termina em mai/2025, dez meses antes do número principal.

### I, Visualizações: nota 8.0 (produto)

- Gráfico de pontos limitado a 13 UF por padrão.
- Série de 121 meses sem anotação de evento para a alta de 2020 a 2021 (a série equivalente da Tarifa Social anota jan/2022).
- Histograma com faixa inicial de 40 pontos e as demais de 20 desenhadas com a mesma largura.
- Em 390 px rótulos cruzados pela linha de base.
- Justificativa do avaliador: Gráficos bem escolhidos e honestos (faixa não estatística, nota sobre larguras diferentes), mas o de pontos esconde 14 UF por padrão, a série não anota o pico de 2021 e há cruzamento de rótulos em celular.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Tabela por UF em 390 px sem coluna fixa; números fora da primeira tela.
- Rótulos do histograma cruzados pela linha de base e texto de 11 px nos gráficos.
- Definição de Calculado só em tooltip; leitor de tela real não testado.
- Justificativa do avaliador: Teclado, semântica, contraste e alternativas à cor funcionam; restam tabela estreita sem coluna fixa no celular, rótulos pequenos e cruzados e a ausência de teste com leitor de tela.

### A, Layout e hierarquia: nota 8.5 (produto)

- Quatro cartões do mesmo peso: o número principal (67,8) não se destaca dos outros três.
- O gráfico de pontos mostra só 13 das 27 UF por padrão, deixando de fora os menores valores (39,2 em SC).
- Em 390 px rótulos do histograma são cruzados pela linha de base e a tabela por UF abre sem números na primeira tela.
- Justificativa do avaliador: Página compacta, bem ordenada e com a ressalva de proxy logo na primeira tela; perde pontos por quatro cartões de mesmo peso, gráfico de pontos limitado a 13 UF e detalhes de celular.

### B, Didática: nota 8.5 (produto)

- Critérios II e III de elegibilidade só no nível Auditar; no Entender há um resumo de uma frase.
- 'Por que isso importa' recolhido; definição de Calculado só em tooltip.
- O hero fala em '27 UF e municípios' e o texto cita 'mapa municipal', mas esse mapa só existe a partir de Analisar.
- Justificativa do avaliador: A melhor explicação conceitual da unidade: deixa claro o que a proxy mede e não mede; perde pontos por critérios de elegibilidade só no Auditar, tooltips e referência a um mapa municipal que o nível padrão não mostra.

### D, Impacto social: nota 8.5 (produto)

- Mapa municipal escondido do nível padrão.
- Em celular a tabela por UF mostra Sigla e Região antes dos números.
- Justificativa do avaliador: Alto potencial para conselhos e imprensa, com recorte por UF e município e ressalvas claras; o recorte municipal fica fora do nível padrão e no celular os números ficam fora da primeira tela da tabela.

## `/inclusao-energetica/orcamento`

### J, Navegação e interação: nota 7.5 (produto)

- Salto ao topo em limiar, indicador do mapa e primeiro clique em UF.
- Frase-resposta e cartões não acompanham Na renda.
- A lista de territórios permanece aberta sobre o gráfico até Esc.
- O download do painel é o arquivo inteiro, não o recorte.
- Justificativa do avaliador: Estado na URL, comparação de territórios e tratamento de busca vazia são bons, mas a página salta ao topo em vários controles do meio, a frase-resposta não acompanha a base escolhida e o download não reflete o recorte.

### A, Layout e hierarquia: nota 8.0 (produto)

- Cartões 3,8% e 6,9% ficam depois do gráfico, separados do trio inicial.
- O gráfico padrão traz 3 medidas por faixa (21 barras) antes de os conceitos serem explicados.
- Em 390 px linhas cruzam rótulos de categoria e valores.
- Em Analisar, tabela de 45 colunas (5.367 px) com 14 botões de filtro de precisão.
- Justificativa do avaliador: Primeira tela clara e estrutura consistente, mas o gráfico padrão com três medidas, os cartões separados do trio inicial, o cruzamento de rótulos em celular e o excesso de colunas e filtros em Analisar reduzem a nota.

### B, Didática: nota 8.0 (produto)

- Razão de médias, média das participações e mediana aparecem no gráfico antes de explicadas.
- Ao escolher Na renda some a razão de médias sem aviso.
- 'O que mudou' descreve a data da pesquisa, não mudança.
- No nível Auditar aparecem identificadores internos (sem_erro_padrao, zero_na_amostra, medidas_uf, inclusao_pof, DESPESA_COLETIVA).
- Justificativa do avaliador: Excelente na honestidade sobre precisão e limites, mas conceitos centrais (razão de médias, média das participações, mediana) vêm depois do gráfico, uma série some sem explicação e o Auditar mostra identificadores internos.

### I, Visualizações: nota 8.0 (produto)

- Cores trocam de significado entre Na despesa e Na renda; roxo e verde mudam de sentido entre gráficos vizinhos.
- Barras triplas aumentam a densidade; em 390 px a linha de referência cobre valores.
- Rótulos de categoria cruzados pela linha de base em 390 px.
- Justificativa do avaliador: Boa escolha de gráficos, com tratamento exemplar de sem dado e zero, mas a troca de significado das cores entre as bases, a densidade das barras triplas e o cruzamento de rótulos em celular limitam a nota.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Tabela larga em 390 px esconde as colunas de despesa.
- No Auditar em 390 px há 53 alvos abaixo de 44 px e uma tabela de 45 colunas; texto de 11 px nos rótulos.
- Salto ao topo ao tocar na UF (medido a 390 px).
- Leitor de tela real não testado.
- Justificativa do avaliador: Acessibilidade sólida em teclado, semântica e contraste, mas tabelas largas em celular, muitos alvos pequenos no Auditar, textos de 11 px e o salto ao topo após o toque no mapa pesam; leitor de tela não testado.

### C, Utilidade: nota 8.5 (produto)

- A frase-resposta e os cartões seguem em despesa quando o leitor escolhe Na renda.
- O gráfico padrão traz 21 números por faixa; para a pergunta principal bastam os sete da razão de médias.
- Justificativa do avaliador: Muito útil para a pergunta central e para comparações territoriais e de sensibilidade; perde pontos porque a frase-resposta não acompanha a escolha Na renda e o gráfico padrão traz mais números do que a pergunta exige.

### D, Impacto social: nota 8.5 (produto)

- Dados de 2017 e 2018: relevância atual limitada, embora declarada.
- Termos técnicos (razão de médias, CV, mediana) pesam para leitor leigo.
- O download do painel é o arquivo inteiro inclusao_pof.csv (2.150 linhas de dados, formato longo), sem refletir o recorte escolhido.
- Justificativa do avaliador: Relevância social alta, com desigualdade por renda, região e UF e limites declarados; perde pontos pela data da pesquisa, pelo vocabulário técnico e pelo download do painel que entrega o arquivo inteiro.

## `/inclusao-energetica/acesso`

### J, Navegação e interação: nota 7.0 (produto)

- Salto ao topo em indicador do mapa, situação e primeiro clique em UF.
- Frase-resposta e cartões não acompanham o Indicador.
- Dois grupos Indicador idênticos (painel e mapa) andam juntos sem aviso; o histórico por UF ignora a situação rural.
- Justificativa do avaliador: Estados vazios, de erro e exportação muito bem resolvidos, mas três controles do meio da página levam ao topo, a frase-resposta fica fixa, há dois seletores iguais que andam juntos e o histórico ignora o recorte rural.

### I, Visualizações: nota 7.5 (produto)

- Eixo ampliado no histórico do Brasil transforma arredondamento de 0,1 ponto em pico.
- Mapa por quantis esconde a distância entre AM e BA na classe mais alta.
- Barras de 2026 (orçado e parcial) sem diferenciação visual; rótulo truncado em 1440 px.
- Fim das linhas com siglas 'N', 'BR·NE' e 'SE·S·CO' que a legenda não define.
- Rótulos cruzados pela linha de base em 390 px.
- Justificativa do avaliador: Gráficos adequados e honestos com a lacuna de 2020 e 2021, mas o eixo ampliado do histórico, a classe aberta do mapa, as barras orçada e parcial sem distinção e siglas de fim de linha não definidas reduzem a nota.

### A, Layout e hierarquia: nota 8.0 (produto)

- Página mais longa da unidade (7.372 px no Entender; 11.124 px em 390) com seis tabelas e duas linhas iguais de rádios Indicador.
- Cartões do topo com parágrafos de 25 a 40 palavras em 12 px; o número 135 mil se repete no cartão, na frase e no rótulo.
- Em 390 px menu e grade de capítulos ocupam cerca de 220 px antes do título.
- Rótulos cruzados pela linha de base nas barras em 390 px.
- Justificativa do avaliador: Estrutura clara e primeira tela eficiente, mas a página é longa e densa, repete controles e números e, em celular, a navegação consome quase um terço da primeira tela e rótulos de barras são cruzados.

### B, Didática: nota 8.0 (produto)

- CDE e CCC usadas em título, e UC num cartão, sem expansão visível (glossário recolhido e aninhado).
- Natureza do dado só em tooltip; 'Por que isso importa' recolhido.
- Conceitos como 'ligados à rede geral' e 'tempo integral' dependem do bloco Como interpretar, abaixo do gráfico.
- Justificativa do avaliador: Distinções conceituais muito bem feitas (isolamento não é falta de acesso, três unidades que não se somam), mas siglas de título sem expansão visível, definições só em tooltip e explicações depois do gráfico limitam a nota.

### C, Utilidade: nota 8.0 (produto)

- O histórico por UF ignora o filtro 'Só área rural' (o título diz 'todos os domicílios').
- Painéis de CDE, recursos por contrato e municípios (Analisar) ampliam muito a página para a pergunta sobre acesso adequado.
- Justificativa do avaliador: Cumpre a tarefa de mapear acesso, regularidade e sistemas isolados com comparação de UF, mas o histórico ignora o recorte rural e a página acumula painéis de custeio e contratos além da pergunta.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Rótulos de gráfico em 11 px e siglas 'N', 'BR·NE', 'SE·S·CO' no fim das linhas.
- Definições de natureza do dado só em tooltip.
- Salto ao topo após o clique no mapa desorienta quem usa ampliação; medido a 1440 px nesta página.
- Leitor de tela real não testado.
- Justificativa do avaliador: Boa base de teclado, semântica e tabelas com primeira coluna fixa; textos de 11 px, siglas sem definição, definições só em tooltip e o salto ao topo após o clique no mapa pesam; leitor de tela não testado.

### D, Impacto social: nota 8.5 (produto)

- Recorte territorial do acesso só em UF e grandes regiões; municípios apenas para o Luz para Todos, em Analisar.
- O CSV exportado não leva fonte, versão nem regra de ausência dentro do arquivo (só o XLSX).
- Justificativa do avaliador: Alta relevância para acesso, continuidade e desigualdade regional, com exportação em XLSX que leva fonte e dicionário; limita a nota o recorte territorial só em UF e o CSV sem contexto interno.

## Achados que se repetem entre páginas

- (produto) Salto ao topo (rolagem suave até cerca de 70 px) ao usar controles do meio da página: indicador do mapa, primeiro clique em UF, limiar e situação rural em Orçamento, Acesso, Cobertura e Tarifa Social; com setas do teclado num rádio já focado não houve salto.
- (produto) Frase-resposta e cartões ficam fixos quando o leitor muda o controle do painel: Na renda (Orçamento), Indicador (Acesso) e Medida (Tarifa Social).
- (produto) Anotações de evento cortadas à esquerda em 390 px (Tarifa Social) e barras de ano orçado ou parcial (CDE 2026, Luz para Todos 2026) sem diferenciação visual e com rótulo truncado em 1440 px.
- (produto) Em 390 px a linha de base ou a linha de referência cruza rótulos de categoria nos gráficos de barras horizontais das cinco páginas.
- (produto) Definições de Estimado, Observado e Calculado só em atributo title; glossário de siglas recolhido e aninhado, com CCC (Acesso), MPV e ESS (Tarifa Social) sem expansão visível ou definidas de modo diferente do uso.
- (produto) Navegação em três camadas empilhadas, síntese sem a barra de capítulos das filhas, 'Onde aprofundar' sem Peso no orçamento e mapa municipal da Cobertura só no nível Analisar, sem pista no nível padrão.
- (produto) Eixos e classes que exageram ou escondem magnitude: histórico do Brasil no Acesso (0,200 a 0,300), classe superior do mapa de Acesso (0,3 a 1,6) e mapa de contagem absoluta de faturas por UF na Tarifa Social.
- (produto) Tabelas largas em 390 px (de 816 a 1.102 px, e 5.367 px em Analisar no Orçamento) com as colunas numéricas fora da primeira tela e primeira coluna fixa em apenas uma delas.

## Limites declarados pelos avaliadores

- (produto) Avaliação por inspeção heurística de um agente, só em Chromium sem cabeça (Playwright 1.56) contra http://localhost:3101, commit cbb5fbfeb. Leitor de tela real não foi testado; Firefox, Safari e aparelhos móveis físicos não foram testados; toque, zoom e texto ampliado foram emulados (viewport de 320 px e fonte base a 200%). As imagens de 1440 do pacote estão reduzidas a 50%; detalhes de 10 a 12 px foram conferidos no DOM e em capturas próprias. O pacote não trouxe os trechos de 390 px home 02 e 05, acesso 02, 04, 05 e 07, cobertura 02 e 05, orçamento 02 e 05 e tarifa social 02, 04 e 06; recapturei esses trechos no mesmo servidor, no estado Entender. O objetivo.json mede 360 e não 320 px, e o teste de teclado dele para em 70 paradas; medi 320 px por conta própria. O campo tarefas_rubrica veio vazio nas cinco páginas (nenhuma tarefa T1 a T12 associada); inspecionei a tarefa de publico_tarefa.json em três recortes por página. Níveis Analisar e Auditar foram vistos em texto e em capturas pontuais. A correção numérica, a origem do desconto negativo do ES e a rastreabilidade pertencem ao avaliador técnico. Os testes de salto de rolagem usaram clique de mouse e toque emulado e registraram pushState e posição de rolagem; não identifiquei a causa no código. Capturas e scripts próprios citados nas evidências estão em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/aval_u11 (capturas na subpasta out).

