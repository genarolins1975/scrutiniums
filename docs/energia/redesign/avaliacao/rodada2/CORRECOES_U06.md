# Correções pedidas pelas avaliações independentes: unidade U06

Fonte: produto, tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote2/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/pld` | 10 | 0 |
| `/pld/cmo-e-formacao` | 8 | 0 |
| `/pld/diferencas-regionais` | 8 | 0 |
| `/pld/historico` | 11 | 0 |
| `/pld/limites` | 7 | 0 |

## `/pld`

### D, Impacto social: nota 7.5 (produto)

- O consumidor não encontra o próprio submercado: nenhuma lista de estados por submercado nem ligação com 'Minha região'.
- Sem ponte do PLD para a conta de quem está no mercado cativo ou livre; o texto só diz o que o PLD não é.
- Os CSV completos têm cabeçalho abreviado, sem unidade, fonte ou versão, e usam ';' com decimal '.', o que abre errado no Excel em português.
- Vocabulário técnico denso para leitor leigo.
- Justificativa do avaliador: Há boa transparência de lacunas e bons meios de compartilhar, com o aviso de que PLD não é tarifa. O leitor leigo não localiza a própria região nem converte a unidade, e as exportações completas saem sem unidade e sem fonte.

### A, Layout e hierarquia: nota 8.0 (produto)

- Página longa: cerca de 24 telas no celular (19.993 px) e 12 em 1440, com 10 painéis; o rótulo 'O essencial em poucos minutos' não se cumpre.
- O hub reproduz em resumo painéis de Diferenças regionais e de CMO e formação de preço e repete o trio de notas em vários painéis.
- Em 390 o eixo corta a primeira letra dos rótulos e a tabela do exemplo sintético esconde as colunas de resultado.
- Rótulos de eixo e valores de gráfico com 10 a 11 px.
- Justificativa do avaliador: A primeira tela e a hierarquia são fortes, com unidade, data e natureza do dado visíveis. A nota cai pela extensão (cerca de 24 telas no celular), pela repetição de painéis das subpáginas e de blocos de nota e por falhas de composição em 390 px.

### B, Didática: nota 8.0 (produto)

- A abertura não responde por que a medida importa nem o que ela não permite concluir: a ressalva sobre tarifa fica abaixo da primeira tela e 'Por que isso importa' está recolhido; o título 'Quanto custa a energia no curto prazo?' pode ser lido como preço pago.
- R$/MWh, MWh e MWmed não são definidos para leigos nem convertidos em R$/kWh.
- CCEE e ONS aparecem sem expansão na primeira tela.
- Duas das 12 ligações do diagrama estão pendentes e uma delas é a etapa selecionada por padrão.
- Percentis e 'faixa baixa, central, alta' sem exemplo para leitor leigo.
- Justificativa do avaliador: Conceito antes do uso, exemplos visuais e distinção entre PLD e tarifa estão bem feitos. Faltam, na abertura, por que importa e o que não permite concluir, e a unidade R$/MWh nunca é explicada nem ligada ao kWh da conta.

### C, Utilidade: nota 8.0 (produto)

- Períodos fixos: não há dia ou intervalo livre, e o dia de maior diferença citado no texto (23/03/2026, R$ 824,13/MWh em 12 meses) não pode ser aberto no gráfico.
- Duas contagens de 'diferença entre submercados' (R$ 1,00 aqui e R$ 0,01 em Diferenças regionais) dão percentuais diferentes para a mesma pergunta.
- A coluna 'Horas em faixa baixa, central, alta' usa percentis desde 2021 e ajuda pouco a ler um dia; 'menor valor horário do ano' é nome indireto para o piso.
- O esquema de fluxos mistura 28/09 com os cartões de 30/09.
- Justificativa do avaliador: T9 é cumprida e os filtros acompanham o recorte, mas faltam seleção livre de dia e uma régua única de 'diferença'. Parte dos números (faixas por percentil, menor valor do ano) ajuda pouco a decidir.

### I, Visualizações: nota 8.0 (produto)

- No gráfico horário as linhas coincidem e a separação entre regiões, que dá nome ao painel, aparece só em trechos curtos.
- O esquema de fluxos usa data diferente da dos cartões e é chamado de 'mapa' no texto, com legenda 'sem escala geográfica'.
- A figura de leque P10 a P90 é uma curva desenhada sem dados; o aviso 'sem dados' está só na legenda abaixo.
- Em 390 o eixo vertical cruza a primeira letra dos rótulos das barras.
- Justificativa do avaliador: Eixo, escala comum e tabela equivalente estão corretos, e a sobreposição é admitida no texto. Pesam a separação regional pouco visível no gráfico horário, a data diferente no esquema e a figura de previsão sem marca dentro dela.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Aside com o mesmo nome repetidos em vários painéis (landmark-unique, 3 nós).
- Em 390 o eixo corta a primeira letra dos rótulos e a tabela do exemplo sintético esconde as colunas de resultado sem aviso de rolagem.
- Texto ampliado a 200% estoura a largura em 1280 e 390 px; rótulos de gráfico de 10 a 11 px.
- Justificativa do avaliador: Base sólida em teclado, foco, rótulos e ausência de rolagem lateral de 320 a 1440 px. A nota cai por marcos repetidos, rótulo de eixo cortado, colunas de resultado ocultas no celular e texto ampliado que estoura a largura. Leitor de tela real não foi testado.

### E, Profundidade: nota 8.5 (tecnico)

- A referência histórica começa em 01/01/2021; a série semanal de 2001 a 2020, que a própria página diz ser publicada pela CCEE, não está integrada
- A relação entre preço e intercâmbio é só descritiva: faltam limites de transferência (não achei conjunto público no catálogo do ONS) e o mapa usa 28/09, dois dias antes do último PLD
- Dois dos 12 vínculos do diagrama de formação seguem como conferência pendente, embora as Regras de Comercialização da CCEE (módulo PLD v2025.1.0, p. 5 e 6) tragam texto que os sustenta
- Justificativa do avaliador: Cobertura ampla e conferida: nível, evolução, distribuição, território e relações presentes, com limitações declaradas. Abaixo de 9 porque a história de referência começa em 2021, a relação com o intercâmbio é só descritiva e o mapa de fluxo usa dia anterior ao do preço.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Faixas baixa, central e alta usam quartis nominais de 2021 a 2026 com pisos de R$ 49,77 a R$ 69,04: horas no piso caem em 'baixa' em 2022, 2025 e 2026 e em 'central' em 2023 e 2024; em 30/09 os 41,7% de 'faixa baixa' do SE/CO são horas no piso
- O percentil dos cartões compara média nominal com dias de regimes de limites diferentes, sem versão em moeda constante nesse bloco
- Sem referência anterior a 2021; para os mesmos 30 dias a página conta 55 horas (limiar de R$ 1,00) e Diferenças regionais conta 177 (R$ 0,01)
- Justificativa do avaliador: Referências corretas e com avisos, mas as faixas horárias misturam pisos de anos distintos e o percentil é nominal e restrito a cinco anos. O rótulo 'faixa baixa' pode significar apenas hora no piso do ano, o que limita a comparabilidade.

### J, Navegação e interação: nota 8.5 (produto)

- O hub não mostra a barra de abas locais (Preço e explicação, CMO, Limites, Histórico, Diferenças) que as subpáginas mostram.
- Há camadas de navegação acima do conteúdo (barra superior, grupos, páginas da seção) além do seletor de profundidade.
- Sem seleção livre de dia ou intervalo no gráfico horário.
- 'Baixar CSV' do primeiro painel entrega a série diária desde 2021, não o dia mostrado; o recorte tem botão próprio ('Baixar este período') no painel de períodos.
- Justificativa do avaliador: A interação funciona de ponta a ponta, com URL, teclado e exportação do recorte. Descontam a ausência de abas locais no hub, as camadas de navegação, a falta de escolha livre de data e um download do primeiro painel que não segue o recorte.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- HTML de 644.708 bytes, acima da meta de cerca de 600 KB do CONTRATO_MODULOS.md
- Diferenças calculadas em aritmética binária divergem R$ 0,01 em empates de meio centavo, contra a regra declarada de arredondamento decimal meio para cima; o teste de arredondamento cobre valores já guardados, não a conta que os antecede
- Desempenho conhecido só de laboratório (Chromium sem limitação de rede ou CPU), sem LCP, INP ou CLS de campo
- Justificativa do avaliador: Sem erros, com testes e bloqueio de publicação. Abaixo de 9 por HTML acima da meta do projeto, empates de centavo arredondados para baixo contra a regra declarada e desempenho conhecido apenas em laboratório.

## `/pld/cmo-e-formacao`

### D, Impacto social: nota 7.0 (produto)

- Pouca ponte para o consumidor: tema técnico (CMO, DECOMP, DESSEM) sem ligação com custo ou conta.
- A linha 'Fontes:' atribui o CMO à CCEE e o PLD à ANEEL (registro para o avaliador técnico).
- CSV completos sem unidade, fonte ou versão e com ';' e decimal '.'.
- Nenhuma indicação de estados por submercado.
- Justificativa do avaliador: Serve a analistas e jornalistas, com limites de interpretação visíveis e exportação contextualizada na tabela. Para o leitor leigo e o consumidor o tema fica distante, a linha de fontes embaralha órgãos e os CSV completos saem sem unidade.

### B, Didática: nota 7.5 (produto)

- Três conceitos novos (DECOMP, DESSEM, PLD) na abertura, sem exemplo visual de como se relacionam antes do gráfico.
- Semana operativa, meias horas, patamares e a divergência R$/MW contra R$/MWh exigem leitura técnica.
- 'Por que isso importa' recolhido; MWh não definido.
- A ideia de 'produto diferente no mesmo intervalo' só se completa nas notas abaixo do painel.
- Justificativa do avaliador: Separar CMO e PLD está bem posto, com glossário e notas de não conclusão. O conteúdo é denso para leigos: faltam exemplo visual antes do gráfico e definição de MWh e de semana operativa, e o motivo de importar fica recolhido.

### C, Utilidade: nota 8.0 (produto)

- Para T9 a dispersão horária aparece só em 168 horas e a diferença regional só na tabela de uma semana, e o PLD fica achatado na régua de 0 a 2.000.
- Com Norte, o DECOMP de R$ 1.866,74 estica o eixo e a frase de destaque diz que o PLD ficou R$ 1.742,65/MWh abaixo do CMO, sem alerta fora da nota de tetos.
- O rodapé 'Baixar os dados' entrega séries completas, não o recorte.
- Justificativa do avaliador: Boa ferramenta para o analista comparar CMO e PLD, com recortes e exportação do recorte. Para a tarefa T9 atende só em parte, e o caso do Norte produz uma frase de destaque difícil de interpretar sem alerta.

### I, Visualizações: nota 8.0 (produto)

- O valor atípico semanal do Norte achata PLD e DESSEM no gráfico.
- A régua de 0 a 2.000 nos painéis horários reduz a leitura da diferença hora a hora.
- No painel do Norte, PLD e DESSEM têm a mesma cor azul e se distinguem só pelo tracejado; legenda de oito itens.
- Em 390 o eixo cruza a primeira letra dos rótulos.
- Justificativa do avaliador: Gráficos escolhidos pela tarefa, com escala comum e lacunas honestas. A leitura piora com o valor atípico do Norte e com a régua de 2.000 nos painéis horários, e há cores iguais no Norte e rótulo cortado no celular.

### A, Layout e hierarquia: nota 8.5 (produto)

- Em 390 a legenda do gráfico semanal ocupa 3 linhas e a dos pequenos múltiplos cerca de 7; os controles somam cerca de 450 px e o gráfico semanal fica pequeno, com só dois rótulos de tempo (jan/25 e out/26).
- A tabela dos quatro submercados repete o painel 'CMO e PLD: três produtos' do hub.
- Em 390 o eixo corta o primeiro algarismo dos rótulos de ano do gráfico empilhado.
- Valores de eixo com 10 a 11 px.
- Justificativa do avaliador: A primeira tela é objetiva e a hierarquia é clara, com bom aproveitamento do espaço em 1440. Descontos pelo gráfico pequeno atrás de muitos controles em 390, pela repetição da tabela do hub e por rótulos de eixo cortados.

### E, Profundidade: nota 8.5 (tecnico)

- A relação PLD e CMO por ano é resumida por médias e por uma mediana do valor absoluto; faltam quartis ou percentis da diferença com sinal e dispersão além das últimas 168 horas (2021: média de menos 246,40 contra 252,26 em valor absoluto, assimetria visível só na média)
- Os patamares do DECOMP (leve, média e pesada) estão em pld_cmo_semanal.csv, mas a página mostra só a média semanal
- Justificativa do avaliador: Abrangente e conferido com o ONS. Abaixo de 9 porque a relação central entre CMO e PLD é descrita por médias e uma mediana, sem a distribuição da diferença com sinal, e porque os patamares do DECOMP ficam só no arquivo.

### J, Navegação e interação: nota 8.5 (produto)

- O submercado não persiste entre páginas da família.
- Dois downloads com o mesmo rótulo e escopos diferentes (recorte na tabela, série completa no rodapé).
- Camadas de navegação acima do conteúdo (barra superior, grupos, páginas, abas locais) mais a barra de profundidade.
- Em 390 controles e legenda ocupam cerca de 450 px antes de um gráfico de cerca de 250 px.
- Justificativa do avaliador: Interação rica e consistente, com estado na URL, limpeza de intervalo e exportação do recorte com contexto no nome. Descontos por submercado que não persiste, downloads de escopos distintos com o mesmo rótulo e camadas de navegação.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Em 390 o eixo cruza o primeiro algarismo dos rótulos de ano.
- Rótulos de eixo de 10 a 11 px; com texto a 200% em 390 há 15 px de rolagem lateral.
- Justificativa do avaliador: Sem violações no axe e com teclado, foco e legendas operáveis. A nota fica abaixo de 9 por rótulos cortados e pequenos e por rolagem lateral com texto a 200% em 390 px. Leitor de tela real não foi testado.

## `/pld/diferencas-regionais`

### D, Impacto social: nota 7.5 (produto)

- O consumidor não vê quais estados pertencem a cada submercado nem o que a separação significa para a sua região.
- O link copiado traz o parâmetro de tabela oculta (?hora.t.pag=7).
- CSV completos sem unidade nem fonte no cabeçalho.
- Texto técnico (MWmed, intercâmbio, congestionamento) para leitor leigo.
- Justificativa do avaliador: O tema é a desigualdade regional e a página o trata com neutralidade e lacunas visíveis. Falta ligar submercado a estados e a consequências para o consumidor, e o link copiado e os CSV saem com ruído e sem unidade.

### B, Didática: nota 8.0 (produto)

- O mecanismo intuitivo (capacidade de transferência limita o fluxo) está no hub como 'leitura usual ainda não conferida'; aqui só há a norma.
- O leitor não sabe quais estados compõem cada região.
- Dois limiares (R$ 0,01 aqui e R$ 1,00 no hub) para 'diferença' confundem.
- Classes de percentual e 'um centavo' exigem leitura atenta.
- Justificativa do avaliador: Abertura clara sobre o que se conta e o que não se conclui, com o critério de R$ 0,01 explicado. Falta o mecanismo em palavras simples, a lista de estados por submercado e uma régua única de 'diferença' com o hub.

### I, Visualizações: nota 8.0 (produto)

- As classes mais claras da escala quase somem contra o fundo (1,14:1).
- A matriz simétrica, sem números nas células, repete as barras.
- Os pequenos múltiplos abrem sem o par em destaque.
- Em 390 o eixo cruza o primeiro caractere dos rótulos.
- Justificativa do avaliador: Bom uso de barras, matriz e pequenos múltiplos, com régua comum e leitura por hover, toque e teclado. Descontos pelo baixo contraste das classes claras, pela redundância da matriz e por descompassos entre par em destaque e perfil horário.

### J, Navegação e interação: nota 8.0 (produto)

- O parâmetro ?hora.t.pag=7 de uma tabela oculta entra na URL e no link copiado.
- 'Par em destaque' e 'Período' não comandam o perfil por hora do dia.
- Sem 'restaurar padrão' para os filtros do painel.
- O submercado não persiste entre páginas da família (só o modo persiste).
- Justificativa do avaliador: Controles claros e sincronizados, com comparação de pares bem resolvida e estado na URL. Descontam o parâmetro de tabela oculta no link, o perfil horário desligado do período e do par em destaque e a falta de restaurar padrão.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- As classes claras da matriz ficam abaixo de 3:1 contra o fundo.
- Em 390 uma coluna da tabela fica fora da tela e números são cortados; o eixo cruza os rótulos.
- Rótulos de eixo de 10 px; texto a 200% rola 15 px em 390.
- Justificativa do avaliador: Teclado, rótulos por célula e ausência de rolagem lateral estão bem resolvidos. A nota cai pelo contraste das classes claras, pela tabela cortada e pelos rótulos de eixo cortados em 390 e por texto a 200%. Leitor de tela real não foi testado.

### A, Layout e hierarquia: nota 8.5 (produto)

- Barras e matriz simétrica repetem os mesmos 6 valores; as células não trazem número impresso.
- Em 390 a tabela da matriz esconde a coluna 'Horas separadas (%)' e corta números na borda.
- Em 390 o eixo cruza a primeira letra dos rótulos das barras.
- Justificativa do avaliador: Página enxuta e bem hierarquizada, com a resposta no topo. Descontos pela redundância entre barras e matriz sem números nas células, pela tabela com coluna oculta em 390 e por rótulos de eixo cortados.

### C, Utilidade: nota 8.5 (produto)

- O perfil por hora do dia é fixo nos últimos 12 meses, ignora o Período escolhido e abre sem o par em destaque (SE/CO e Sul).
- Não há seleção de um dia específico para ver a hora de maior diferença (23/03/2026, R$ 824,13).
- Dois limiares de 'diferença' entre o hub e esta página.
- Justificativa do avaliador: É a página que melhor atende T9 na unidade: por par, período, hora do dia e fluxo. Perde pontos porque o perfil horário ignora o período, abre sem o par em destaque e não deixa abrir o dia de maior diferença.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Nas janelas de 12 meses e 30 dias faltam as horas com os quatro no piso: 16,7% e 43,9% das horas não podem separar por regra, mas entram no denominador (separação de 43,3% e 24,6%; fora dessas horas, 52,0% e 43,8%)
- O título usa o limiar de R$ 0,01: 40,2% das horas separadas diferem em no máximo R$ 1,00, e a página principal usa R$ 1,00 (177 horas contra 55 em 30 dias)
- Sul com Nordeste e Sul com Norte não têm fronteira direta (a separação passa pelo SE/CO), e Sul e Norte lidera a matriz sem essa nota
- Justificativa do avaliador: Boa descrição, com limiares transparentes. Abaixo de 9 porque as janelas recentes não mostram as horas com os quatro no piso, em que a separação é impossível por regra, e o título conta como separação diferenças de poucos centavos.

## `/pld/historico`

### D, Impacto social: nota 7.0 (produto)

- Tema técnico sem ponte para a conta: o leitor leigo não sabe se um preço 'alto' importa para ele.
- CSV sem unidades e com colunas internas.
- A linha de fontes junta órgãos e conjuntos (registro para o avaliador técnico).
- Sem lista de estados por submercado.
- Justificativa do avaliador: Há cuidado em dizer que a média ponderada não é preço pago e a moeda constante ajuda a ler o longo prazo. Para o leitor leigo o tema é distante, os CSV saem sem unidade e a linha de fontes é confusa.

### B, Didática: nota 7.5 (produto)

- Vocabulário técnico denso: ponderada, balanço, perímetro, MMGD, moeda constante, percentil.
- Sem exemplo visual que mostre por que a ponderada difere da temporal.
- 'Por que isso importa' recolhido; MWh não definido.
- O mesmo dia aparece com percentil 60,3 no hub e 38,7 aqui; a explicação está em nota de rodapé do hub.
- Justificativa do avaliador: A ideia de régua é bem posta e o IPCA tem exemplo numérico. O vocabulário de pesos, perímetro e percentil é técnico demais para leigos, sem exemplo visual, e o motivo de importar fica recolhido.

### I, Visualizações: nota 7.5 (produto)

- O gráfico das três médias não permite comparar as réguas, que é a razão do painel.
- A faixa de médias diárias é comparada com a linha de média mensal de 2026; só a nota evita leitura errada.
- Classes claras dos mapas de calor com contraste baixo contra o fundo.
- Em 390 os mapas mostram médias de 4 horas, com picos menores.
- Justificativa do avaliador: A faixa sazonal, o boxplot e os mapas são boas escolhas, com referências e escala fixa. O painel central, que deveria comparar as três réguas, não as separa visualmente, e as classes claras dos mapas têm pouco contraste.

### A, Layout e hierarquia: nota 8.0 (produto)

- O texto sobre perímetro da carga e pesos se repete em três blocos.
- O gráfico das três médias parece uma linha só, o que desperdiça o painel de maior destaque.
- O mapa hora por dia carrega ao rolar: o bloco de 209 px em 390 (164 px em 1440) cresce para 2.077 px (1.294 px) e empurra o conteúdo.
- Rótulos de eixo e valores de 10 a 11 px.
- Justificativa do avaliador: Pergunta e resposta no topo e boa hierarquia, com adaptação cuidadosa dos mapas ao celular. A nota cai pela repetição de explicações, pelo gráfico das três médias que não separa as linhas e pelo bloco que cresce ao rolar.

### C, Utilidade: nota 8.0 (produto)

- A comparação das três médias não é legível no gráfico, só nos cartões do último mês.
- Em 390 o padrão de faixas de 4 horas suaviza o pico (máximo de R$ 503,56 contra R$ 617,90 em 1440 no mapa por mês).
- O mapa hora por dia só aceita 30, 60 ou 90 dias.
- Justificativa do avaliador: Responde bem à pergunta sazonal e traz perfis por hora e mês úteis. Perde pontos porque as três médias só se comparam nos cartões e porque o padrão do celular suaviza o pico do fim da tarde.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- As classes claras dos mapas ficam abaixo de 3:1 contra o fundo.
- O bloco sob demanda muda a altura da página ao aparecer na tela, com indicação mínima de carga.
- Texto a 200% rola 15 px em 390; rótulos de 10 a 11 px.
- Justificativa do avaliador: Teclado, rótulos por célula e adaptação dos mapas ao celular estão bons. A nota cai pelo contraste das classes claras, pelo bloco que muda a altura ao carregar e por texto a 200%. Leitor de tela real não foi testado.

### E, Profundidade: nota 8.5 (tecnico)

- A base histórica começa em 2021 e a sazonal tem cinco anos; a série semanal de 2001 a 2020 que a página diz ser publicada pela CCEE não está integrada
- Faixa sazonal e percentis em valores nominais; a moeda constante só existe na média mensal
- Sem contexto hidrológico da mesma época (EAR ou ENA) ao lado do percentil, para a pergunta 'alto para esta época?'
- Justificativa do avaliador: Cobertura rica e conferida, com réguas nomeadas e quebras de série marcadas. Abaixo de 9 porque a história é curta (2021 a 2026), a faixa sazonal é nominal e falta ligação com o estado hidrológico da época.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- Percentis e faixas sazonais em valores nominais de anos com pisos de R$ 49,77 a R$ 69,04; moeda constante só na média mensal
- Base de no máximo cinco anos por mês e de 35 dias por semana ISO
- A diferença entre ponderada e temporal é calculada sobre valores já arredondados: o Norte exibe R$ 0,39 e o CSV (127,0851 menos 126,7024) dá 0,38
- Justificativa do avaliador: Réguas bem nomeadas, perímetros e IPCA corretos e conferidos. Abaixo de 9 por usar referência sazonal nominal e curta, de poucos anos com limites distintos, e por derivar diferenças de valores já arredondados (R$ 0,39 contra 0,38).

### H, Rastreabilidade: nota 8.5 (tecnico)

- O dicionário cobre 12 das 24 colunas de pld_mensal.csv e 1 das 16 de carga_verificada_horaria.csv (sem unidade dos pesos)
- A carga horária do balanço, peso da ponderada principal, não vai nos arquivos; refazer a conta exige o arquivo do ONS (consegui e bate)
- As fichas citam eec0a3121e05+alterado e avisam que a reprodução pode diferir
- O cartão da média temporal de ago/2026 diz 'sem ficha de prova própria'
- Justificativa do avaliador: Rastreio forte (fichas, sha256, exportações idênticas), mas CSV com metade das colunas sem dicionário, peso do balanço fora dos arquivos e versão de código alterada limitam a reprodução fiel a partir da própria página.

### J, Navegação e interação: nota 8.5 (produto)

- O mapa hora por dia sob demanda faz o documento crescer 1.868 px em 390 (de 9.060 para 10.928) com só uma frase de espera.
- O submercado não persiste entre páginas da família.
- O rodapé 'Baixar os dados (5 arquivos)' entrega arquivos completos independentes do recorte; a exportação do recorte pela tabela equivalente não foi testada aqui.
- Justificativa do avaliador: Interação consistente, com estado na URL e sincronização de todos os blocos com o recorte. Descontos por bloco sob demanda que muda a altura da página, submercado que não persiste e downloads de rodapé que não seguem o recorte.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- HTML de 616.257 bytes, acima da meta de cerca de 600 KB, e 3,6 mil nós de DOM
- Diferença ponderada menos temporal derivada de valores já arredondados: 0,39 exibido contra 0,38 exato
- Desempenho conhecido só de laboratório, sem dado de campo
- Justificativa do avaliador: Sem erros e com testes e bloqueios de publicação, mas HTML acima da meta, DOM maior que o das páginas irmãs e um valor derivado com um centavo de diferença.

## `/pld/limites`

### D, Impacto social: nota 7.5 (produto)

- Sem ponte para o consumidor: o que piso e teto significam para custo ou conta não é dito.
- Sem lista de estados por submercado.
- CSV com cabeçalho abreviado e sem unidade (pld_media_dia, horas_no_piso).
- Texto técnico e regulatório (REN, despachos) para leitor leigo.
- Justificativa do avaliador: A página trata os limites regulatórios com neutralidade e documenta cada ato, o que ajuda jornalistas e pesquisadores. O leitor comum não vê o efeito para o custo nem a própria região, e os CSV saem com cabeçalho abreviado.

### B, Didática: nota 8.0 (produto)

- O motivo dos limites (custos de referência) só aparece em Auditar.
- 'Hora no limite' é definida por tolerância de R$ 0,005/MWh no texto de Unidade, sem exemplo.
- 'Por que isso importa' recolhido; ANEEL e CCEE só no bloco recolhido de siglas.
- Justificativa do avaliador: Os três limites são explicados em linguagem direta e as restrições de leitura estão claras. O motivo dos limites e o critério de 'no limite' ficam em níveis mais profundos, e o 'por que importa' permanece recolhido.

### I, Visualizações: nota 8.0 (produto)

- As classes claras do calendário quase somem contra o fundo (1,14:1).
- A série do teto horário é invisível em escala percentual.
- Em 390 o eixo cruza os algarismos dos anos.
- Justificativa do avaliador: Boa escolha de calendário, barras e empilhado, com zero, ausência e 'não se aplica' bem distinguidos. A leitura do calendário fica frágil nas classes claras, e o teto horário some na escala percentual.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- As classes claras do calendário ficam abaixo de 3:1 contra o fundo.
- Em 390 o eixo cruza os algarismos dos anos.
- Texto a 200% gera rolagem lateral em 1280 e 390 px; rótulos de gráfico de 10 a 11 px.
- Justificativa do avaliador: Teclado, foco e rótulos por célula estão bem resolvidos e não há rolagem lateral de 320 a 1440 px. A nota cai pelo baixo contraste das classes claras, rótulos cortados em 390 e texto ampliado que estoura a largura. Leitor de tela real não foi testado.

### A, Layout e hierarquia: nota 8.5 (produto)

- A série de piso de SE/CO aparece no primeiro gráfico e de novo no gráfico por submercado.
- A caixa de seleção de até 4 submercados abre com os 4 marcados e ocupa uma faixa inteira sem função imediata.
- A série 'no teto horário' vira um fio no eixo (0,00% a 0,06%).
- Em 390 o eixo cruza os algarismos dos anos.
- Justificativa do avaliador: Página enxuta, com resposta no topo e o cartão dos limites do ano à vista. Descontos por série repetida entre dois gráficos, controle de seleção que ocupa espaço sem função e rótulos de eixo cortados em 390 px.

### C, Utilidade: nota 8.5 (produto)

- Piso e tetos aparecem um ano por vez (seletor); a comparação lado a lado está em Analisar.
- O calendário ignora o Ano escolhido e só cobre os 183 ou 366 dias mais recentes.
- A exportação do Entender é o CSV diário completo; o recorte sai pela tabela.
- Justificativa do avaliador: Atende bem a pergunta sobre quando o preço encosta nos limites, com recortes úteis e resumo textual para casos raros. Perde pontos por mostrar os limites um ano por vez, por um calendário independente do ano escolhido e por downloads de escopos diferentes.

### J, Navegação e interação: nota 8.5 (produto)

- O submercado não persiste entre páginas da família.
- O calendário ignora o Ano escolhido (explicado no texto).
- Dois downloads chamados 'Baixar CSV' com escopos diferentes (série completa no rodapé, recorte na tabela).
- Parâmetros inválidos permanecem na URL sem aviso.
- Justificativa do avaliador: Interação previsível e bem documentada na URL, com resumo textual para calendários vazios. Perde pontos pelo submercado que não persiste, pelo calendário independente do ano e por downloads de escopos distintos com o mesmo nome.

## Achados que se repetem entre páginas

- (produto) Rótulos de categoria cortados pelo eixo em 390 px nos gráficos de barras horizontais de /pld, /diferencas-regionais, /limites e /cmo-e-formacao: a primeira letra ou algarismo fica sob a linha do eixo.
- (produto) Exportações completas sem unidade, fonte ou versão no cabeçalho (data_hora_local;SE;S;NE;N), com ';' e decimal '.'; nas subpáginas o rodapé do painel e a tabela equivalente oferecem, cada um, um 'Baixar CSV' de escopo diferente (série completa e recorte), sem rótulo que os distinga.
- (produto) O submercado escolhido não persiste ao trocar de página da família (só o modo persiste); o hub não mostra as abas locais que as subpáginas mostram; há camadas de navegação acima do conteúdo.
- (produto) R$/MWh, MWh e MWmed não são definidos nem convertidos em kWh; nenhuma página diz quais estados formam cada submercado; CCEE, ONS e ANEEL só são expandidas no bloco recolhido de siglas.
- (produto) As linhas 'Fontes:' de /cmo-e-formacao, /historico e /limites juntam órgãos e conjuntos e atribuem CMO à CCEE e PLD à ANEEL (registro para o avaliador técnico).
- (produto) Janelas de 'último ano' diferentes (365 dias em 12 meses e Diferenças regionais, 366 no calendário de Limites, 368 na série de amplitude do hub) e dois limiares de 'diferença entre submercados' (R$ 1,00 no hub, R$ 0,01 em Diferenças regionais).
- (produto) Mapas de calor com classes claras abaixo de 3:1 contra o fundo (1,14:1 e 1,65:1) em /historico, /limites e /diferencas-regionais; a leitura depende da legenda e do rótulo de cada célula.
- (produto) Rótulos e valores de gráfico com 10 a 11 px em todas as páginas; texto ampliado a 200% gera rolagem horizontal em /pld e /limites a 1280 px e em todas as páginas a 390 px.
- (tecnico) Versão de código das fichas: as quatro páginas filhas citam eec0a3121e05+alterado (publicação de 01/10/2026 de árvore com alterações fora de commit; a ficha avisa que a reprodução pode diferir) e a página principal cita 196905461ac0. A mesma publicação mistura duas versões.
- (tecnico) Datas de referência por fonte inconsistentes: fluxo do ONS até 28/09 nas páginas do PLD, mas rede_horario_2026.csv traz 29/09; rodapés com 'referência até 02/10/2026' para o PLD (CMO) e 'até 30/09/2026 23:00' para o intercâmbio (Diferenças), contra 30/09 e 28/09 nos cabeçalhos.
- (tecnico) Arredondamento de empates de meio centavo em diferenças derivadas: Sul mais 13,03 em vez de 13,04 e 14 de 368 pontos da amplitude diária (PLD); Norte 0,39 em vez de 0,38 (Histórico). O teste de arredondamento cobre valores guardados, não a aritmética anterior.
- (tecnico) Referência histórica só desde 2021 e comparações nominais (percentis, faixas e faixa sazonal) com pisos de R$ 49,77 a R$ 69,04; a série semanal de 2001 a 2020 não está integrada (PLD, Histórico).
- (tecnico) Dicionário de colunas incompleto nos CSV que sustentam as páginas: pld_mensal.csv 12 de 24, carga_verificada_horaria.csv 1 de 16, pld_limites_diario.csv 11 de 14.
- (tecnico) Peso das páginas: HTML de 644.708 bytes (PLD) e 616.257 (Histórico), acima da meta de cerca de 600 KB do projeto; DOM de 3,3 a 3,6 mil nós em Histórico e Limites; desempenho só de laboratório em todas.
- (tecnico) Dias sem CMO do DESSEM (30/05, 09/08 e 05/09/2026, entre outros) com PLD de dois valores no dia, compatível com a contingência por semana e patamar das Regras da CCEE, sem sinalização nas leituras horárias (PLD, Histórico, CMO).
- (tecnico) Reconciliação das fichas Comprove: 5 das 7 relêem a captura de 27/09 do PLD, e duas (Diferenças e Limites) ficam 'com ressalva' porque 72 horas posteriores não entram na releitura.

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística feita por agente, sem usuários, tempos ou depoimentos. Leitor de tela real não foi testado; usei só Chromium headless e nenhum dispositivo de toque, Firefox ou Safari. O axe cobre regras automáticas: deixou de 53 a 172 verificações de contraste incompletas por página, e só conferi à mão o texto HTML sobre fundo sólido (todos acima de 4,5:1); texto em SVG e sobre gradiente não foi medido. Não havia capturas de Analisar e Auditar: avaliei esses níveis por texto, axe e medidas de DOM, sem inspeção visual. As capturas de 1440 vieram a 50% e os trechos de 390 vieram incompletos; completei com capturas e medidas próprias dos painéis principais e das larguras 320, 390 e 768, sem inspecionar todos os trechos ausentes. As faixas em branco após o rodapé nas capturas de 390 não se reproduzem na página ao vivo (o rodapé termina no fim do documento) e foram tratadas como artefato de captura. O objetivo.json mede 360 e não 320 px; medi 320 por DOM. O movimento reduzido foi avaliado só pelo CSS. Não avaliei a correção numérica (papel do avaliador técnico), exceto a conferência visível entre gráfico, tabela e CSV do dia em /pld (96 células, sem divergência) e o texto de notas entre páginas. Não abri CSV nem XLSX em planilha. Os testes de URL e de estado foram feitos no servidor local http://localhost:3100, que serve o commit d616ae877. Nenhum bloqueio da seção 7 da rubrica foi comprovado do ponto de vista de produto nas cinco páginas; a lista vazia significa nenhum comprovado, não verificação omitida.
- (tecnico) Consultei em fonte primária: dados abertos do ONS (CMO semanal e semi horário, balanço de energia por subsistema, intercâmbio entre subsistemas e dicionários), IBGE SIDRA (IPCA, tabela 1737, variável 2266) e as Regras de Comercialização da CCEE, módulo PLD v2025.1.0 (PDF só de imagem; li as páginas 5, 6, 13 e 14; não sei se é a versão vigente). Não consegui abrir o portal de dados abertos da CCEE, o Planalto, a biblioteca de atos da ANEEL, o DOU nem o Internet Archive. Por isso o PLD horário foi conferido por coerência interna e por resumos qualitativos dos InfoPLD diários de 30/07, 19/08 e 01/09/2026 obtidos por busca (os PDFs excederam o limite de leitura); as horas de 28 a 30/09/2026 não têm conferência independente. Os limites de 2021 a 2026 foram corroborados por fontes secundárias (Cenário Energia e Brasil Energia, via busca) e pela razão constante de 2,0516 entre teto horário e estrutural, não pelo texto dos atos; não verifiquei a numeração dos artigos da REN 1.032/2022 nem do Decreto 5.163/2004. A semântica das variáveis val_cargaglobal e val_cargammgd da API de carga verificada do ONS não foi conferida em dicionário primário, só a aritmética das médias. Não executei testes, build nem pipeline; li código, testes e workflows. O desempenho é de laboratório (Chromium sem limitação de rede ou CPU, em localhost), sem dado de campo. O site é um retrato de 01/10/2026 (dados até 30/09/2026); a conferência com o ONS de 09/10/2026 mostra dados posteriores à captura, que tratei como defasagem e não como erro. Pelo que busquei no catálogo do ONS (limite, intercâmbio, restrição, transmissão, capacidade) não há conjunto público de limites de intercâmbio entre subsistemas. Acessibilidade e leitor de tela não fazem parte do meu papel.

