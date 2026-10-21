# Correções pedidas pelas avaliações independentes: unidade U10

Fonte: produto, tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote3/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/perdas` | 12 | 0 |
| `/perdas/composicao` | 12 | 1 |
| `/perdas/custo-e-contexto` | 12 | 2 |
| `/perdas/regulatorio` | 12 | 4 |

## `/perdas`

### F, Benchmarks e comparabilidade: nota 7.0 (tecnico)

- Sem limite ou referência regulatória por distribuidora: a comparação de perímetro compatível pedida na tarefa da família não existe.
- O valor oficial da ANEEL para 2025 (14,3%, 90,2 TWh) não aparece; a conferência da página usa a edição 2025/2024 e só para 2024.
- Grupo único de comparação, sem quartis, pares ou porte; mínimo, mediana e máximo são a única régua entre entidades.
- KPI de mediana (83 distribuidoras) ao lado do agregado (51 concessionárias), universos diferentes.
- Justificativa do avaliador: Rótulos de média, mediana e razão de somas, universo e cobertura são exemplares. Faltam referência regulatória, quartis e pares por porte, e a taxa de 2025 não é confrontada com o valor oficial da ANEEL (14,3% contra 14,75%), que usa outro denominador.

### J, Navegação e interação: nota 7.0 (produto)

- O primeiro clique em área não interativa, inclusive no mapa, joga a página ao topo; o painel da escolha fica a 3.174 px (1440) e 5.351 px (390) do topo.
- Resumo nacional, 'O que mudou' e 'Como interpretar' não acompanham período e medida.
- A tabela ordenada por taxa traz valores 'fora da comparação' no topo (2020: 11.480,35% e quatro outros).
- A página principal não tem a faixa de quatro abas das páginas irmãs; os atalhos ficam no meio da página.
- Três acessos a tabelas parecidas ('Dados do gráfico', 'Resumo em tabela', 'Ver a tabela completa').
- Justificativa do avaliador: Estado em URL, busca, comparação e exportação são fortes. O salto ao topo no primeiro clique, os blocos que não acompanham o recorte e a tabela com valores inválidos no topo impedem nota alta.

### A, Layout e hierarquia: nota 7.5 (produto)

- O mapa fica depois de cerca de 2.000 px de texto em 1440 e 4.400 px em 390.
- O bloco de três colunas 'O que mudou, Como interpretar, O que não é possível concluir' e as notas em 12 px dominam a leitura; o aviso de ano aberto aparece duas vezes seguidas.
- Vazio de cerca de 190 px à esquerda no painel de evolução em 1440; em 390 o título do gráfico fica colado ao aviso.
- Em 390 a legenda e os controles ocupam cerca de 480 px antes do mapa, que fica pequeno (356 px de largura).
- O último painel repete a abertura da página de composição.
- Justificativa do avaliador: Primeira tela boa e consistente, com números legíveis e celular íntegro. A resposta visual a 'onde' fica distante, há repetição de blocos e de avisos e vazios pontuais. Por isso a nota fica abaixo de 9.

### B, Didática: nota 7.5 (produto)

- Por que a medida importa (custo, tarifa) só está em bloco recolhido; a primeira tela não diz a consequência.
- Siglas e termos sem tradução no nível Entender: MMGD, SIGEL, BDGD, GDAL, BT.
- A explicação do denominador ('fornecida + irregular + perdas', 'energia injetada de referência') é densa para leitor leigo.
- As cinco perguntas da abertura só ficam completas depois de rolar até o fim do primeiro painel.
- Justificativa do avaliador: Abertura honesta e bem definida, com limites de leitura visíveis. Falta dizer logo o porquê e o custo, e há jargão de coleta e siglas sem tradução no nível básico.

### C, Utilidade: nota 7.5 (produto)

- Sem referência regulatória, a leitura 'acima ou abaixo da meta' não é possível (bloqueio externo documentado).
- Separação técnica e não técnica e custo ficam em outras páginas; aqui há só um resumo repetido.
- Resumo nacional e 'O que mudou' ficam em 2025 quando o leitor muda período ou medida.
- Em celular o toque no mapa leva a página ao topo e o resultado fica a 5.351 px do topo.
- Justificativa do avaliador: Cumpre bem a interpretação do denominador e a comparação entre distribuidoras, com exportação. A tarefa completa (referência regulatória, custo) depende de outras páginas e parte está bloqueada na fonte; o resumo fixo em 2025 reduz a utilidade na exploração.

### D, Impacto social: nota 7.5 (produto)

- A consequência para a tarifa e para quem consome não aparece na primeira tela.
- Sem leitura de desigualdade (renda, acesso) nesta página; ela está na página de custo.
- Linguagem técnica de coleta limita a compreensão por leitor não especializado.
- Justificativa do avaliador: Boa base territorial, exportação e transparência sobre lacunas. O impacto social (custo, desigualdade) está em outra página ou recolhido, e o leitor leigo encontra jargão. É potencial de impacto, não impacto comprovado.

### G, Rigor setorial: nota 7.5 (tecnico)

- Denominador de 2025: a página usa fornecida + irregular + perdas (612,7 TWh); a ANEEL usa a injetada publicada e divulga 14,3%. As frases de abertura dizem 'da energia que entrou na rede' para o denominador implícito.
- A linha Universo diz que a soma nacional usa as 51 concessionárias também em técnica e não técnica, cuja soma usa 18 em 2025 e 49 em 2010 (reproduzido com ?medida=pnt_bt e ?medida=tecnica).
- Técnica do SAMP descrita como percentual regulatório do processo tarifário; a ANEEL cita escalonamento anual pela STD e a Figura 7 difere do SAMP em mais de 0,8 p.p. em 5 de 18 distribuidoras.
- A coluna Fora da soma mostra sem dado onde nenhuma distribuidora foi excluída (2024 e 2025).
- Justificativa do avaliador: Denominadores, bases, ausência, cobertura e quebras são tratados com rigor, e os números reproduzem do arquivo oficial. O denominador de 2025 diverge do usado pela ANEEL sem confronto, a técnica é chamada de regulatória além do que a fonte sustenta e há texto de universo errado.

### I, Visualizações: nota 7.5 (produto)

- O selo do painel continua 'Calculado, Observado' ao escolher perdas técnicas ou não técnicas, que são estimadas.
- As classes mais claras do mapa (1,31:1 e 1,9:1) e a classe neutra da variação (1,31:1) quase somem no fundo branco.
- A paleta divergente da variação usa marrom avermelhado para queda da taxa, convenção pouco usual.
- A série nacional com eixo de 0 a 15% achata a variação de 14,00 a 15,85; a marca de 2024 usa 10 px.
- Em 390 o mapa tem 356 px de largura para milhares de municípios.
- Justificativa do avaliador: Escolhas de gráfico adequadas e honestas, com ausência tratada à parte e alternativas por tabela e teclado. Pesam o selo de natureza fixo, o contraste fraco das classes claras, a paleta divergente incomum e o mapa pequeno no celular.

### K, Acessibilidade e responsividade: nota 7.5 (produto)

- O primeiro clique em conteúdo move o foco para main e rola ao topo (main com tabindex -1).
- 71 alvos abaixo de 44 px em Auditar no celular; notas e rótulos em 10 a 12 px.
- Classes claras do mapa com contraste de objeto gráfico abaixo de 3:1.
- O mapa só opera por teclado pela busca; leitor de tela real não foi testado.
- Em 320 px a trilha de navegação trunca o nome da página ('Perda...'), embora o H1 o repita.
- Justificativa do avaliador: Base de acessibilidade sólida: axe limpo, teclado e foco bons, movimento reduzido respeitado. Descontos pelo salto de foco ao topo, alvos pequenos no celular em Auditar, contraste das classes claras e ausência de teste com leitor de tela.

### E, Profundidade: nota 8.0 (tecnico)

- Sem referência regulatória por distribuidora (percentual técnico homologado ou não técnico), item exigido pela família; a Figura 7 do relatório ANEEL 2026/2025 traz o técnico de 2025 das 51 concessionárias e não é usada.
- A distribuição se resume a faixas, mediana e extremos de um grupo que mistura 51 concessionárias e 32 permissionárias muito pequenas; sem quartis nem grupos por porte.
- Não há evolução da dispersão (mediana ou faixas por ano); a série mostra só o agregado das concessionárias.
- Justificativa do avaliador: Cobre nível, evolução, distribuição, composição, território, cobertura e limitações, com números conferidos. Falta a referência regulatória compatível exigida pela família, e a distribuição fica em faixas, mediana e extremos de um grupo misto, sem quartis nem grupos por porte.

### L, Confiabilidade técnica: nota 8.0 (tecnico)

- HTML de 582 KB e 1,9 MB de dados também em 390 px, perto do orçamento.
- Medida só de laboratório, sem limitação de rede ou CPU e sem dado de campo.
- Os testes não pegam a linha de universo errada nem comparam a taxa de 2025 com a ANEEL.
- Justificativa do avaliador: Sem erros de console ou rede, boa cobertura de testes e bloqueio de gold inválida. Peso perto da meta, medida só de laboratório e um texto de universo errado que os testes não pegam mantêm a nota abaixo de 9.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código de publicação com alterações fora de commit; a reprodução oficial depende de silver e bronze não publicados.
- A ficha do KPI principal não traz reconciliação por outro caminho; a conferência externa existente é de 2024 e da edição anterior do relatório ANEEL, por cópia de terceiro, enquanto a edição 2026/2025 circula desde julho.
- As fichas mostram 14,7%, 14,8% e 15,0% onde os KPIs mostram 14,75%, 14,77% e 14,99%.
- A linha Universo contradiz o dado em técnica e não técnica (51 contra 18).
- O documento do módulo ainda trata como pendente a limitação 'cerca de metade', que a gold já traz com contagens.
- Justificativa do avaliador: Rastreabilidade forte: sha256 que confere com a ANEEL, mensal idêntico ao bruto, fichas com fórmula e passos, paridade entre tabela, CSV, XLSX e JSON. Perde pelo código com árvore suja, pela reprodução que exige arquivos não públicos e pela conferência externa desatualizada.

## `/perdas/composicao`

### Bloqueios

- (produto) {"tipo": "divergência entre gráfico, tabela e exportação", "descricao": "NEOENERGIA BRASÍLIA aparece com perdas totais de 14,22 no gráfico (rótulo desenhado, aria-label e 'Dados do gráfico em tabela') e 14,23 na tabela completa e no CSV; COSERN, 10,45 contra 10,44. A diferença é de 0,01 p.p., por arredondamento da soma dos componentes, e esta página não traz nota explicativa (a página de custo traz).", "evidencia": "Playwright 1440 em /setor-eletrico/perdas/composicao: rótulo SVG, aria-label, tabela completa e CSV perdas-composicao-2025_completo baixado em 2026-10-09."}

### C, Utilidade: nota 7.0 (produto)

- Cobre 32,6% da energia em 2025; o agregado na mesma base não é mostrado (exige subtração).
- Sem referência regulatória de não técnicas para situar cada barra.
- A linha de 14,75% é de outro conjunto (51 concessionárias) e a dica calcula 'Diferença' contra ela.
- O filtro 'Decomposição' tem uma só opção e há colunas constantes na tabela.
- Justificativa do avaliador: Atende a separação com honestidade sobre a cobertura e traz série comparável. Cobertura baixa, falta do agregado na mesma base e de referência regulatória limitam o uso para decisão.

### D, Impacto social: nota 7.0 (produto)

- Sem recorte territorial ou por UF nem custo para o consumidor nesta página.
- O efeito da perda não técnica na tarifa fica em outra página.
- Quem paga não é dito na primeira tela.
- Justificativa do avaliador: Boa cautela editorial e visibilidade da lacuna, mas pouco recorte social, território ou custo nesta página. É potencial de impacto, não impacto comprovado.

### F, Benchmarks e comparabilidade: nota 7.0 (tecnico)

- Sem referência regulatória nem oficial para a composição, embora a ANEEL publique a técnica regulatória por concessionária (Figura 7) e a não técnica ponderada (Figura 10).
- Linha do agregado de outro conjunto sobre barras de 19 distribuidoras, útil só com a leitura do aviso.
- A técnica do SAMP é lida como se fosse a regulatória, mas difere da Figura 7 em mais de 0,8 p.p. em 5 de 18.
- Ordenação e extremos sem pares por porte.
- Justificativa do avaliador: Boa disciplina de denominadores, universo e cobertura, e série de universo fixo para a tendência. Falta referência regulatória e nacional oficial da composição, a linha do agregado é de outro conjunto e a técnica do SAMP difere da regulatória de 2025 em mais de 0,8 p.p. em 5 de 18.

### I, Visualizações: nota 7.0 (produto)

- O rótulo desenhado difere da tabela em 2 de 19 linhas (0,01 p.p.), sem nota nesta página.
- Rótulos de valor sob a linha tracejada; segmentos sem valor.
- O padrão esconde 8 de 19 barras, inclusive as duas negativas; após a tecla End o aviso 'mostra só parte' continua.
- A linha de referência é de outro conjunto, mas a dica calcula a diferença contra ela.
- Dois gráficos de linha lado a lado com escalas e bases diferentes (0 a 8 e 0 a 20).
- Justificativa do avaliador: Escolhas corretas e transparentes, com marca de quebra e alternativas. Divergência de arredondamento sem nota, rótulos sob a referência, barras ocultas e referência de outro conjunto limitam a nota.

### A, Layout e hierarquia: nota 7.5 (produto)

- Rótulos de valor cruzados pela linha tracejada em 320, 390 e 1440.
- Eixo começa em menos 10 sem barra negativa visível por padrão, o que desperdiça largura.
- Segmentos de técnica e não técnica sem rótulo; só o total aparece.
- Dois KPIs em bases diferentes e parágrafo de aviso ocupam a primeira tela.
- Duas tabelas para os mesmos 19 itens ('Dados do gráfico' e 'Ver a tabela completa').
- Justificativa do avaliador: Página enxuta e bem hierarquizada, com celular íntegro. Rótulos sob a linha de referência, eixo com folga inútil, segmentos sem valor e tabelas duplicadas reduzem a leitura.

### B, Didática: nota 7.5 (produto)

- A resposta à pergunta do título são duas porcentagens de bases diferentes que 'não se somam'; a divisão na mesma base não aparece.
- Perda não técnica negativa aparece sem explicação junto ao gráfico.
- 'Por que isso importa' recolhido; 'mercado de baixa tensão' e 'leiaute novo' sem tradução imediata.
- A série de não técnicas só começa em 2010, sem nota no gráfico.
- Justificativa do avaliador: Conceitos bem definidos e ressalvas claras. O leitor leigo não vê a divisão na mesma base e encontra valores negativos sem explicação; o porquê fica recolhido.

### E, Profundidade: nota 7.5 (tecnico)

- A separação existe para só 18 a 19 distribuidoras (cerca de 32% da energia), sem a composição nacional oficial da ANEEL como referência nem por região.
- Sem referência regulatória para a parcela técnica (percentual homologado) nem para a não técnica.
- A tendência vem de 16 concessionárias que seguem publicando a separação, em geral grandes, e a página não descreve o perfil do grupo além da cobertura do mercado BT (32%).
- O histórico por distribuidora só existe para as que publicam a separação.
- Justificativa do avaliador: Composição bem delimitada, com universo fixo, cobertura por ano e bases corretas. O alcance é de 19 distribuidoras, sem referência regulatória nem a composição nacional oficial da ANEEL, e a tendência vem de 16 concessionárias que continuam publicando a separação.

### G, Rigor setorial: nota 7.5 (tecnico)

- A técnica do SAMP é chamada de percentual regulatório aplicado; a ANEEL fala em escalonamento e a Figura 7 difere em mais de 0,8 p.p. em 5 de 18 (COSERN 9,2% contra 7,36%). A não técnica, residual, herda a diferença.
- O KPI diz que 18 de 51 publicaram a técnica nos 12 meses; foram 19, e uma saiu por decomposição que não fecha.
- O total no fim da barra soma componentes arredondados e destoa da tabela em 2 de 19, sem aviso (a página de custo explica o mesmo efeito).
- O denominador de injetada de referência (ver /perdas) é usado sem confronto com o valor oficial.
- Justificativa do avaliador: Bases e fechamento da decomposição estão corretos e reproduzem do bruto. A técnica é tratada como regulatória além do que a ANEEL descreve, o KPI conta 18 onde 19 publicaram, e os rótulos das barras somam parcelas arredondadas sem aviso.

### J, Navegação e interação: nota 7.5 (produto)

- O primeiro clique em conteúdo rola a página ao topo.
- Dois caminhos para a mesma tabela ('Dados do gráfico' e 'Ver a tabela completa').
- Após a tecla End o gráfico mostra tudo, mas o texto e o botão seguem dizendo 'mostra só parte'.
- Filtro e colunas sem função, porque todas as linhas fecham.
- Justificativa do avaliador: Interação previsível e com estado em URL. Salto ao topo no primeiro clique, tabelas duplicadas, filtro sem função e mensagem de estado desatualizada mantêm a nota abaixo de 9.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- O primeiro clique em conteúdo rola ao topo e põe o foco em main.
- Rótulos cruzados pela linha tracejada reduzem a leitura em 320 e 390.
- Leitor de tela real não testado; nós de contraste 'incompleto' no axe.
- Notas e anotações em 10 a 12 px.
- Justificativa do avaliador: Boa acessibilidade medida: axe limpo, teclado completo e sem rolagem horizontal. O salto de foco ao topo, os rótulos cruzados e a falta de teste com leitor de tela impedem 9.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código com alterações fora de commit na ficha; a reprodução oficial depende de arquivos não públicos.
- Diferença de 0,01 p.p. entre rótulo da barra e tabela principal, sem nota nesta página.
- Conferência externa só de 2024 e da edição anterior; não confronta a técnica com a Figura 7 do relatório 2026/2025.
- Justificativa do avaliador: Os valores reproduzem do arquivo bruto e a paridade com CSV e XLSX é total. Mantêm a nota abaixo de 9 o código publicado com árvore suja, a conferência externa desatualizada e rótulos de barra que somam parcelas arredondadas.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Medida só de laboratório, sem dado de campo.
- A tolerância do teste esconde a divergência de rótulo de 0,01 p.p.
- Justificativa do avaliador: Página leve, sem erros, com testes de composição e universo fixo. Medida só de laboratório e tolerância de teste que deixa passar a divergência de 0,01 p.p. nos rótulos mantêm a nota abaixo de 9.

## `/perdas/custo-e-contexto`

### Bloqueios

- (produto) {"tipo": "divergência entre gráfico, tabela e exportação", "descricao": "O total na ponta da barra difere da coluna 'Perdas' da tabela em 23 de 80 distribuidoras (até 0,01 R$/MWh): CERPRO tem 14,64 na barra e 14,65 na tabela, no CSV e na frase de abertura. A página explica por arredondamento em nota, mas mantém dois valores para o mesmo item.", "evidencia": "texto_entender.txt linhas 21 e 33; captura própria do gráfico expandido (CERPRO 14,64); CSV perdas-custo-tarifa-b1_completo (14.65)."}
- (tecnico) {"tipo": "ressalva essencial escondida", "descricao": "A coluna 'Tarifa B1 (TUSD + TE)', 'Perdas na tarifa (%)', o gráfico e as frases usam a Base Econômica do arquivo de componentes, que a ANEEL define como 'estritamente para cálculo tarifário', e não a Tarifa de Aplicação, que é a faturada. A base só é nomeada dentro da gaveta Sobre este dado. A tarifa da página difere da aplicada em mais de 5% em 44 de 84 processos, até 87%, e muda os extremos (ÂMBAR AMAZONAS 254,57 R$/MWh e 29,07% na aplicação, 192,66 e 22,01% na página).", "evidencia": "Arquivo oficial componentes-tarifarias-2026 (baixado em 09/10/2026) e perdas_tarifa_b1.csv: Base Econômica e Tarifa de Aplicação por processo; dicionário dm-componentes-tarifarias.pdf, campo DscBaseTarifaria; filtro 'base econômica' em pipeline/energia/modulos/perdas.py e na gaveta da página."}

### F, Benchmarks e comparabilidade: nota 6.0 (tecnico)

- Tarifa e participação calculadas sobre a Base Econômica, que a ANEEL define como de uso estritamente tarifário; a base não é nomeada junto do número.
- Mínimo e máximo como única referência; sem mediana, quartis ou pares por tipo e porte.
- A tabela mistura processos de 2014 e 2026 na mesma ordenação por valor nominal.
- Nenhuma referência regulatória (por exemplo a participação das não técnicas nas tarifas residenciais, Figura 16 da ANEEL) para situar os valores.
- Justificativa do avaliador: A comparação entre distribuidoras é coerente no mesmo critério, mas a régua usa a base econômica sem nomeá-la, só há mínimo e máximo, a tabela mistura processos de 2014 e 2026 e não há referência regulatória para situar os valores.

### G, Rigor setorial: nota 6.5 (tecnico)

- A Base Econômica é apresentada como 'Tarifa B1'; coluna, gráfico e frases não a nomeiam (só a gaveta Sobre este dado), e a tarifa faturada difere em mais de 5% em 44 de 84 processos.
- Zero de não técnicas em 27 distribuidoras sem aviso; possível agregação das perdas totais na componente técnica das permissionárias (não verificado em fonte primária).
- As perdas somam distribuição e Rede Básica sob a pergunta de perdas na distribuição, o que é dito só na legenda.
- A área por município inteiro atribui a população de São Paulo à CERIS.
- Justificativa do avaliador: Os componentes e a vigência reproduzem do arquivo oficial. A tarifa e a participação usam a base econômica, de cálculo e não faturada, sem rotulá-la, com diferença de até 87%, e o zero de não técnicas em permissionárias não é explicado. Isso derruba a precisão setorial.

### B, Didática: nota 7.0 (produto)

- B1, TUSD, TE, Rede Básica e 'processo tarifário' sem explicação no ponto de uso.
- Perda não técnica acima de 100% do mercado de baixa tensão (eixo até 150) sem explicação.
- Nota de bloqueio com linguagem de operação.
- 'Por que isso importa' recolhido.
- Justificativa do avaliador: Boa distinção entre tarifa e custo e cautela sobre causalidade. Termos tarifários sem tradução e nota operacional no nível básico dificultam o leitor leigo.

### C, Utilidade: nota 7.0 (produto)

- O custo total em reais não está disponível (bloqueio externo documentado).
- Sem mediana ou faixa típica, e a ordenação em R$/MWh reflete o nível da tarifa.
- Concessionárias e cooperativas no mesmo ranking, sem marca de tipo e com componentes zero sem explicação.
- 23 distribuidoras ativas sem tarifa vigente ficam fora do gráfico.
- Justificativa do avaliador: Atende o custo unitário e o contexto de renda com limites claros. Falta custo total, tendência central e distinção de tipo, e o ranking em R$/MWh mistura estruturas tarifárias diferentes.

### E, Profundidade: nota 7.0 (tecnico)

- Custo total reconhecido em reais indisponível; a ANEEL publica totais nacionais e a glosa por distribuidora de grande porte (Figuras 14 e 15) que não aparecem.
- Sem história do componente por processo na página (só no CSV) e sem distribuição (mediana, quartis) do custo entre distribuidoras.
- Sem referência regulatória (percentual) para ler o peso das perdas na tarifa.
- Contexto por município inteiro atribui 11,7 milhões de habitantes à CERIS (24,7 GWh de injetada), que a tabela ordenada por população põe em 4º.
- Justificativa do avaliador: Cobre nível, composição, contexto social e território com valores que reproduzem. Faltam o custo total em reais, a história e a distribuição do custo e uma referência regulatória, e a leitura territorial por município inteiro distorce áreas pequenas.

### J, Navegação e interação: nota 7.0 (produto)

- A frase e a ficha 'Comprove' da dispersão não acompanham o eixo escolhido (52 e menos 0,606 contra 46 e menos 0,377).
- A tabela padrão mistura um processo encerrado de 2014 entre os vigentes.
- O primeiro clique em conteúdo rola ao topo.
- Dois caminhos para tabelas (dados do gráfico e tabela completa).
- Justificativa do avaliador: Alternância e filtros funcionam com estado em URL. Frase e ficha de prova desatualizadas após trocar o eixo, tabela que mistura vigências e salto ao topo no primeiro clique mantêm a nota baixa.

### A, Layout e hierarquia: nota 7.5 (produto)

- O lead promete % da tarifa, mas a participação só está na tabela e no nível Analisar.
- O gráfico padrão mostra só as 11 maiores de 80; o mínimo citado na frase (CERPRO) não aparece.
- A dispersão tem pontos cinza sem rótulo nem destaque dos extremos.
- O rótulo 'O que mudou' abriga nota de cobertura, não mudança.
- Nota de dependência em linguagem operacional ('acesso automatizado aos endereços tentados').
- Justificativa do avaliador: Primeira tela objetiva e coerente com a pergunta. A promessa de % da tarifa não se cumpre no gráfico, o padrão exibe só o topo e a dispersão não identifica pontos, o que reduz a leitura.

### D, Impacto social: nota 7.5 (produto)

- Sem custo total em reais nem efeito para um consumidor típico.
- O contexto social usa renda média de município, que esconde desigualdade interna (dito no texto).
- Não há exemplo de leitura para o consumidor.
- Justificativa do avaliador: É a página de maior relevância social do módulo: custo na tarifa, renda e lacunas explícitas, com cautela sobre causa. Falta custo total e exemplo para o consumidor. Potencial de impacto, não impacto comprovado.

### H, Rastreabilidade: nota 7.5 (tecnico)

- A base da tarifa só está na gaveta, sem definição, e o rótulo da coluna leva a procurar a tarifa homologada, que não bate.
- Código d329b83c69a5+alterado e reprodução que depende de arquivos não públicos.
- A conferência com o relatório da ANEEL não cobre custo nem tarifa.
- Justificativa do avaliador: Os valores reproduzem do arquivo oficial e as fichas são completas. A base econômica da tarifa só aparece numa gaveta, sem definição, sob um rótulo que sugere a tarifa homologada, e o código publicado tem árvore suja.

### I, Visualizações: nota 7.5 (produto)

- O total da barra difere da tabela e da frase em 23 de 80 linhas (0,01), explicado em nota.
- O padrão exibe 11 de 80 barras, sem tipo da distribuidora nem explicação dos componentes zero.
- Pontos da dispersão anônimos, sem destaque de extremos.
- O título do eixo x perde a unidade em 320 e 390 px.
- O eixo vertical de menos 50 a 150 na opção não técnicas comprime a maioria dos pontos.
- Justificativa do avaliador: Gráficos adequados e honestos, sem curva inventada e com alternativas. Pesam a divergência de arredondamento entre barra e tabela, pontos anônimos, unidade do eixo cortada no celular e o padrão que mostra só as 11 maiores.

### K, Acessibilidade e responsividade: nota 7.5 (produto)

- O primeiro clique em conteúdo rola ao topo e põe o foco em main.
- 39 a 43 alvos abaixo de 44 px em Auditar.
- O título do eixo x é cortado com reticências em 320 e 390 e perde a unidade.
- Leitor de tela real não testado; contraste de nós de gráfico 'incompleto' no axe.
- Justificativa do avaliador: Acessibilidade medida boa, sem violações no axe e com teclado completo. Salto de foco no primeiro clique, alvos pequenos em Auditar, unidade do eixo cortada no celular e ausência de leitor de tela real mantêm a nota.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Medida só de laboratório.
- Os testes validam a soma e a vigência, não a semântica da base tarifária nem o zero de não técnicas.
- Justificativa do avaliador: Página sem erros de console ou rede, peso dentro da meta e testes de soma e vigência. Medida só de laboratório e testes que não cobrem a base tarifária mantêm abaixo de 9.

## `/perdas/regulatorio`

### Bloqueios

- (produto) {"tipo": "barreira em tarefa essencial", "descricao": "A comparação de distribuidoras com a referência regulatória, parte essencial da tarefa da família, não pode ser feita nesta publicação: realizado contra regulatório de não técnicas aparece como 'Indisponível nesta publicação' (acesso à ANEEL recusado em 30/09/2026) e, para técnicas, 'Não se aplica' por construção. O site documenta o bloqueio externo e não mostra valor de reserva, mas a página segue incompleta para a tarefa.", "evidencia": "texto_entender.txt linhas 46 a 51; texto_auditar.txt, bloco 'Bloqueios externos'."}
- (tecnico) {"tipo": "valor incorreto", "descricao": "A frase da distribuidora escolhida informa variação errada em 7 de 49: EQUATORIAL PA '+0,202 p.p. (trecho anterior 12,662%)' para 11,648%, real −1,014; CERTAJA −0,640 contra −5,580; ERO 0,000 contra −1,590; CERFOX +1,010 com os dois trechos em 4,000%; ÂMBAR AMAZONAS +0,020 com os dois em 7,770%; CEEE-D −0,005 contra +0,766; ELEKTRO 0,000 contra −0,142.", "evidencia": "Playwright contra http://localhost:3101/setor-eletrico/perdas/regulatorio?d=<cnpj>, elemento [data-resposta=regulatorio-distribuidora], 7 casos lidos. Causa em PerdasRegulatorio.tsx (linhas 108 a 111): usa troca_pp, contra trecho curto ou mês anterior, junto de anterior, o trecho de referência."}
- (tecnico) {"tipo": "divergência entre gráfico, tabela e exportação", "descricao": "A diferença do gráfico (trecho mais recente menos o anterior de referência) não é a coluna 'Troca contra o trecho anterior' da tabela e do CSV exportado: 14 de 49 divergem (7 com valores diferentes, como EQUATORIAL PA −1,014 contra +0,202, e 7 'sem dado' no gráfico com número na tabela, como ENEL CE −1,648). A tabela traz ainda −49,709 p.p. na CERFOX.", "evidencia": "perdas_tecnicas_regulatorias.csv (classe referencia) comparado com o texto do gráfico e com o CSV exportado da tabela (111 linhas); PerdasRegulatorio.tsx usa l.anterior no gráfico e s.troca_pp na tabela."}
- (tecnico) {"tipo": "barreira em tarefa essencial", "descricao": "Comparar distribuidoras com referência regulatória de perímetro compatível, parte da tarefa da unidade, não é possível: técnica 'não se aplica' e não técnica 'indisponível'. A página explica com tentativas e datas, mas a rubrica não aceita a explicação no lugar da entrega; há fonte pública parcial (relatório ANEEL 2026/2025, Figuras 7, 8, 10 e 16) que a página não usa.", "evidencia": "Reproduzi o bloqueio em 09/10/2026: 403 com cf-mitigated em git.aneel.gov.br, www2.aneel.gov.br e calculostarifarios; conexão encerrada em portalrelatorios. O CKAN da ANEEL não tem conjunto de perdas regulatórias (a busca 'perdas' devolve SAMP, Subsídios e BDGD). Relatório 2026/2025 lido em cópia hospedada, sha256 eca8f00b..."}

### F, Benchmarks e comparabilidade: nota 5.5 (tecnico)

- Sem limite ou percentual regulatório (técnico homologado ou não técnico) para comparar.
- Duas definições de 'trecho anterior' (gráfico e tabela) com resultado diferente em 14 de 49.
- Ranking e faixa misturam eras e entidades (cooperativas com percentuais redondos) e rotulam como regulatório o que não coincide com a Figura 7.
- A diferença é apresentada como mudança entre processos tarifários mesmo entre trechos separados por vários anos ou sem REH (39 de 49).
- Justificativa do avaliador: É honesta sobre a referência usada (trecho anterior da própria distribuidora), mas não tem limite regulatório, tem duas definições de anterior que divergem em 14 de 49, mistura eras no ranking e rotula como regulatória uma faixa de 1% a 20,4%, contra 3,7% a 11,8% oficiais.

### G, Rigor setorial: nota 5.5 (tecnico)

- Frase da distribuidora escolhida com variação aritmeticamente errada em 7 de 49 (valor e sinal): mistura a troca contra trecho curto com o percentual do trecho de referência anterior.
- Afirma que a técnica realizada contra a regulatória daria zero por construção; a diferença para o regulatório de 2025 passa de 0,8 p.p. em 5 de 18.
- Rotula como regulatório o valor escalonado do SAMP e o apresenta como mudança de parâmetro entre processos.
- A primeira troca de cada série é calculada contra a razão do mês anterior e chamada de troca contra o trecho anterior (ENEL CE −1,648; CERFOX −49,709).
- Justificativa do avaliador: Erro aritmético verificado nas frases de 7 distribuidoras, afirmação de igualdade 'por construção' que a Figura 7 contradiz em vários casos e rótulo regulatório para um valor escalonado pela STD. A inferência por trechos, porém, reproduz do bruto e é marcada como estimada.

### C, Utilidade: nota 6.0 (produto)

- A tarefa de comparar distribuidoras com referência regulatória não é atendida: a referência de não técnicas está indisponível (bloqueio externo).
- O percentual técnico é inferido, não lido do ato, e cobre 49 de 123 distribuidoras.
- Sem síntese 'quantas subiram, caíram ou ficaram iguais', que o gráfico permitiria.
- Poucas decisões possíveis a partir da mudança de um parâmetro inferido.
- Justificativa do avaliador: Honesta, mas a tarefa essencial (comparar com referência regulatória de perímetro compatível) não pode ser feita. Sobra a descrição da mudança de um parâmetro inferido, sem síntese e sem uso claro para decisão.

### D, Impacto social: nota 6.0 (produto)

- Sem custo, território ou desigualdade na página.
- O impacto do tema (quanto a tarifa reconhece) fica em bloco recolhido e sem dados.
- Pouca utilidade para consumidor e conselho sem a referência regulatória.
- Justificativa do avaliador: Pouca relevância social na forma atual, sem custo, território ou referência regulatória. Registra a lacuna com transparência. O potencial depende do dado bloqueado.

### E, Profundidade: nota 6.0 (tecnico)

- Falta a dimensão central da página, a referência regulatória compatível (técnica homologada e não técnica), em parte pública no relatório ANEEL 2026/2025.
- Metade dos 'trechos mais recentes' é anterior a 2024 e não mostra o valor atual: CEMIG-D 8,014% de 2023 contra 7,2% oficial de 2025.
- Cobre 49 de 123 distribuidoras; 22 só têm trechos curtos.
- Não relaciona o percentual ao custo por distribuidora na mesma tela (só link).
- Justificativa do avaliador: Mostra a evolução por trecho e declara bem o que não compara, mas falta a referência regulatória que dá nome à página, metade dos trechos mais recentes é anterior a 2024 e só 49 de 123 distribuidoras entram. O painel fica funcional, com lacuna central.

### H, Rastreabilidade: nota 6.0 (tecnico)

- Gráfico, tabela e frase usam definições diferentes de 'trecho anterior' e divergem em 14 de 49.
- Frase com variação errada em 7 de 49.
- Ficha com código de árvore suja; reprodução depende de arquivos não públicos.
- A conferência externa se limita ao relatório 2025/2024 (cópia de terceiro) e não usa a Figura 7 de 2026/2025.
- Justificativa do avaliador: Os trechos reproduzem do arquivo bruto e há ficha, CSV e bloqueio documentados. A coerência entre gráfico, tabela e frase falha em 14 de 49 distribuidoras e a frase está errada em 7, o que pesa mais que a documentação.

### B, Didática: nota 6.5 (produto)

- Os conceitos de trecho, razão constante e inferência só são explicados depois do gráfico.
- Não há exemplo de leitura de uma linha (círculo, losango, diferença).
- 'Por que isso importa' recolhido, sem custo ou consequência na tarifa na primeira tela.
- 'Leiaute' e 'resolução homologatória' sem tradução.
- A abertura não responde 'como mudou'.
- Justificativa do avaliador: Honesta quanto a limites, mas conceitos centrais (trecho, inferência) chegam tarde e a pergunta do título não é respondida na abertura. O leitor leigo teria dificuldade de usar o gráfico sem leitura prévia.

### A, Layout e hierarquia: nota 7.0 (produto)

- A primeira tela não traz o achado (quantas subiram, caíram ou ficaram iguais); a frase descreve o gráfico.
- O padrão mostra 12 de 49 linhas, 2 delas sem dado.
- Legenda e escala comprimidas em uma linha acima do gráfico.
- 'O que mudou' trata de coincidência com resoluções, não do que mudou.
- A tabela de 111 linhas fica atrás de outro botão, sem relação visual com o gráfico.
- Justificativa do avaliador: Layout limpo e honesto sobre limites, com celular íntegro. A primeira tela não responde à pergunta do título e o gráfico traz muitas linhas sem diferença calculável, o que enfraquece a hierarquia de informação.

### L, Confiabilidade técnica: nota 7.0 (tecnico)

- Cálculo textual errado em 7 de 49 (defeito de interação ao escolher a distribuidora).
- Os testes não cobrem a frase por distribuidora nem a coerência entre gráfico e tabela.
- Medida só de laboratório.
- Justificativa do avaliador: Leve e sem erros de console, mas a interação de escolher a distribuidora gera frases com cálculo errado em 7 de 49, e os testes não pegam isso nem a divergência entre gráfico e tabela. Medida só de laboratório.

### I, Visualizações: nota 7.5 (produto)

- O padrão mostra 12 de 49 linhas, ordenadas pelo percentual do trecho mais recente.
- Os 13 pontos sem mudança se sobrepõem (círculo dentro de losango).
- A série mensal usa eixo ajustado ao intervalo, o que amplia mudanças mínimas.
- Legenda e escala comprimidas em uma linha.
- Justificativa do avaliador: Boa escolha de gráfico, honesto com ausências e acessível. Poucas linhas por padrão, sobreposição de pontos iguais e eixo ajustado na série mensal reduzem a nota.

### J, Navegação e interação: nota 7.5 (produto)

- A ordem escolhida não vai para a URL nem para o link copiado.
- O primeiro clique em conteúdo rola ao topo.
- Duas tabelas (dados do gráfico e 111 trechos).
- Sem comparação de entidades lado a lado.
- Justificativa do avaliador: Controles claros e estados bloqueados bem nomeados. Ordem fora da URL, salto ao topo, tabelas duplicadas e falta de comparação lado a lado mantêm a nota abaixo de 9.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- O primeiro clique em conteúdo rola ao topo e põe o foco em main.
- Losango e círculo cobrem pontos iguais; sem teste com leitor de tela.
- 116 nós de contraste 'incompleto' no axe.
- Rótulos de 10 a 12 px.
- Justificativa do avaliador: Boa acessibilidade medida e rótulos descritivos nos pontos. O salto de foco ao topo, a falta de teste com leitor de tela e nós de contraste não conclusivos impedem 9.

## Achados que se repetem entre páginas

- (produto) Salto ao topo no primeiro clique ou toque em área não interativa: main#conteudo tem tabindex -1 e a página vai de scrollY 1.400 para 70 nas quatro páginas (e em conta-de-luz); no mapa de perdas, de 2.098 para 70 em 1440 e de 4.165 para 25 em 390.
- (produto) Blocos de resposta que não acompanham o recorte: no mapa de perdas, a frase de 14,75%, 'O que mudou' e 'Como interpretar' ficam em 2025; na dispersão de custo, a frase e a ficha 'Comprove' ficam com 52 concessionárias e menos 0,606 após escolher 'Não técnicas'.
- (produto) Divergência de 0,01 entre rótulo do gráfico e tabela: composição (NEOENERGIA BRASÍLIA 14,22 e 14,23; COSERN 10,45 e 10,44), sem nota; custo (23 de 80, CERPRO 14,64 e 14,65), com nota.
- (produto) Jargão e códigos internos no texto público: SIGEL, BDGD, GDAL, MMGD, BT, TUSD, TE, REH, B1 e a nota 'liberação de acesso automatizado aos endereços tentados' em Entender; P055, P057, P058, S5, S6 e vigencia_encerrada em Auditar.
- (produto) Fichas 'Comprove este número' das páginas de perdas e de composição trazem 'Valor exibido' em uma casa (14,7%; 14,8%; 15,0%) enquanto a página mostra duas (14,75%; 14,77%; 14,99%).
- (produto) Acessos repetidos às tabelas ('Dados do gráfico em tabela', 'Resumo em tabela', 'Ver a tabela completa') e o mesmo bloco de três colunas em todos os painéis, além de dois avisos de ano aberto seguidos.
- (produto) Gráficos longos abrem só com o topo (11 de 19, 11 de 80, 12 de 49) e a frase de abertura cita extremos que não aparecem (CERPRO); tabelas abrem com linhas não comparáveis ou encerradas no topo (perdas em 2020, CERR em custo).
- (produto) Rótulos e títulos de eixo perdem legibilidade em telas estreitas: valores cruzados pela linha tracejada (composição) e título do eixo x truncado, sem a unidade (custo, 320 e 390); anotações do gráfico em 10 px.
- (tecnico) Denominador de 2025: a página usa a injetada de referência (612,7 TWh) e a ANEEL, no relatório 2026/2025, a injetada publicada (cerca de 632 TWh): 14,75% contra 14,3% oficial. A conferência das páginas usa a edição 2025/2024, por cópia de terceiro, e só para 2024.
- (tecnico) Nenhuma página traz referência regulatória: o percentual técnico homologado de 2025 por concessionária (Figura 7), a não técnica real e regulatória ponderada (16,2% e 11,2% do BT) e por UF (Figuras 8 e 10) estão públicos em figuras e não são usados.
- (tecnico) A técnica do SAMP é chamada de percentual regulatório do processo tarifário em títulos, verbetes e definições, mas a ANEEL descreve escalonamento anual pela STD e a Figura 7 difere do SAMP em mais de 0,8 p.p. em 5 de 18 distribuidoras (COSERN 9,2% contra 7,36%).
- (tecnico) Textos gerados com contagem de universo errada ou ambígua: soma nacional de 51 concessionárias em técnica e não técnica (usa 18), '18 de 51 publicaram a técnica' (foram 19), 'sem dado' onde nenhuma foi excluída.
- (tecnico) Bases e definições escolhidas dentro de gavetas ou do código, sem rótulo junto do número: base econômica da tarifa, 'trecho anterior' com duas definições, injetada de referência nos KPIs.
- (tecnico) Comparações de eras diferentes na mesma ordenação: trecho mais recente de 2006 a 2026 no regulatório, tarifa de 2014 ao lado de 2026 no custo e território de 2026 para anos antigos no mapa (este declarado).
- (tecnico) Rastreabilidade: toda ficha Comprove cita código d329b83c69a5+alterado (árvore suja) e a reprodução oficial exige silver e bronze não publicados; em compensação o sha256 do Parquet confere com o da ANEEL e os CSV mensais coincidem 100% com o arquivo bruto.
- (tecnico) Os testes fixam os números do próprio projeto e a única reconciliação externa é a de 2024 contra a edição anterior; nenhum cobre a aritmética das frases de seleção, a coerência entre gráfico e tabela do regulatório nem a linha de universo.

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística feita por agente em Chromium headless 1194 contra http://localhost:3101 (commit cbb5fbfeb), sem leitor de tela real, sem Firefox ou Safari (o salto ao topo foi medido só no Chromium), com toque emulado e sem teste com pessoas. As pastas de evidência trazem só parte das fatias de 390 px (faltam, por exemplo, 02, 04 e 06 de 07 em perdas e 03 de 05 em composição e custo); usei capturas próprias do mesmo servidor para as demais. O objetivo.json traz 360 e não 320 px e teclado só em 390 e 1440; medi 320 e 360 por conta própria (overflow, alvos, capturas) e rodei o axe-core do repositório em 1440 e 390, com 'contraste incompleto' em nós de gráfico. Não recebi os códigos P0xx de painel por rota, então 'paineis' está vazio. Não li avaliações anteriores. Correção numérica e rastreabilidade ficam com o avaliador técnico; conferi só, pelo CSV aberto, mediana, extremos, agregado e a divisão técnica e não técnica de 2025, que bateram com a página.
- (tecnico) Os hosts da ANEEL com o relatório e os percentuais regulatórios (git.aneel.gov.br, www2.aneel.gov.br, calculostarifarios, portalrelatorios) responderam 403 com desafio do Cloudflare ou encerraram a conexão em 09/10/2026. Li o relatório Perdas de Energia Elétrica na Distribuição 2026/2025 numa cópia hospedada em static.poder360.com.br (sha256 eca8f00b...), coerente com reportagem de 03/07/2026, e li as Figuras 3, 4, 5, 7, 8, 10 e 16 visualmente. Consultei diretamente o samp-balanco (CSV e Parquet), o arquivo de componentes tarifárias de 2026 e seu dicionário, o CKAN da ANEEL e a API do IBGE. Recalculei por código próprio, sem usar o pipeline do projeto. Não consultei o PRORET nem o PRODIST (escalonamento da técnica e significado de TUSD_PNT zero nas permissionárias ficam não verificados). Os componentes tarifários baixados são de 08/10 e posteriores à captura do site (27/09); comparei só os processos presentes nos dois. Desempenho vem de objetivo.json (laboratório, Chromium headless): não há dado de campo, leitor de tela real nem teste com usuários. Não executei testes nem build; li os testes.

