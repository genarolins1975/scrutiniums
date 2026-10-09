# Correções pedidas pelas avaliações independentes: unidade U10

Fonte: tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote3/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/perdas` | 5 | 0 |
| `/perdas/composicao` | 5 | 0 |
| `/perdas/custo-e-contexto` | 5 | 1 |
| `/perdas/regulatorio` | 5 | 3 |

## `/perdas`

### F, Benchmarks e comparabilidade: nota 7.0 (tecnico)

- Sem limite ou referência regulatória por distribuidora: a comparação de perímetro compatível pedida na tarefa da família não existe.
- O valor oficial da ANEEL para 2025 (14,3%, 90,2 TWh) não aparece; a conferência da página usa a edição 2025/2024 e só para 2024.
- Grupo único de comparação, sem quartis, pares ou porte; mínimo, mediana e máximo são a única régua entre entidades.
- KPI de mediana (83 distribuidoras) ao lado do agregado (51 concessionárias), universos diferentes.
- Justificativa do avaliador: Rótulos de média, mediana e razão de somas, universo e cobertura são exemplares. Faltam referência regulatória, quartis e pares por porte, e a taxa de 2025 não é confrontada com o valor oficial da ANEEL (14,3% contra 14,75%), que usa outro denominador.

### G, Rigor setorial: nota 7.5 (tecnico)

- Denominador de 2025: a página usa fornecida + irregular + perdas (612,7 TWh); a ANEEL usa a injetada publicada e divulga 14,3%. As frases de abertura dizem 'da energia que entrou na rede' para o denominador implícito.
- A linha Universo diz que a soma nacional usa as 51 concessionárias também em técnica e não técnica, cuja soma usa 18 em 2025 e 49 em 2010 (reproduzido com ?medida=pnt_bt e ?medida=tecnica).
- Técnica do SAMP descrita como percentual regulatório do processo tarifário; a ANEEL cita escalonamento anual pela STD e a Figura 7 difere do SAMP em mais de 0,8 p.p. em 5 de 18 distribuidoras.
- A coluna Fora da soma mostra sem dado onde nenhuma distribuidora foi excluída (2024 e 2025).
- Justificativa do avaliador: Denominadores, bases, ausência, cobertura e quebras são tratados com rigor, e os números reproduzem do arquivo oficial. O denominador de 2025 diverge do usado pela ANEEL sem confronto, a técnica é chamada de regulatória além do que a fonte sustenta e há texto de universo errado.

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

### F, Benchmarks e comparabilidade: nota 7.0 (tecnico)

- Sem referência regulatória nem oficial para a composição, embora a ANEEL publique a técnica regulatória por concessionária (Figura 7) e a não técnica ponderada (Figura 10).
- Linha do agregado de outro conjunto sobre barras de 19 distribuidoras, útil só com a leitura do aviso.
- A técnica do SAMP é lida como se fosse a regulatória, mas difere da Figura 7 em mais de 0,8 p.p. em 5 de 18.
- Ordenação e extremos sem pares por porte.
- Justificativa do avaliador: Boa disciplina de denominadores, universo e cobertura, e série de universo fixo para a tendência. Falta referência regulatória e nacional oficial da composição, a linha do agregado é de outro conjunto e a técnica do SAMP difere da regulatória de 2025 em mais de 0,8 p.p. em 5 de 18.

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

### E, Profundidade: nota 7.0 (tecnico)

- Custo total reconhecido em reais indisponível; a ANEEL publica totais nacionais e a glosa por distribuidora de grande porte (Figuras 14 e 15) que não aparecem.
- Sem história do componente por processo na página (só no CSV) e sem distribuição (mediana, quartis) do custo entre distribuidoras.
- Sem referência regulatória (percentual) para ler o peso das perdas na tarifa.
- Contexto por município inteiro atribui 11,7 milhões de habitantes à CERIS (24,7 GWh de injetada), que a tabela ordenada por população põe em 4º.
- Justificativa do avaliador: Cobre nível, composição, contexto social e território com valores que reproduzem. Faltam o custo total em reais, a história e a distribuição do custo e uma referência regulatória, e a leitura territorial por município inteiro distorce áreas pequenas.

### H, Rastreabilidade: nota 7.5 (tecnico)

- A base da tarifa só está na gaveta, sem definição, e o rótulo da coluna leva a procurar a tarifa homologada, que não bate.
- Código d329b83c69a5+alterado e reprodução que depende de arquivos não públicos.
- A conferência com o relatório da ANEEL não cobre custo nem tarifa.
- Justificativa do avaliador: Os valores reproduzem do arquivo oficial e as fichas são completas. A base econômica da tarifa só aparece numa gaveta, sem definição, sob um rótulo que sugere a tarifa homologada, e o código publicado tem árvore suja.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Medida só de laboratório.
- Os testes validam a soma e a vigência, não a semântica da base tarifária nem o zero de não técnicas.
- Justificativa do avaliador: Página sem erros de console ou rede, peso dentro da meta e testes de soma e vigência. Medida só de laboratório e testes que não cobrem a base tarifária mantêm abaixo de 9.

## `/perdas/regulatorio`

### Bloqueios

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

### L, Confiabilidade técnica: nota 7.0 (tecnico)

- Cálculo textual errado em 7 de 49 (defeito de interação ao escolher a distribuidora).
- Os testes não cobrem a frase por distribuidora nem a coerência entre gráfico e tabela.
- Medida só de laboratório.
- Justificativa do avaliador: Leve e sem erros de console, mas a interação de escolher a distribuidora gera frases com cálculo errado em 7 de 49, e os testes não pegam isso nem a divergência entre gráfico e tabela. Medida só de laboratório.

## Achados que se repetem entre páginas

- (tecnico) Denominador de 2025: a página usa a injetada de referência (612,7 TWh) e a ANEEL, no relatório 2026/2025, a injetada publicada (cerca de 632 TWh): 14,75% contra 14,3% oficial. A conferência das páginas usa a edição 2025/2024, por cópia de terceiro, e só para 2024.
- (tecnico) Nenhuma página traz referência regulatória: o percentual técnico homologado de 2025 por concessionária (Figura 7), a não técnica real e regulatória ponderada (16,2% e 11,2% do BT) e por UF (Figuras 8 e 10) estão públicos em figuras e não são usados.
- (tecnico) A técnica do SAMP é chamada de percentual regulatório do processo tarifário em títulos, verbetes e definições, mas a ANEEL descreve escalonamento anual pela STD e a Figura 7 difere do SAMP em mais de 0,8 p.p. em 5 de 18 distribuidoras (COSERN 9,2% contra 7,36%).
- (tecnico) Textos gerados com contagem de universo errada ou ambígua: soma nacional de 51 concessionárias em técnica e não técnica (usa 18), '18 de 51 publicaram a técnica' (foram 19), 'sem dado' onde nenhuma foi excluída.
- (tecnico) Bases e definições escolhidas dentro de gavetas ou do código, sem rótulo junto do número: base econômica da tarifa, 'trecho anterior' com duas definições, injetada de referência nos KPIs.
- (tecnico) Comparações de eras diferentes na mesma ordenação: trecho mais recente de 2006 a 2026 no regulatório, tarifa de 2014 ao lado de 2026 no custo e território de 2026 para anos antigos no mapa (este declarado).
- (tecnico) Rastreabilidade: toda ficha Comprove cita código d329b83c69a5+alterado (árvore suja) e a reprodução oficial exige silver e bronze não publicados; em compensação o sha256 do Parquet confere com o da ANEEL e os CSV mensais coincidem 100% com o arquivo bruto.
- (tecnico) Os testes fixam os números do próprio projeto e a única reconciliação externa é a de 2024 contra a edição anterior; nenhum cobre a aritmética das frases de seleção, a coerência entre gráfico e tabela do regulatório nem a linha de universo.

## Limites declarados pelos avaliadores

- (tecnico) Os hosts da ANEEL com o relatório e os percentuais regulatórios (git.aneel.gov.br, www2.aneel.gov.br, calculostarifarios, portalrelatorios) responderam 403 com desafio do Cloudflare ou encerraram a conexão em 09/10/2026. Li o relatório Perdas de Energia Elétrica na Distribuição 2026/2025 numa cópia hospedada em static.poder360.com.br (sha256 eca8f00b...), coerente com reportagem de 03/07/2026, e li as Figuras 3, 4, 5, 7, 8, 10 e 16 visualmente. Consultei diretamente o samp-balanco (CSV e Parquet), o arquivo de componentes tarifárias de 2026 e seu dicionário, o CKAN da ANEEL e a API do IBGE. Recalculei por código próprio, sem usar o pipeline do projeto. Não consultei o PRORET nem o PRODIST (escalonamento da técnica e significado de TUSD_PNT zero nas permissionárias ficam não verificados). Os componentes tarifários baixados são de 08/10 e posteriores à captura do site (27/09); comparei só os processos presentes nos dois. Desempenho vem de objetivo.json (laboratório, Chromium headless): não há dado de campo, leitor de tela real nem teste com usuários. Não executei testes nem build; li os testes.

