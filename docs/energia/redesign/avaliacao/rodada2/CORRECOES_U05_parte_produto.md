# Correções pedidas pelas avaliações independentes: unidade U05

Fonte: produto em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote3/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/carga` | 7 | 0 |
| `/carga/clima-e-calendario` | 7 | 0 |
| `/carga/perfil-horario` | 7 | 0 |
| `/rede` | 7 | 0 |
| `/rede/balanco-e-exterior` | 7 | 0 |
| `/rede/programado` | 7 | 0 |
| `/rede/restricoes` | 7 | 0 |

## `/carga`

### A, Layout e hierarquia: nota 8.0 (produto)

- Repetição: o mesmo resultado aparece no KPI, na frase do painel, no gráfico de pontos e no parágrafo de +10,54%; as janelas de 28 dias e mês corrente são linhas idênticas.
- Histórico: três rótulos de regime em 10 px empilhados cruzam a série e as marcas (1440_inteira_02de03.png, ampliado por mim).
- Gráfico anual: rótulos truncados ('2014 (364 d…', '2026 (271 d…'); em 390 px o rótulo de 2026 não aparece.
- Em 390 px a tabela Acumulado do ano esconde a coluna Variação (%), a principal (390_inteira_05de07.png).
- Página longa: 6.369 px em 1440 e 9.723 px em 390, sem sumário interno.
- Justificativa do avaliador: Primeira tela muito boa e hierarquia clara. Rebaixada por repetição de números e avisos, rótulos truncados ou sobrepostos nos gráficos e pela coluna principal da tabela fora da tela no celular.

### B, Didática: nota 8.0 (produto)

- O porquê da medida fica recolhido no fim da página e o que não se conclui só aparece abaixo dos gráficos.
- MWmed, ONS e MMGD sem expansão no texto visível; as definições estão só no bloco recolhido de siglas.
- Cinco números para a mesma semana (+11,45%, +10,54%, +11,4% na ficha, +11,06% e 10,49 pontos na página Clima), reconciliados só em blocos baixos.
- Analisar, Auditar e a ficha de prova expõem jargão interno ('silver', 'não está no bronze deste ambiente', 'val_cargaenergiamwmed') e um painel sobre 'o +10,5% publicado antes', que o leitor nunca viu.
- Justificativa do avaliador: Boa didática: bases, unidade e limites bem ditos. Falta ancorar o porquê e o que não se conclui na abertura, traduzir siglas no texto visível e reduzir a proliferação de números parecidos.

### D, Impacto social: nota 8.0 (produto)

- Cabeçalhos do CSV técnicos (submercado;janela;tipo;inicio_ant...), sem dicionário nem metadados dentro do arquivo.
- Prévia de compartilhamento genérica (og:title 'Scrutiniums: Crédito e Setor Elétrico'), sem a pergunta nem o número.
- Leitor leigo: siglas e regime do ONS exigem leitura técnica; a relevância social do consumo não aparece na abertura.
- Justificativa do avaliador: Bom para pesquisadores e jornalistas: exporta e compartilha com recorte e deixa lacunas visíveis. O texto técnico, o CSV sem dicionário e a prévia de link genérica limitam o alcance a leigos.

### I, Visualizações: nota 8.0 (produto)

- Linhas sem calendário equivalente não têm marca visual nem rótulo.
- Rótulos de regime em 10 px sobrepostos à série e às linhas de marca.
- Rótulos anuais truncados e ano parcial (2026, 271 dias) sem padrão visual próprio.
- Variação mensal com quatro linhas sobrepostas é pouco legível em 390 px.
- Último mês parcial (set/2026) desenhado como os completos, com nota só abaixo do gráfico.
- Justificativa do avaliador: Escolha de gráficos adequada, com referências, tabelas e teclado. Rebaixada por falta de marca para calendário não equivalente, rótulos sobrepostos ou truncados e mês e ano parciais sem tratamento visual.

### C, Utilidade: nota 8.5 (produto)

- Janelas sem calendário equivalente (28 dias, mês corrente, 52 semanas) aparecem no gráfico como comparáveis; o aviso está só na tabela recolhida e na janela escolhida.
- A ficha Comprove existe só para SIN, 7 dias e mesmos dias da semana; some ao mudar o recorte, sem aviso.
- Clima e perfil horário exigem sair da página, por cartões a cerca de 2.500 px do topo.
- Justificativa do avaliador: A tarefa T7 é bem atendida no núcleo, com filtros sincronizados. Perde pontos porque o gráfico não marca calendário não equivalente, a prova some fora do padrão e partes da tarefa ficam em outras páginas.

### J, Navegação e interação: nota 8.5 (produto)

- A página-mãe não mostra no topo as páginas irmãs; só cartões 'Outras perguntas' bem abaixo, enquanto as filhas têm barra.
- 'Restaurar intervalo' volta à série inteira (1.096 pontos), não aos 90 dias, e apaga a legenda do intervalo.
- A ficha Comprove some ao trocar região ou janela, sem aviso.
- O seletor de regiões do gráfico mensal começa cheio (4 de 4) e exige remover antes de trocar.
- Justificativa do avaliador: Interação rica e consistente, com estado em URL, exportação filtrada e estados vazios claros. Limitada pela navegação de irmãs ausente na página-mãe, pela restauração que muda de escala e pela prova que some sem aviso.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Texto de 10 e 11 px em anotações e eixos; um terço do texto em 12 px.
- Em 390 px a coluna Variação da tabela anual fica fora da tela (há aviso textual de rolagem lateral).
- Rótulos anuais truncados; contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Base de acessibilidade forte: axe limpo, foco visível, teclado completo e sem transbordo até 320 px. Faltam testes manuais de contraste e leitor de tela, e há texto pequeno e coluna principal fora da tela no celular.

## `/carga/clima-e-calendario`

### B, Didática: nota 7.5 (produto)

- Jargão de modelagem (dobras, defasagem, origem mensal, ex post, quantis, cobertura de intervalo) sem glossário por perto.
- Três números para a mesma semana (10,49 pontos, +11,06% e +11,45% em Carga) reconciliados só numa nota baixa.
- Calendário 0,00 não é explicado (mesma composição de dias); só muda com Mesmas datas (menos 2,42).
- Por que importa e siglas (IBGE, NASA POWER, MMGD) ficam recolhidos.
- Justificativa do avaliador: Esforço claro de honestidade, mas a carga conceitual é alta: log × 100, variantes técnicas e três números concorrentes. Faltam exemplo e glossário próximos, e a abertura não diz por que a medida importa.

### D, Impacto social: nota 7.5 (produto)

- Texto técnico demais para leitor não especializado; relevância para consumo e custo não aparece.
- Prévia de compartilhamento genérica, sem a pergunta nem o número.
- Recorte territorial só por subsistema.
- Justificativa do avaliador: Útil a pesquisadores e analistas, com lacunas e limites bem expostos e exportação por tabela. O alcance social é limitado pela linguagem do modelo, pela prévia de link genérica e pela ausência de leitura em custo e continuidade.

### A, Layout e hierarquia: nota 8.0 (produto)

- O título do painel diz 22/09 a 28/09; o cálculo usa 22/09 a 27/09 (6 dias), esclarecido em nota abaixo.
- Quatro KPIs em unidades diferentes (log × 100 e %) lado a lado, com legendas longas.
- 'Associação, não causa' e a definição de resíduo se repetem no lead, no KPI, nos blocos e nas notas.
- Página de 5.815 px (1440) e 8.727 px (390), com seis gráficos.
- Justificativa do avaliador: Primeira tela objetiva, com a resposta e o limite ditos. Rebaixada pela diferença entre o período do título e o do cálculo, KPIs em unidades distintas e repetição de explicações numa página longa.

### I, Visualizações: nota 8.0 (produto)

- Barras da decomposição sem valores diretos; o zero de Calendário parece ausência de barra.
- No gráfico de contribuições a escala do calendário esconde temperatura e sazonalidade.
- Em 390 px a legenda das contribuições quebra em duas linhas e o rótulo final vira 'Tendência'.
- Justificativa do avaliador: Visualizações bem escolhidas e honestas quanto a intervalo e faixa. Perdem por barras sem rótulo de valor, escala dominada pelo calendário e legendas apertadas no celular.

### C, Utilidade: nota 8.5 (produto)

- A decomposição vale para 6 dias; a comparação de janelas equivalentes completa está na página Carga.
- A ficha Comprove do erro de 2,08% some em outras regiões.
- Escolher entre variantes exige leitura técnica.
- Justificativa do avaliador: Atende bem a parte de clima e calendário de T7: números descritivos, referência simples, erro e sensibilidade, tudo sincronizado. Limitada pela janela de 6 dias, pela prova que some e pelo jargão para escolher a variante.

### J, Navegação e interação: nota 8.5 (produto)

- Ao escolher a variante a janela muda de 6 para 7 dias sem destaque além das datas.
- A ficha Comprove some em outras regiões.
- Navegação de família diferente entre mãe e filhas (barra só nas filhas).
- Justificativa do avaliador: Interação correta e coerente, com texto que acompanha o sinal da diferença e estado em URL. Pequenos atritos: mudança silenciosa de janela, prova que some e navegação de família inconsistente.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Variante do modelo truncada no select em 390 px.
- Tabelas de 10 a 14 colunas exigem rolagem lateral no celular.
- Contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Boa base: axe limpo, foco, teclado e sem transbordo. Limites: tabelas largas e select truncado no celular, e ausência de testes manuais de contraste e leitor de tela.

## `/carga/perfil-horario`

### A, Layout e hierarquia: nota 7.5 (produto)

- O glossário denso interrompe a sequência entre o dia típico e o mapa do pico.
- O mapa de calor corta horas em 390 e 768 px, e a resposta (18h e 19h) fica fora da tela.
- Gráficos empilhados com eixos diferentes para as mesmas horas dificultam a comparação.
- O controle Região fica ao lado do dia típico mas não o governa; os KPIs ficam fixos em SIN.
- O KPI 'no dia' mostra 28/09 enquanto a série vai até 29/09, com pico maior às 11h.
- Justificativa do avaliador: Boa primeira tela e sequência lógica. Rebaixada pelo glossário no meio, mapa de calor cortado no celular, eixos distintos empilhados e um controle que não governa o que está logo abaixo.

### I, Visualizações: nota 7.5 (produto)

- Mapa de calor cortado em 390 e 768 px, sem indicação de rolagem.
- Selo 'Observado' no painel que inclui MMGD estimada; o glossário marca carga global como Observado.
- Mês parcial (set/2026) desenhado como completo na série mensal de MMGD, sem aviso no Entender.
- Eixos de 0 a 100.000 e de 70.000 a 95.000 empilhados; com Nordeste, regiões diferentes na mesma cruz.
- Rótulos de dia às 23h ('23/09 23h') no eixo dos 7 dias.
- Justificativa do avaliador: Boas escolhas (mapa de calor, séries separadas), mas o mapa perde a resposta no celular, o selo Observado cobre séries estimadas e há mês parcial sem marca. Rebaixada por esses defeitos.

### J, Navegação e interação: nota 7.5 (produto)

- Região altera frase, mapa e uma curva, mas o dia típico e os picos seguem SIN; o aviso está só em Universo, no fim do painel.
- Sábado desaparece em 11 de 12 meses sem aviso e a seleção volta a dia útil.
- Clicar no seletor do mapa leva a página ao topo (2.692 para 70), longe do gráfico alterado.
- KPIs fixos em SIN, ainda que o controle Região esteja na página.
- Justificativa do avaliador: Controles bem ligados no essencial, mas o escopo parcial da Região, a opção de sábado que some e o salto ao topo no seletor do mapa quebram a previsibilidade. Abaixo das páginas irmãs.

### B, Didática: nota 8.0 (produto)

- O porquê (pico líquido deslocado para a noite) fica no bloco recolhido, não na abertura.
- Quatro nomes parecidos de carga exigem o glossário, que vem depois do primeiro gráfico.
- ONS, CCEE e API no texto visível sem expansão.
- Justificativa do avaliador: Didática forte: explica os produtos, evita soma indevida e liga com a página Carga. Falta posicionar o glossário antes do primeiro gráfico e trazer o porquê para a abertura.

### C, Utilidade: nota 8.0 (produto)

- O dia típico por região só existe em Analisar; no Entender a região não o altera.
- Sábado some em 11 dos 12 meses sem explicação.
- Não compara com calendário equivalente nem clima; depende de Carga e Clima.
- Justificativa do avaliador: Atende bem a parte 'ver o perfil horário' de T7 no SIN, com pico e MMGD claros. Limitada por uma região que não governa o dia típico e por uma opção de sábado que desaparece.

### D, Impacto social: nota 8.0 (produto)

- A relevância social do pico noturno fica no bloco recolhido.
- Leitor leigo enfrenta 'carga global', 'líquida' e 'curva' sem exemplo.
- Prévia de compartilhamento genérica.
- Justificativa do avaliador: Tema de alto interesse público (solar distribuída e pico noturno), com estimativas bem identificadas e exportação. O porquê social está escondido e a linguagem é técnica.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Em 390 e 768 px o mapa de calor tem 1.176 px e corta as horas finais sem pista de rolagem.
- Texto de 10 px nas marcas de regime.
- Contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Base sólida (axe limpo, teclado no mapa, hachura). Pesa a resposta principal do mapa ficar fora da tela no celular e no tablet, o texto de 10 px e a falta de testes manuais de contraste e leitor de tela.

## `/rede`

### A, Layout e hierarquia: nota 8.0 (produto)

- As mesmas quatro fronteiras aparecem em KPIs, esquema, cartões, gráfico e tabela: repetição alta.
- Em 390 px os valores do eixo (menos 4.000.000, menos 2.000.000, 2.000.000, 4.000.000) se sobrepõem.
- Escala Hora: rótulos '23/09 23h24/09 23h' colidem em 1440 px, na coluna estreita.
- O aviso 'limites operativos não são públicos' aparece três vezes (nota dos KPIs, nota do esquema e bloco O que não é possível concluir).
- Justificativa do avaliador: Primeira tela e hierarquia muito boas, esquema bem resolvido para o celular. A repetição das quatro fronteiras e dos avisos e as colisões de rótulos nos eixos impedem nota maior.

### D, Impacto social: nota 8.0 (produto)

- CSV com colunas técnicas (liquido_mwh, canonico_mwh, inverso_mwh) sem dicionário.
- Sem ponte para custo ou continuidade na própria página.
- Prévia de compartilhamento genérica.
- Justificativa do avaliador: Útil a gestores e analistas, com transparência sobre o que não é público e exportação. A linguagem técnica, o CSV sem dicionário e a falta de ligação com custo e continuidade limitam o alcance.

### I, Visualizações: nota 8.0 (produto)

- Eixo do gráfico de barras sobreposto em 390 px.
- Rótulos '23/09 23h24/09 23h' colados na escala Hora (1440 px).
- Mês parcial só avisado abaixo do terceiro gráfico; linhas mensais sem marca no ponto.
- Quatro linhas de fronteira sobrepostas pouco legíveis em 390 px.
- Justificativa do avaliador: Gráficos escolhidos com critério (setas proporcionais, sentidos separados, preço na mesma hora). Rebaixada por eixos e rótulos que colidem e por mês parcial sem marca no ponto.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Eixo sobreposto em 390 px no gráfico principal de sentidos.
- Rótulos de hora colados em 1440 px na escala Hora.
- Link inline de 15 px de altura no bloco Universo.
- Contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Boa acessibilidade estrutural, com esquema substituído por lista no celular. Rebaixada pelo eixo ilegível em 390 px no gráfico principal e pelos rótulos colados na escala Hora.

### B, Didática: nota 8.5 (produto)

- Por que importa recolhido; ONS, CCEE, PLD e MWmed sem expansão no texto visível.
- Os KPIs e o esquema usam o sentido real ('do Nordeste para o Norte', NE → N), enquanto gráficos e tabelas usam o nome canônico (Norte → Nordeste) com saldo negativo; o leitor precisa mapear.
- A frase de 'Quem exportou e quem importou' cita saldos (22.040 MWh no Sul) num painel de valores brutos (51.257 de exportação bruta).
- Justificativa do avaliador: Didática excelente na distinção entre saldo e sentidos, com números e limites. Falta mostrar o porquê na abertura, traduzir siglas e uniformizar sinais e a frase de exportação e importação.

### C, Utilidade: nota 8.5 (produto)

- Exterior e restrições são só links; Argentina e Uruguai entram no Sul numa nota, enquanto o Universo diz que o exterior está em outra página.
- O programado só aparece na escala Hora.
- Número de 30 dias do KPI e número do dia escolhido convivem sem destaque de qual vale para cada bloco.
- Justificativa do avaliador: Cumpre o núcleo de T8, distinguir saldo de fluxo bruto, com escalas de dia e hora e sem inferir congestionamento. Exterior e restrições dependem de outras páginas.

### J, Navegação e interação: nota 8.5 (produto)

- A página-mãe não mostra a barra de páginas irmãs; nas filhas barra e cartões 'Outras perguntas' repetem os mesmos links.
- O seletor de fronteiras começa com 4 de 4; para trocar é preciso remover primeiro.
- A escala Hora traz dois selects (Dia da janela e Hora) sem explicar a ligação com a cruz do gráfico.
- Justificativa do avaliador: Interação muito boa: dia e hora, seleção e limpeza de fronteira, estado em URL e limite de seleção claro. Descontos para navegação de irmãs inconsistente e seletor múltiplo que começa cheio.

## `/rede/balanco-e-exterior`

### B, Didática: nota 7.5 (produto)

- A resposta 'pelo menos 95%' não diz na abertura que em jan e fev/2026 todas as horas têm resíduo (744 e 672 horas).
- Conceitos (balanço interno, perímetro, identidade, tolerância de 0,1 MWmed) pesados para quem não conhece o balanço do ONS.
- Itaipu e o motivo de o Paraguai não ter hora publicada só ficam claros no Analisar.
- Por que importa e siglas recolhidos.
- Justificativa do avaliador: Boa honestidade e definições, mas conceitos pesados e uma manchete percentual que esconde a concentração do problema em 2026. A explicação de Itaipu e do Paraguai está só em Analisar.

### D, Impacto social: nota 7.5 (produto)

- Pergunta de qualidade de dado com pouca ponte para custo, perdas ou continuidade.
- Linguagem técnica (identidades, perímetro) para leitor não especializado.
- Prévia de compartilhamento genérica.
- Justificativa do avaliador: Transparente sobre lacunas e limites, com exportação por tabela. O valor social é indireto (confiança nos dados) e a linguagem é especializada, com prévia de link genérica.

### I, Visualizações: nota 7.5 (produto)

- Quatro regiões plotadas como linhas quase idênticas acrescentam pouco ao gráfico de horas com resíduo.
- Gráfico do Paraguai com eixo de 0,00 a 1,00 MWh: zero publicado e ausência não se distinguem visualmente.
- Série mensal termina em set/2026 parcial sem marca no ponto.
- Anotação '29/04/2023: MMGD' em 10 px.
- Justificativa do avaliador: Boa escolha nas barras por conta e na marca de quebra, mas gráficos de regiões redundantes, eixo vazio para o Paraguai e mês parcial sem marca reduzem a qualidade.

### A, Layout e hierarquia: nota 8.0 (produto)

- As quatro linhas de regiões do gráfico de horas com resíduo se sobrepõem quase por completo.
- O parágrafo Como interpretar é longo (lista de anos, sinais e tolerância) e a ressalva de causa aparece cinco vezes.
- KPIs em unidades diferentes (horas e MWh) com legendas de duas linhas.
- Nota de escopo 'Valores do SIN e do Sul e do intercâmbio internacional, fixos...' longa e abstrata abaixo dos KPIs.
- Justificativa do avaliador: Primeira tela clara e hierarquia boa, com marca de quebra metodológica. Rebaixada pela repetição da ressalva de causa, parágrafos longos e gráfico de regiões com linhas coladas.

### C, Utilidade: nota 8.0 (produto)

- Fechamento de contas é pergunta de qualidade do dado; o saldo entre regiões vive na página Circulação.
- Os resíduos de 2026 ficam sem causa informada pela fonte, e o leitor não sabe se o dado de 2026 é confiável.
- O exterior aparece só em gráficos mensais, sem a hora.
- Justificativa do avaliador: Atende bem o trecho de T8 sobre o exterior: exportação e importação por país e saldo. Fecha a conta de forma verificável, mas a pergunta central é de qualidade de dado e deixa o leitor sem orientação de uso dos resíduos.

### J, Navegação e interação: nota 8.0 (produto)

- O seletor País, no meio da página, leva a página ao topo ao clicar com o mouse (3.600 para 70).
- Barra de páginas e cartões 'Outras perguntas' repetem os mesmos links.
- Itaipu e identidades só aparecem ao trocar de profundidade.
- Justificativa do avaliador: Seletores bem ligados e estados de ausência claros. O salto ao topo no seletor de país, a duplicação de navegação e o conteúdo essencial de Itaipu só em Analisar limitam a nota.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Texto de 10 px nas marcas dos gráficos mensais.
- Tabelas de 14 e 16 colunas no Auditar exigem rolagem lateral no celular.
- Contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Boa base de acessibilidade, com texto explícito para ausência de dado e teclado sem perda de posição. Limites: texto de 10 px e falta de testes manuais de contraste e leitor de tela.

## `/rede/programado`

### D, Impacto social: nota 7.5 (produto)

- Alcance social indireto: não liga o desvio a custo, segurança ou continuidade.
- CSV com códigos de par (N_NE) e colunas técnicas sem dicionário.
- Prévia de compartilhamento genérica.
- Justificativa do avaliador: Transparente e útil a analistas e gestores, com exportação e recorte compartilhável. O impacto social é indireto e a linguagem e o CSV são técnicos.

### A, Layout e hierarquia: nota 8.0 (produto)

- Os cartões 2, 3 e 4 não repetem o nome da fronteira ou país, embora valham só para o par escolhido; só o primeiro cartão o cita.
- O aviso 'desvio não é falha' e 'a fonte não informa o motivo' aparece quatro vezes.
- Os quatro cartões usam cores de marcador sem significado entre si.
- Justificativa do avaliador: Página compacta, com hierarquia clara e limiar visível. A rotulagem incompleta dos KPIs e a repetição do aviso de desvio impedem uma nota mais alta.

### B, Didática: nota 8.0 (produto)

- 'Dia rotulado por programa repetido' e 'viés' exigem leitura atenta; faltam exemplos curtos.
- O porquê da medida fica recolhido; ONS e MWmed sem expansão no texto visível.
- Programa 'em módulo' e 'mediana do programa' misturam conceitos sem figura de apoio.
- Justificativa do avaliador: Didática boa: não trata desvio como falha, explica limiar e dia rotulado e declara limites. Faltam exemplos, siglas traduzidas e o porquê na abertura.

### C, Utilidade: nota 8.5 (produto)

- A lista dos maiores desvios no padrão 'todos os dias' traz as 5 linhas do mesmo dia rotulado (22/08/2026), pouco informativa.
- A ficha Comprove cobre só a base com todos os dias (avisado no texto).
- O histórico começa em 01/01/2026, e o programa não identifica revisão (declarado).
- Justificativa do avaliador: Atende bem a parte de T8 sobre programado e verificado, com seletores sincronizados e sensibilidade a dias suspeitos. A lista padrão dos maiores desvios fica dominada por um dia rotulado.

### I, Visualizações: nota 8.5 (produto)

- Rótulo truncado em 1440 px ('Nordeste → Sudeste/Centro-Oes…').
- Em 390 px o gráfico fica numa janela com altura limitada e exige 'Mostrar todas as 6'.
- Nomes de categoria cruzam a linha tracejada do limiar em 390 px.
- Justificativa do avaliador: Boa escolha de gráfico para distribuição de desvios, com limiar visível e tabela. Pequenos defeitos de rótulo truncado e janela limitada no celular.

### J, Navegação e interação: nota 8.5 (produto)

- Barra de páginas e cartões 'Outras perguntas' repetem os mesmos links.
- O seletor de pares começa com 4 de 4 e exige remover antes de trocar.
- KPIs, frase e lista seguem o par, mas o gráfico mensal tem seu próprio seletor sem ligação visível.
- Justificativa do avaliador: Sincronização e avisos de estado muito bons, inclusive sobre a ficha de prova. Descontos para navegação de família duplicada e dois seletores de pares independentes.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Tabelas de 14 colunas exigem rolagem lateral no celular.
- Janela limitada do gráfico em 390 px depende de um botão para ver todas as categorias.
- Contraste e leitor de tela não testados manualmente.
- Justificativa do avaliador: Acessibilidade sólida: axe limpo, teclado completo, sem texto minúsculo e sem transbordo até 320 px. Faltam testes manuais de contraste e leitor de tela; tabelas largas no celular.

## `/rede/restricoes`

### B, Didática: nota 7.5 (produto)

- Três dos oito fluxos, inclusive o segundo maior, não têm definição pública, e o leitor não consegue interpretá-los.
- O quadro 'evidência de limitação' mistura horas acima do limite (fluxos sistêmicos) e cortes de carga (perturbações), com causas e janelas diferentes.
- 'Submódulo 9.1' e 'banda morta de 50 MW ou 5%' sem explicação acessível.
- Por que importa e siglas recolhidos.
- Justificativa do avaliador: Honesta ao dizer o que não se conclui, mas o leitor fica sem entender siglas centrais e a moldura mistura duas medidas de natureza diferente. O porquê da medida está recolhido.

### D, Impacto social: nota 8.0 (produto)

- Sem recorte por UF ou cidade, embora os registros tragam UF.
- Leitor leigo não identifica o que significam as siglas dos fluxos.
- Prévia de compartilhamento genérica; CSV técnico.
- Justificativa do avaliador: Uma das páginas mais ligadas ao interesse público (continuidade), com lacuna de dado bem justificada e exportação. Falta recorte territorial fino e ajuda a leitores não técnicos.

### I, Visualizações: nota 8.0 (produto)

- Rótulos de categoria truncados e siglas com asterisco.
- Barras anuais sem anotação dos eventos que dominam (2009, 2020); a lista das maiores perturbações só aparece em Analisar.
- O ano parcial 2026 tem a mesma forma das barras completas.
- Justificativa do avaliador: Gráficos simples e adequados, com valores e avisos de ano parcial. Perdem por rótulos truncados, falta de anotação de eventos que dominam as barras e ano parcial sem tratamento visual.

### J, Navegação e interação: nota 8.0 (produto)

- Clicar na Região do gráfico de cortes leva a página ao topo (2.944 para 70).
- Barra de páginas e cartões 'Outras perguntas' duplicam navegação.
- Voltar ao fluxo padrão exige clicar de novo na mesma barra; não há botão 'limpar' nem aviso (a página Circulação tem o botão).
- Justificativa do avaliador: Seleção por clique e histórico bem resolvidos, com estados claros. O salto ao topo no seletor de região, a duplicação de navegação e a falta de limpar seleção limitam a nota.

### A, Layout e hierarquia: nota 8.5 (produto)

- O KPI 'Mais horas acima do limite' repete o cartão do fluxo escolhido (31,5 h de RSUL) logo abaixo, com duas fichas de prova.
- Três de oito rótulos são siglas sem definição (FBTA, FNS+NESE, FJUSC) marcadas com asterisco.
- Nome longo truncado no gráfico ('Fluxo da Interligação Nordeste-Sudeste/Centro-Oes…').
- Justificativa do avaliador: Página compacta e bem hierarquizada, com o estado de limite não público destacado. Pequenas repetições de KPI e rótulos de siglas e nomes truncados limitam a nota.

### C, Utilidade: nota 8.5 (produto)

- O ATLS termina em jul/2026 (três meses de defasagem), declarado só em O que mudou.
- Três siglas sem definição reduzem a utilidade para gestor.
- Sem saldo entre regiões na página; depende de Circulação.
- Justificativa do avaliador: Atende bem o trecho de T8 sobre restrições documentadas sem inferir congestionamento, com bloqueio honesto sobre limites. Utilidade reduzida por siglas indefinidas e pela defasagem do ATLS.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Nome truncado em 390 px ('Nordeste-Sudeste/Centro-Oes…').
- Contraste e leitor de tela não testados manualmente.
- Tabela de 13 colunas no Auditar exige rolagem lateral no celular.
- Justificativa do avaliador: Boa acessibilidade: axe limpo, teclado em todas as barras, sem texto minúsculo e gráfico legível em 390 px. Faltam testes manuais de contraste e leitor de tela.

## Achados que se repetem entre páginas

- (produto) Navegação de família inconsistente: as páginas-mãe (Carga e Rede) não mostram a barra de páginas irmãs no topo, só cartões 'Outras perguntas' a 2.516 e 1.985 px; as filhas mostram a barra e, na família Rede, repetem os mesmos links em cartões e em 'Próxima pergunta'.
- (produto) Salto ao topo: clicar com o mouse em três seletores do meio da página (mapa do pico em Perfil horário, País em Balanço e exterior, Região da energia não suprida em Restrições) leva a página ao topo (scrollY 2.692, 3.600 e 2.944 para 70); com teclado a posição é mantida.
- (produto) O porquê da medida e as siglas ficam recolhidos nas sete páginas no padrão Entender ('Por que isso importa' no fim, 'Fontes, datas e siglas' no alto): ONS, CCEE, PLD, MWmed e MMGD aparecem no texto visível sem expansão.
- (produto) A ficha 'Comprove este número' vale só para o recorte padrão e some ao trocar região, janela ou base (Carga e Clima) sem aviso; só Programado explica por que a ficha some.
- (produto) Rótulos de gráfico que colidem, truncam ou ficam em 10 px: eixo de barras sobreposto em 390 px e rótulos de hora colados em 1440 px (Rede), marcas de regime e rótulos anuais (Carga), nomes de fluxo (Restrições e Programado).
- (produto) Tabelas e mapa largos no celular escondem a coluna ou as horas principais sem pista de rolagem (Carga: Variação (%); Perfil horário: 18h e 19h); tabelas de 10 a 16 colunas exigem rolagem lateral.
- (produto) Jargão e identificadores internos no Analisar, no Auditar e na ficha de prova ('silver', 'bronze deste ambiente', nomes de campo e de arquivo, 'achado A06', 'código ...+alterado', nota de revisão editorial).
- (produto) Exportações CSV com cabeçalhos técnicos (par, liquido_mwh, canonico_mwh, sm, mmgd_estimada) sem dicionário no arquivo, e prévias de compartilhamento (og:title e og:description) iguais em todas as páginas, sem a pergunta nem o número.

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística por agente em Chromium headless contra http://localhost:3101 (commit cbb5fbfeb), sem pessoas. Não testei leitor de tela real, Firefox, Safari, toque físico, zoom de texto de 200% nem contraste manual além do axe do objetivo.json. O objetivo.json mediu 360, 390, 768 e 1440 px, sem 320 px; medi 320 px eu mesmo apenas por transbordo horizontal e leitura de capturas. Os trechos 02, 04 e 06 em 390 px e equivalentes não vinham no pacote; regenerei capturas e fatias para vê-los. Analisar e Auditar foram lidos por texto e por altura de página, sem exame visual de todos os gráficos. Não avaliei correção numérica, rastreabilidade nem desempenho (papel técnico); registrei só divergências visíveis e alguns cruzamentos de CSV com tabela. As interações alteraram apenas estado do navegador (URL e seletores); nada foi escrito no repositório.

