# Correções pedidas pelas avaliações independentes: unidade U09

Fonte: produto, tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote2/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/conta-de-luz` | 11 | 0 |
| `/conta-de-luz/reajustes-e-subsidios` | 12 | 1 |
| `/qualidade` | 10 | 0 |

## `/conta-de-luz`

### J, Navegação e interação: nota 7.0 (produto)

- Vários controles (Leitura, Tipo, Unidade, ponto da faixa) e, no celular, o perfil devolvem o leitor ao topo, e o resultado fica fora da tela
- Mensagem de erro obsoleta sob o campo de município depois de uma escolha válida
- Escolher distribuidora abre sozinha a tabela de 81 linhas (cerca de 2.800 px a mais)
- A aba da página irmã (Reajustes, bandeiras e subsídios) não aparece no topo desta página
- As distribuidoras fora do ranking não aparecem no seletor de destaque
- Justificativa do avaliador: Estado, compartilhamento e casos de borda são exemplares, mas o retorno ao topo ao acionar filtros centrais, a mensagem de erro obsoleta e a tabela que abre sozinha prejudicam a interação. A nota fica limitada por defeitos recorrentes.

### A, Layout e hierarquia: nota 8.0 (produto)

- O aviso de que a tarifa não é a fatura aparece sob os KPIs, em O que não é possível concluir, em Três números e no simulador
- Blocos analíticos de três colunas se repetem em todos os painéis e alongam o nível Entender
- A tabela de 17 colunas abre sozinha ao escolher uma distribuidora e acrescenta cerca de 2.800 px
- Sombra de rolagem em branco no canto de Memória de cálculo parece uma mancha
- Justificativa do avaliador: Primeira tela responde à pergunta e a hierarquia é clara, inclusive no celular. Repetição de avisos e de blocos analíticos em todos os painéis, tabela que abre sozinha e página longa mantêm a nota abaixo de 9.

### B, Didática: nota 8.0 (produto)

- A abertura não responde por que a medida importa: o texto está em Por que isso importa, recolhido
- Termos como REH, B1, fio B e 'créditos tarifários lançados em componente de custo' aparecem no Entender sem definição no ponto de uso
- O Entender tem cerca de 3.950 palavras e não cumpre 'o essencial em poucos minutos'
- Justificativa do avaliador: Didática forte nos limites e nas distinções entre tarifa, média e conta simulada. Perde por esconder por que a medida importa, por termos técnicos sem definição no ponto de uso e pelo volume de texto no Entender.

### F, Benchmarks e comparabilidade: nota 8.0 (tecnico)

- Menor custo, mediana e maior custo da abertura saem de universo incompleto no dia de referência (sem a regra de completude que Qualidade aplica); o efeito nos extremos não é dito, e o menor passa a ser outro com o arquivo completo.
- Ranking e cartões usam a tarifa de aplicação; a base econômica só aparece como coluna da tabela, embora difira mais de 20% em 15 distribuidoras (crédito em TE_CFURH, benefício da Lei 14.299, componentes financeiros).
- Mínimo e máximo nomeiam cooperativas pequenas (CERES tem 6,1 mil UCs) sem o peso em UCs ao lado do cartão.
- A mediana não pondera por consumidores (declarado), então não representa o consumidor médio.
- Justificativa do avaliador: Comparação bem construída (mesmo perfil, quartis, real e nominal, mesmo conjunto), mas os extremos de abertura vêm de um universo que perdeu 22 distribuidoras no dia de referência, e o ranking mistura componentes financeiros transitórios sem destaque visual.

### C, Utilidade: nota 8.5 (produto)

- 34 de 115 distribuidoras ficam fora do ranking (22 com vigência encerrada há até 90 dias, 21 delas em 29/09/2026); a lista só aparece em Auditar e o seletor traz apenas 81
- O ranking e a faixa de pontos cobrem só a classe B1 convencional; as demais classes existem apenas no simulador
- Saltos ao topo e a tabela que abre sozinha interrompem o fluxo da tarefa
- Justificativa do avaliador: Resolve T2 de ponta a ponta, com bons casos de borda e exportação com contexto. Não chega a 9 porque 34 distribuidoras ficam fora do ranking com a lista escondida em Auditar e porque o fluxo é interrompido por saltos de página.

### D, Impacto social: nota 8.5 (produto)

- A fatura final, onde pesam ICMS e iluminação pública, não pode ser estimada; o impacto no bolso fica parcial por falta de base oficial (declarado)
- Não há leitura de desigualdade entre regiões nem do peso da conta na renda
- Texto longo e técnico reduz o alcance entre leitores não especializados
- Justificativa do avaliador: Tema de custo bem servido, com benefícios sociais, território e exportação com contexto. A ausência declarada de tributos, a falta de leitura de desigualdade e a densidade impedem 9.

### G, Rigor setorial: nota 8.5 (tecnico)

- Regras da Tarifa Social acima de 80 kWh (mínimo e bandeira) e do Desconto Social por parcela são leituras não conferidas (REN não lida); declaradas, mas definem o resultado dessas classes.
- Agrupamento das componentes e leitura do crédito em TE_CFURH são do observatório (PRORET 7.1 não lido); declarados.
- Cobertura parcial do dia de referência tratada só em texto, sem regra de completude.
- O rótulo 'tarifa média de 80 distribuidoras' (média simples) convive com 'tarifa média de fornecimento (não publicada)', outro conceito.
- Justificativa do avaliador: Rigor setorial alto: componentes, tributos, bandeira e classes separados, regras com estado, ausência e sobreposição tratadas, cálculos reproduzidos por mim. Descontam as regras ainda não conferidas nas normas e a cobertura incompleta da data de referência sem regra de completude.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Publicação saiu de código com alterações fora do commit; a versão metodológica não é reconstituível.
- O bruto identificado por sha256 não é publicado e a URL da ANEEL já serve versão posterior; a reprodução depende dos CSV intermediários e das chaves.
- A ficha diz 'Nenhuma revisão detectada' e 'Sobre este dado' diz que ainda não é possível detectar revisões (uma captura); os textos divergem.
- O agregado de encargos (20,6%) não tem ficha própria, só o exemplo da CERIPa (21,6%).
- Justificativa do avaliador: Rastro completo do número até a fonte, reproduzido por mim sem o código do projeto. Pesam o código publicado com alterações locais, o arquivo bruto indisponível a terceiros, a impossibilidade de histórico de revisões e o texto divergente sobre revisões.

### I, Visualizações: nota 8.5 (produto)

- No modo TE e TUSD as linhas de 1º quartil, mediana e 3º quartil têm o mesmo traço e só a ordem da legenda as separa
- Com filtro de grupo ativo, a linha 'Mediana entre distribuidoras: 164,24' segue sendo a das 81 e a frase traz outra mediana (174,61), sem rótulo que distinga
- O ranking abre com 12 das 81 barras; a legenda da composição lista 'Arredondamento das partes' como se fosse um componente
- Justificativa do avaliador: Gráficos bem escolhidos, com referências, alternativas e teclado. Pequenas ambiguidades de referência (linhas iguais, mediana das 81 com filtro ativo) e o corte inicial do ranking impedem a nota 9.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Leitor de tela real não testado
- Boa parte do texto explicativo usa 12 px, inclusive o aviso de que a tarifa não é a fatura
- A mensagem 'Nenhum município com esse nome.' obsoleta pode ser anunciada como estado
- Tabela de 2.038 px em 390 sem coluna fixa; seletores truncam rótulos ('CERIPa (SP) · referência: tarifa mais p…')
- Justificativa do avaliador: Boa base de acessibilidade, medida por axe e verificada por teclado. Sem leitor de tela real, com texto pequeno e tabela larga no celular, não há evidência para 9.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- HTML servido acima da meta do contrato (cerca de 600 KB) e sem teste que a imponha.
- Publicação gerada com código alterado fora do commit.
- Nenhum controle impede ou sinaliza a queda de 102 para 81 distribuidoras no ranking.
- Só laboratório; nenhum dado de campo.
- Os três níveis (Entender, Analisar, Auditar) viajam no mesmo HTML.
- Justificativa do avaliador: Sem erros, estável e rápida em laboratório, com testes bem dirigidos e bloqueio de dado inválido. Descontam o peso acima da meta do próprio contrato, a publicação de código alterado, a falta de controle de cobertura e a ausência de medida de campo.

## `/conta-de-luz/reajustes-e-subsidios`

### Bloqueios

- (produto) {"tipo": "divergência entre gráfico, tabela e exportação", "descricao": "Com o seletor Em reais de ago/2026 ativo (?valores=real), o gráfico e a tabela de subsídios mostram R$ 19,68 bi em 2025, enquanto o KPI Subsídios tarifários em 2025 (R$ 18,8 bilhões), a frase 'R$ 18,82 bilhões' e O que mudou (total de 12,73 para 18,82; SCEE de 0,92 para 4,39) permanecem nominais, sem rótulo de nominal. A divergência é entre gráfico e tabela de um lado e KPI e frases do mesmo painel de outro.", "evidencia": "Playwright em 1440: abrir ?valores=real, abrir Dados do gráfico em tabela (14 linhas) e ler a linha 2025, Total 19,68; no mesmo painel o KPI e a frase mostram 18,8 e 18,82; em 2024 a tabela mostra 13,98 contra 12,73 no texto"}

### J, Navegação e interação: nota 6.5 (produto)

- Alternar Valores, clicar num ponto e, no celular, trocar a janela devolvem o leitor ao topo e o gráfico atualizado fica fora da tela
- O seletor Nominais ou Em reais atualiza gráficos e tabelas, mas não o KPI, a frase nem O que mudou
- Mensagem 'Nenhum município com esse nome.' obsoleta após escolha válida
- Sem Comprove este número nas janelas de 60 e 120 meses
- Justificativa do avaliador: Estado em URL, link com recorte e busca por município são bons. O retorno ao topo ao alternar valores, o seletor de real e nominal que não chega ao KPI nem à frase e a mensagem obsoleta mantêm a nota baixa.

### B, Didática: nota 8.0 (produto)

- A abertura não diz por que a medida importa; o texto está em Por que isso importa, recolhido
- Siglas e termos (REH, SCEE, rubrica, quotas, homologado) sem definição no ponto de uso
- O Entender tem 3.608 palavras e blocos de três colunas por painel, o que reduz o 'essencial em poucos minutos'
- Justificativa do avaliador: Bom esforço de limites e definições, mas a resposta a por que importa fica recolhida, há siglas e termos regulatórios sem definição no ponto de uso e o volume de texto é alto para o nível Entender.

### C, Utilidade: nota 8.0 (produto)

- No Entender não há data nem percentual da última mudança de tarifa da distribuidora escolhida, só a variação entre duas datas
- Nas janelas de 60 e 120 meses o botão Comprove este número some e a prova fica restrita a 12 meses
- O adicional de cada mês da grade só aparece em texto para leitor de tela e no modo Analisar
- Justificativa do avaliador: Atende bem bandeiras e subsídios e dá comparação sólida contra o IPCA. Para acompanhar reajustes falta a última mudança da distribuidora no Entender, e o efeito do processo tarifário depende de dado inacessível (declarado).

### E, Profundidade: nota 8.0 (tecnico)

- O efeito médio do processo tarifário, medida regulatória central de 'reajuste', está ausente; a página admite e não usa valor de reserva.
- Sem evolução anual do reajuste contra a inflação, só janelas com fim em 31/08/2026.
- Bandeira mostrada sem o impacto em R$ para um consumo de referência (fica no simulador).
- Justificativa do avaliador: Cobre bandeiras, subsídios e orçamento da CDE com profundidade, e reajustes com distribuição e janelas por conjunto. A ausência do efeito médio do processo e de uma série anual limita 'acompanhar reajustes'; um painel incompleto não sobe por declarar a lacuna.

### I, Visualizações: nota 8.0 (produto)

- No modo reais o gráfico muda e o KPI, a frase e O que mudou ficam nominais sem rótulo, o que gera 19,68 contra 18,82 no mesmo painel
- A grade de bandeiras mostra só a sigla; o adicional de cada mês não aparece para quem enxerga, nem ao passar o mouse ou focar
- A lista de barras abre pelas menores variações e a linha do IPCA e a da mediana se distinguem só pela legenda
- Justificativa do avaliador: Gráficos bem escolhidos e honestos com ausência e previsão. A divergência entre gráfico em reais e KPI nominal, a grade sem valor visível por mês e a lista que abre pelas menores variações impedem a nota 9.

### A, Layout e hierarquia: nota 8.5 (produto)

- Caixa tracejada de três linhas sobre o efeito do processo tarifário antecede o gráfico e empurra a faixa de pontos para o limite da primeira tela em 1440
- A lista de barras abre com as 12 menores variações, algumas negativas, e só Mostrar todas as 102 revela o resto
- Sombra de rolagem esmaece a última coluna (dez) da grade de bandeiras
- Repetição do bloco de três colunas e de Por que isso importa em cada painel
- Justificativa do avaliador: Página mais enxuta que a primeira, com grade de bandeiras muito legível e hierarquia clara. A caixa de aviso antes do gráfico, a lista que abre pelas menores variações e a repetição dos blocos analíticos impedem 9.

### D, Impacto social: nota 8.5 (produto)

- Subsídios e bandeiras não têm recorte territorial nem leitura de quem recebe, então desigualdades ficam fora
- Texto técnico (rubricas, homologação, quotas) limita o alcance entre leitores não especializados
- Falta ligação direta da bandeira com o efeito na conta de 150 ou 200 kWh
- Justificativa do avaliador: Relevante para custo e financiamento, com território na tarifa e lacunas visíveis. Sem recorte territorial para subsídios, sem ligação da bandeira com a conta e com vocabulário regulatório pesado, fica em 8,5.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Medida substituta (variação entre datas da tarifa de aplicação, com componentes financeiros) no lugar do efeito médio do processo; declarado.
- A participação das quotas de 2026 é comparada com anos fechados sem ressalva no cartão sobre receitas ainda incompletas (a ressalva está no parágrafo abaixo).
- A janela termina em 31/08/2026, enquanto tarifas e ranking vão a 30/09/2026 (dito na página).
- Justificativa do avaliador: Comparações compatíveis com o IPCA nos mesmos meses, janelas tratadas por conjunto e valores nominais ou reais declarados. Descontam a medida substituta do efeito médio do processo e a comparação de 2026, orçamento com receitas incompletas, com anos fechados sem ressalva no cartão.

### G, Rigor setorial: nota 8.5 (tecnico)

- Rural e Água-esgoto zeram sem nota regulatória na página; o leitor pode ler como falta de dado ou fim do desconto (a causa não está em conta.md; não verifiquei a norma).
- A tabela de adicionais por resolução não cobre 10 dos 141 meses de bandeira (declarado em Auditar).
- Justificativa do avaliador: Honesta quanto a homologado, orçamento, previsto e ano parcial; números e IPCA conferem com fonte primária. Descontam a série de categorias que zera sem explicação e a tabela de adicionais incompleta em 10 meses.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código publicado com alterações locais; versão metodológica não reconstituível.
- Reconciliação do orçamento da CDE com a ANEEL só por títulos de notícia.
- Bruto por sha256 não publicado e fonte que muda depois da captura; sem histórico de revisões possível (uma captura), embora a ficha diga 'Nenhuma revisão detectada'.
- Justificativa do avaliador: Cada número chega à fonte por ficha com hash, fórmula e passos, e reproduzi os principais só com CSV publicados. Pesam o código publicado alterado, a conferência do orçamento por títulos de notícia e a ausência de histórico de revisões.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Leitor de tela real não testado
- Texto explicativo e avisos essenciais em 12 px
- As células da grade de bandeiras não são focáveis individualmente nem trazem dica visual; o valor mensal só existe em texto oculto
- A mensagem de município obsoleta pode ser anunciada como estado
- Justificativa do avaliador: Base sólida: axe limpo, teclado completo, foco visível e leitura em 320 px. Sem leitor de tela real, com texto pequeno e grade sem dica visual por célula, não há evidência para 9.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- HTML servido acima da meta do contrato, sem teste que a imponha.
- Publicação gerada com código alterado.
- Sem controle que sinalize rubrica que zera ou some entre anos (Rural, Água-esgoto, receitas de 2026).
- Só laboratório; nenhum dado de campo.
- Justificativa do avaliador: Estável e sem erros em laboratório, com testes de paridade e bloqueio de dado inválido. Descontam o HTML acima da meta, a publicação de código alterado, a falta de controle para categorias que zeram e a ausência de medida de campo.

## `/qualidade`

### J, Navegação e interação: nota 6.5 (produto)

- Cinco grupos de controles (DEC e FEC, Tipo, Ordenar por, Cor do mapa, Escala) e o clique no mapa devolvem o leitor ao topo; em 390 ele perde de 5.500 a 9.700 px de contexto
- A frase de leitura do painel de limites não acompanha FEC nem Permissionárias
- O mapa pede clique, mas o resultado fica abaixo e longe da tela após o salto
- Atalhos do topo não incluem buscar a minha cidade, ferramenta central da tarefa
- Justificativa do avaliador: Estado, busca por teclado, comparação e exportação são fortes. Mas o retorno ao topo em cinco grupos de controles e no clique do mapa, mais a frase que não acompanha o recorte, comprometem a interação numa página de 14 mil pixels.

### A, Layout e hierarquia: nota 7.5 (produto)

- Página muito longa e densa para o essencial: quatro temas (Brasil, limites, compensações, atendimento) na mesma rota
- A ferramenta para achar a própria área fica no terceiro bloco e não aparece na primeira tela nem nos cartões de atalho
- O mapa ocupa cerca de 40% da moldura de 1.160 px e as duas classes mais claras têm contraste de 1,31:1 e 1,90:1 com o fundo branco
- O tooltip persistente do município selecionado é cortado no topo do mapa
- Blocos de três colunas repetidos em cada painel
- Justificativa do avaliador: A primeira tela é boa, mas a rota reúne quatro temas, 13 painéis e 6.300 palavras, e o caminho para achar a própria área fica enterrado. Há detalhes do mapa e repetição de blocos. A nota fica em 7,5.

### B, Didática: nota 7.5 (produto)

- A abertura não responde por que a medida importa; o texto está em Por que isso importa, recolhido
- Códigos de parcela (IP, IND, INE, INC, IPC, XN, XP, XNC, XPC, INO) e termos (DGC, quantis P10 a P90, 'altura é densidade', CHI, ONS) aparecem no Entender sem definição no ponto de uso
- Título contraditório sobre as caudas
- O Entender tem 6.339 palavras e 13 painéis, leitura longa para quem só quer a sua área
- Justificativa do avaliador: Explicações boas e exemplos de conversão, mas o vocabulário regulatório (códigos de parcela, DGC, quantis), o título contraditório e o volume de texto do Entender dificultam a vida do leitor não especializado.

### C, Utilidade: nota 8.0 (produto)

- O caminho do mapa para o resultado é interrompido: o clique no mapa devolve a página ao topo, longe da tabela de conjuntos
- A dispersão entre conjuntos de uma distribuidora específica só aparece pela tabela do município; o histograma é nacional
- Ao trocar para FEC ou Permissionárias, a frase acima do gráfico continua falando de DEC nacional
- Justificativa do avaliador: Resolve T3 de forma poderosa pela busca de município, com limite por conjunto e comparação com a distribuidora. O clique no mapa interrompe o fluxo, a dispersão por distribuidora só vem pelo município e a frase não acompanha o recorte.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Leitor de tela real não testado
- O mapa depende de ponteiro para escolher região; a alternativa por teclado e toque fica na busca e numa tabela de 223 páginas
- Textos de 10 a 12 px em eixos, legendas e avisos; cabeçalhos H4 repetidos (CEMIG-D, ELETROPAULO, COELBA e COPEL-DIS duas vezes) sem distinguir DEC e FEC
- Vários alvos entre 24 e 44 px no desktop (Comprove este número com 32 px)
- As duas classes mais claras do mapa têm 1,31:1 e 1,90:1 de contraste com o fundo, abaixo dos 3:1 desejáveis para elementos gráficos
- Justificativa do avaliador: Boa base (axe limpo, teclado, combobox acessível, aria-live). Sem leitor de tela real, com mapa centrado em ponteiro, texto pequeno e títulos H4 repetidos, a evidência fica abaixo de 9.

### D, Impacto social: nota 8.5 (produto)

- Quem mora numa área sem dado (por exemplo Pinto Bandeira) recebe só 'sem dado', sem orientação de onde procurar
- Vocabulário técnico e extensão limitam o alcance entre leitores não especializados
- Não há leitura de desigualdade entre classes de consumidores nem de impacto social além da descrição territorial
- Justificativa do avaliador: Tema de continuidade bem servido por mapa, compensações e atendimento, com lacunas expostas e exportação com contexto. A falta de orientação para área sem dado, o vocabulário técnico e a ausência de leitura de desigualdade seguram a nota.

### G, Rigor setorial: nota 8.5 (tecnico)

- Quebra de série das compensações em 2022 (fim dos tipos trimestral e anual a UCs, DISE só em 2026) sem aviso junto do gráfico anual e da frase 'maior total'; a nota por tipo lista os anos sem a causa.
- A frase 'desde 2019 a linha das concessionárias reproduz o universo do número divulgado' extrapola: a reconciliação cobre 2023 a 2025.
- R$ por UC divide compensações de UC e UG por UCs médias (declarado, UG é 1% do total).
- A quantidade divulgada pela ANEEL (21,6 mi) difere de 21,78 mi e só aparece na tabela de Auditar.
- Justificativa do avaliador: Tratamento exemplar de apurado, expurgos, pesos, cobertura e ausência, com números conferidos contra dados e divulgação oficiais. Descontam a mudança de regime das compensações em 2022 sem aviso junto do total e pequenas extrapolações na reconciliação com o divulgado.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Publicação saiu de código com alterações locais; versão metodológica não reconstituível.
- O bruto não é publicado e a ANEEL serve versão posterior; a reprodução por terceiros depende dos CSV intermediários.
- Histórico de revisões ainda impossível (uma captura); texto da ficha menos claro que 'Sobre este dado'.
- O número oficial divulgado é lido em republicação de terceiros, não na página da ANEEL (declarado).
- Justificativa do avaliador: Rastro do número à fonte excepcionalmente detalhado e reproduzido por mim com os CSV publicados. Pesam o código publicado com alterações locais, o bruto indisponível a terceiros, a falta de histórico de revisões e o divulgado lido em republicação.

### I, Visualizações: nota 8.5 (produto)

- O asterisco de cobertura parcial (ELEKTRO) só se explica no tooltip; a legenda não o descreve
- Mapa pequeno na moldura, duas classes mais claras com 1,31:1 e 1,90:1 de contraste com o fundo e tooltip persistente cortado no topo
- O gráfico de pontos abre com 12 das 51 distribuidoras
- Justificativa do avaliador: Conjunto de visualizações muito completo e honesto, com referências, escalas escolhidas e alternativas. Detalhes do mapa, asterisco sem legenda e rótulos encostados impedem a nota 9.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- HTML servido 24% acima da meta do contrato e teste que mede grandeza menor e passa.
- Publicação gerada com código alterado.
- Só laboratório; nenhum dado de campo.
- Os três níveis viajam no mesmo HTML de 741 KB.
- Justificativa do avaliador: Sem erros, estável e rápida em laboratório, com testes dirigidos aos riscos e bloqueio crítico de dado inválido. Descontam o HTML 24% acima da meta com teste que não a vê, a publicação de código alterado e a ausência de medida de campo.

## Achados que se repetem entre páginas

- (produto) Retorno ao topo ao acionar radios, pontos de gráficos e o mapa. Página 1: Leitura, Tipo, Unidade e ponto da faixa (em 390 também o perfil). Página 2: Valores e ponto (em 390 também a janela). Página 3: DEC e FEC, Tipo, Ordenar por, Cor do mapa, Escala e clique no mapa. Em 390 o salto chega a 9.700 px; busca por teclado, selects e Inverter ordem não saltam.
- (produto) A mensagem 'Nenhum município com esse nome.' permanece sob o campo depois de uma escolha válida nas páginas 1 e 2 (mesmo componente de busca por município).
- (produto) Entender extenso e repetitivo (3.947, 3.608 e 6.339 palavras): cada painel repete blocos de três colunas, e Por que isso importa e a lista de siglas ficam recolhidos, de modo que a abertura não responde por que a medida importa nem expande siglas.
- (produto) Tabelas largas: 17 colunas e 2.038 px em 390 sem coluna fixa; na página 1 a tabela de 81 linhas abre sozinha ao escolher uma distribuidora e acrescenta cerca de 2.800 px.
- (produto) Referências de gráfico sem rótulo próprio: três tracejados iguais (página 1, TE e TUSD), IPCA e mediana tracejados quase iguais (página 2) e asterisco de cobertura parcial sem legenda (página 3).
- (produto) Texto explicativo e avisos essenciais em 12 px (de 13.400 a 13.800 caracteres por página em 390), além de 10 e 11 px nos eixos.
- (produto) Atalhos para a tarefa principal fora do topo: a página 1 não mostra a aba da página irmã (a página 2 mostra) e a página 3 não oferece entrada para buscar a própria cidade.
- (produto) Sombra de rolagem em branco sobre contêineres que não rolam (Memória de cálculo na página 1, última coluna da grade de bandeiras na página 2) parece uma mancha.
- (tecnico) Publicação gerada com código alterado fora do commit (conta 3e7ff0a36fba+alterado, qualidade 802c51897680+alterado); as fichas admitem que o código exato não se reconstitui.
- (tecnico) HTML servido acima da meta do contrato de cerca de 600 KB nas três páginas (677.683, 616.007 e 741.396 B); os testes medem markup ou props, e um comentário diz que as páginas cumprem a meta.
- (tecnico) A regra de completude do período existe em Qualidade (99% das UCs por mês) e falta em Conta: o ranking de 30/09 saiu com 81 de 103 distribuidoras.
- (tecnico) Mudanças de regime regulatório aparecem como zero ou ausência sem a norma que as explica (Rural e Água-esgoto zerados desde 2024; tipos trimestral e anual de compensação até 2021 e DISE só em 2026).
- (tecnico) Fichas Comprove dizem 'Nenhuma revisão detectada' enquanto 'Sobre este dado' diz que ainda não é possível detectar revisões (uma captura).
- (tecnico) O arquivo bruto de cada fonte é identificado por sha256 mas não é publicado, e a fonte muda depois da captura (a ANEEL já serve versão posterior); a reprodução por terceiros depende dos CSV intermediários e das chaves de origem.
- (tecnico) Desempenho medido só em laboratório (Chromium headless, sem limitação de rede ou CPU), sem LCP, INP e CLS de campo; o objetivo.json não registra LCP nem CLS.
- (tecnico) Os três níveis de profundidade viajam no mesmo HTML, que cresce com o conteúdo de Analisar e Auditar mesmo para quem lê só Entender.

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística por agente, sem participantes, sem tempos medidos e sem leitor de tela real (NVDA, JAWS e VoiceOver não foram testados); o comportamento por teclado foi verificado por Playwright e por leitura do DOM e das regiões aria-live. Só Chromium headless (Playwright): sem Firefox, Safari ou aparelho móvel real, e o toque foi emulado. objetivo.json trouxe 360, 390, 768 e 1440 px e não 320; medi 320 px por conta própria (transbordo da página e capturas de seções). A fatia 1440_inteira_03de05.png da página de qualidade não existia na pasta e os trechos de 390 vieram em amostra, então capturei as seções restantes das três páginas por conta própria; as imagens de 1440 fornecidas estão reduzidas a 50%. Não conferi valores contra as fontes (correção numérica é do avaliador técnico), não abri o conteúdo do XLSX nem dos arquivos de Baixar os dados além do CSV filtrado e do CSV estático de tarifas, e movimento reduzido foi conferido só no CSS global. Os saltos de rolagem foram medidos em Chromium com clique real do mouse e toque emulado e se repetem em três execuções; a causa provável (atualização de URL com rolagem) não foi confirmada no código. Uma busca por texto no repositório exibiu por engano algumas linhas de um arquivo de avaliação de rodada anterior (identificadores de painel e trechos do campo onde); não usei esse conteúdo como evidência nem como referência de nota.
- (tecnico) Não executei build, testes nem servidor de desenvolvimento; li os testes e o pipeline. Fontes primárias consultadas por mim: datastore da ANEEL (tarifas de aplicação, bandeiras e custeio da CDE, em 09/10/2026, posterior à captura de 30/09), tabela 1737 do SIDRA do IBGE (via WebFetch), página de bandeiras da ANEEL (via WebFetch) e buscas na web para a Lei 15.235/2025, o DEC e o FEC nacionais e as compensações divulgados em imprensa, o ranking de 2025 e as bandeiras de 2024. Não consegui ler o texto do Planalto (503), as REN 1.000/2021 e 956/2021, o PRORET 7.1, as páginas do gov.br que exigem login nem as páginas de efeito médio dos reajustes. Subsídios por categoria só conferidos em amostra no datastore. Parquet de continuidade e componentes tarifárias não rebaixados (usei os CSV publicados e as conferências do projeto). Geometria do mapa, leitor de tela e desempenho de campo não verificados. Interações exercitadas por amostra (ranking, perfil, filtros, busca por município, simulador, mapa, tabelas e exportações), não os 108 controles. Desempenho de laboratório (localhost, sem limitação) não é experiência real. Erro de conteúdo e limitação declarada foram separados nos achados.

