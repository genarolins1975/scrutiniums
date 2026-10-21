# Correções pedidas pelas avaliações independentes: unidade U03

Fonte: produto, tecnico em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/pacote2/saida. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/agua-e-clima` | 9 | 0 |
| `/agua-e-clima/afluencia` | 12 | 0 |
| `/agua-e-clima/chuva-e-temperatura` | 12 | 0 |
| `/agua-e-clima/reservatorios` | 12 | 0 |

## `/agua-e-clima`

### A, Layout e hierarquia: nota 8.0 (produto)

- Cartões do topo repetidos em 'Números do recorte escolhido' quando o recorte é o SIN (estado padrão).
- Sem gráfico na primeira tela de 1440x900; no celular o gráfico por região começa a 1.827 px.
- Notas de 12 px e eixos de 10 a 11 px; 'Comprove este número' e a nota 'Os do alto da página são sempre os do SIN' usam fonte condensada, menos legível.
- Cartão '63 mudanças' e gráfico de 26 anos fecham a página sem responder à pergunta do título.
- A dobra de 1440 é tomada por controles (Recorte, Subsistema, Unidade, Ordenar) antes do gráfico.
- Justificativa do avaliador: Pergunta, resposta e hierarquia são reconhecíveis e o celular preserva o essencial. Fica abaixo de 9 porque repete os cartões do SIN, não mostra gráfico na primeira tela de 1440, usa textos de 10 a 12 px e termina com material secundário.

### B, Didática: nota 8.0 (produto)

- Das cinco perguntas da abertura, 'por que a medida importa' fica recolhida no fim e 'o que não permite concluir' só aparece depois dos gráficos.
- REE, ONS, ENA e MLT e termos como mediana e percentil são usados antes de traduzidos.
- Sem ponte do tema com geração hídrica, carga, PLD ou conta de luz; 'Outras perguntas sobre a água' só leva às páginas irmãs.
- O texto do modo Entender é longo (cerca de 9.100 caracteres) para jornalista ou professor.
- Justificativa do avaliador: Explica EAR, SIN, MWmês e p.p. com cuidado e padroniza a leitura crítica. A abertura não reúne as cinco respostas: a importância do tema está recolhida no fim, as limitações vêm depois dos gráficos e faltam pontes para PLD, geração e conta de luz.

### D, Impacto social: nota 8.0 (produto)

- Sem imagem do gráfico para compartilhar com título, fonte e data; só link e CSV.
- CSV de série completa sem unidade, fonte ou captura no cabeçalho; separador ponto e vírgula com decimal em ponto.
- Nenhuma ligação com custo, continuidade ou acesso do consumidor (por exemplo, link neutro para conta de luz ou PLD).
- 'Sobre este dado' diz que ainda não é possível detectar revisões, mas a página publica revisões do ONS entre duas capturas (1 a 18 de 30 dias).
- 'Versão do processamento' termina em '+alterado' (código ac7599ce6c86+alterado), sem explicação ao leitor.
- Justificativa do avaliador: Adaptado a público especializado: recortes territoriais, lacunas, provisoriedade, link com estado e exportação com filtro são bons. Faltam imagem compartilhável, contexto nos CSV de série, ponte para custo e consumo e coerência sobre revisões. O impacto social é potencial, não comprovado.

### C, Utilidade: nota 8.5 (produto)

- Para Sudeste/Centro-Oeste e Sul a frase não informa a posição frente à faixa usual; só a figura mostra, e a tabela diz 'dentro da faixa usual, em %'.
- Em MWmês a faixa existe só para o dia de referência; a série do último ano e a faixa por data ficam em percentual.
- O gráfico por região mostra só a mediana; a faixa de cada região exige selecionar uma a uma ou abrir a tabela.
- Cartão '63 mudanças' e cartões repetidos somam números que não respondem à pergunta.
- Justificativa do avaliador: T5 é atendida em poucos passos, com percentual, energia, mediana, faixa e exportação sincronizada. Limitam a nota: posição frente à faixa não dita para Sudeste/Centro-Oeste e Sul, faixa por data só em percentual e números sem função na pergunta.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código publicado como ac7599ce6c86 mais alterado (26 de 31 bases): a versão exata não se reconstitui.
- O passo a passo da ficha exige arquivos bronze e silver internos que o leitor não obtém; o procedimento público é o CSV.
- Séries dos gráficos (SIN mensal desde 2000, 120 dias, a cada 14 dias) sem CSV próprio.
- Método do quantil (tipo 7) e definição de percentil só no documento do módulo, não nas regras da página.
- Mediana do SIN (49,1 %) e variação de 30 dias, números de destaque, não têm ficha Comprove.
- Justificativa do avaliador: Número reconstruído do CSV e do ONS, ficha completa e manifesto conferido. Teto de 8,5: o código publicado tem alterações não confirmadas, o roteiro depende de arquivos internos e há séries de gráfico sem CSV.

### I, Visualizações: nota 8.5 (produto)

- O gráfico por região mostra só a mediana; a faixa p10 a p90 aparece para uma região por vez.
- Losango da mediana e conectores com contraste gráfico de cerca de 2,3:1, abaixo de 3:1.
- Eixos com 10 e 11 px; painéis do bloco de quatro recortes têm cerca de 280 px de largura.
- Série do último ano e faixa por data seguem em percentual mesmo com MWmês escolhido (a página avisa).
- A dica do gráfico de bacias encosta na borda inferior da figura.
- Justificativa do avaliador: Formas adequadas à tarefa, com referências, tabelas e teclado. Abaixo de 9 por mostrar só a mediana no gráfico principal, contraste gráfico de 2,3:1 nas marcas de referência, texto de eixo de 10 a 11 px e série por data que não acompanha a unidade MWmês.

### J, Navegação e interação: nota 8.5 (produto)

- A raiz não mostra a faixa de abas das páginas filhas; o caminho para Afluência, Chuva e Reservatórios só aparece depois de cerca de 2.600 px.
- Escolher uma entidade abre a tabela sem pedido e muda a altura da página.
- A seleção do painel e a dos recortes comparados são independentes, e a página não diz isso.
- Sem botão para restaurar unidade, recorte e ordem de uma vez.
- A descrição de Analisar e Auditar só aparece para a opção selecionada ou ao pairar (title), invisível no toque.
- Justificativa do avaliador: Interação sólida: estado em URL, Voltar funcional, exportação que respeita a busca e estados vazios claros. Descontam a falta das abas da família na raiz, a tabela que abre sozinha, as seleções independentes sem aviso e a ausência de um restaurar geral.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Leitor de tela real não testado; só se leu o DOM (rótulos, textos para leitor de tela e regiões vivas).
- Texto de 12 px em cerca de 40% dos caracteres e eixos de 10 a 11 px; 'Comprove este número' tem 32 px de altura em 1440.
- Contraste gráfico do losango e dos conectores em cerca de 2,3:1.
- Hierarquia de títulos irregular: H1, um H2 e H3 para seções irmãs; os quatro painéis de recorte são H3 como o título da seção.
- objetivo.json aponta 3 alvos abaixo de 44 px no celular (links de sigla com 17 px de altura, rodapé).
- Justificativa do avaliador: Automático e manual combinados mostram boa base: sem violações no axe, foco visível, atalho para o conteúdo, reflow em 320 px e movimento reduzido. Leitor de tela não foi testado, e há texto pequeno, marcas gráficas de 2,3:1 e hierarquia de títulos irregular.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Só há medição de laboratório: o instrumento do projeto registra tempos e bytes, não mede LCP, INP nem CLS, e não há coleta de campo.
- Protocolo de medição (dispositivo, rede, limites) não documentado para a página.
- Justificativa do avaliador: Console limpo, CLS próximo de zero, testes por risco e retenção de publicação reprovada. Teto de 8,5 porque a medição é só de laboratório e o projeto não documenta protocolo nem mede LCP, INP e CLS.

## `/agua-e-clima/afluencia`

### B, Didática: nota 7.5 (produto)

- 'Por que a medida importa' recolhido no fim; limites só depois do gráfico e dos cartões.
- 'ENA armazenável', 'MWmed·dia', 'conjunto aberto', 'MLT implícita' e PMO sem tradução no ponto de uso.
- Não explica por que a mediana da janela (81,8%) é menor que a MLT (100%, média de longo termo).
- Sem ponte para geração, PLD ou conta de luz além de 'Próxima pergunta'.
- Justificativa do avaliador: Define ENA, MLT e a conta de 30 dias com clareza e padroniza os limites. A abertura deixa o motivo do tema recolhido, usa termos como 'conjunto aberto' e 'MLT implícita' sem tradução e não explica mediana contra média.

### D, Impacto social: nota 7.5 (produto)

- Sem imagem do gráfico para compartilhar com título, fonte e data.
- Os CSV de série (ena_diario.csv) são só colunas, sem fonte, captura ou versão dentro do arquivo.
- Quem vem de Visão geral ou PLD e vê outro valor de ENA não encontra a explicação aqui; a tabela de conferência está só na página de armazenamento, em Auditar.
- Nenhuma ligação com custo, continuidade ou acesso do consumidor.
- Justificativa do avaliador: Adaptado a público especializado: recortes territoriais, lacunas declaradas, link com estado e exportação por tabela. Faltam imagem compartilhável, contexto dentro dos CSV, a conferência com Visão geral e PLD na própria página e ponte para custo e consumo. Impacto social é potencial.

### A, Layout e hierarquia: nota 8.0 (produto)

- Os números de destaque ficam abaixo do gráfico, fora da primeira tela.
- 'Qual MLT? A referência muda de versão' ocupa cerca de um quarto da página em Entender (dois gráficos de diferenças de até 1% e quatro painéis de escala livre).
- A frase 'o percentual da MLT é outra régua que o da EAR' aparece duas vezes.
- Texto de 10 a 12 px em eixos, notas e fontes; blocos Período, Universo e Unidade densos.
- Justificativa do avaliador: Primeira tela bem resolvida e página coerente com as irmãs. Perde pontos porque os números de destaque ficam abaixo do gráfico, um quarto da página trata de versões da MLT no modo essencial e há repetição de avisos e texto pequeno.

### C, Utilidade: nota 8.0 (produto)

- A evolução não mostra a faixa usual por data: o leitor não vê se cada semana esteve fora do usual.
- No gráfico de pontos a posição 'acima da faixa usual' não é visível (só a mediana); a faixa está na tabela e na dica.
- Dois sentidos de 'normal' na mesma tela (MLT 100% e mediana 81,8%) sem ponte.
- Cerca de um quarto da página trata de versões da MLT, de pouca ajuda à decisão do leitor médio.
- T5 só é atendida em parte: a página dá a referência sazonal da água que chega, não a do armazenamento.
- Justificativa do avaliador: A pergunta da página é respondida na primeira tela, com evolução, ENA armazenável e arquivos. Limitam a nota: sem faixa histórica por data, posição acima do usual invisível no gráfico e bloco longo sobre versões da MLT. Julgada pela parte da tarefa que cabe à página.

### I, Visualizações: nota 8.0 (produto)

- O gráfico por região não desenha a faixa usual nem a linha de 100%: a posição acima do usual não é visível.
- A evolução de 7 em 7 dias não traz faixa histórica por data (declarado como não publicado).
- Painéis de MLT implícita em escala livre impedem comparar alturas; o aviso não substitui um eixo comum.
- Com '30 dias' o gráfico fica com apenas 5 pontos.
- Eixos de 10 e 11 px; contraste gráfico do losango de cerca de 2,3:1.
- Justificativa do avaliador: Formas adequadas, lacunas honestas e avisos de escala. Perde pontos porque o gráfico principal não mostra a faixa usual nem a linha de 100%, a evolução não tem faixa histórica e os painéis de MLT ficam em escala livre.

### E, Profundidade: nota 8.5 (tecnico)

- A evolução de 18 meses não traz a faixa da data, que a página de armazenamento já traz.
- A evolução cobre só subsistemas e SIN; REE e bacias aparecem apenas no ponto mais recente.
- Sem geração hidráulica ou vertimento ao lado da ENA; só remissão ao painel de reservatórios.
- Justificativa do avaliador: Cobertura forte e verificada, com análise inédita da versão da MLT. Falta a faixa da data na evolução e a evolução de REE e bacias, o que impede nota 9.

### F, Benchmarks e comparabilidade: nota 8.5 (tecnico)

- ENA armazenável contra uma MLT armazenável que o ONS não define: o denominador é a MLT da ENA bruta.
- A faixa de 25 anos mistura versões da MLT; a página avisa, mas não mede o efeito.
- A evolução não tem faixa da data.
- Justificativa do avaliador: Referências corretas e conferidas no ONS e no PMO. Descontos: rótulo de MLT armazenável para uma referência que não existe, faixa histórica que mistura versões da MLT sem medir o efeito e evolução sem faixa.

### G, Rigor setorial: nota 8.5 (tecnico)

- Rótulo % da MLT armazenável sem suporte na fonte; a explicação descreve o numerador, não a referência, e 109,2 % pode parecer acima do normal da energia armazenável.
- Selo Observado em ENA reconstituída.
- Conferência da unidade não diz em que anos a soma das usinas difere.
- Justificativa do avaliador: Unidades, universos e versões da MLT tratados com rigor e conferidos no ONS. Descontos: denominador da ENA armazenável mal rotulado, selo Observado em série reconstituída e conferência de unidade sem dizer quando difere.

### H, Rastreabilidade: nota 8.5 (tecnico)

- Código publicado alterado e passos que dependem de arquivos internos.
- Séries dos gráficos (78 semanas, MLT implícita) sem CSV próprio, embora refaçam dos CSV diários.
- Método do quantil e do percentil só no documento do módulo.
- Conferência de unidade sem os anos de divergência.
- Mediana da janela (81,8 %) e ENA do dia (72.323 MWmed), em destaque, não têm ficha Comprove.
- Justificativa do avaliador: Número reconstruído do CSV e conferido no relatório do PMO, com ficha completa. Teto de 8,5 pelo código com alterações não confirmadas, roteiro com arquivos internos e séries de gráfico sem CSV próprio.

### J, Navegação e interação: nota 8.5 (produto)

- Tabela abre sozinha ao escolher uma entidade e muda a altura da página.
- A escolha do painel e a dos chips de 'Regiões no gráfico' são independentes, sem aviso.
- Sem restaurar geral de recorte, ordem e unidade.
- Três faixas de navegação empilhadas (menu do site, módulos e abas da família) antes do título.
- Justificativa do avaliador: Interação coerente: estado em URL, mensagens de status, abas da família e chips com limite explicado. Descontam a tabela que abre sozinha, duas escolhas independentes sem aviso, a falta de restaurar geral e as três faixas de navegação antes do título.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Leitor de tela real não testado.
- Texto de 12 px em cerca de 35% dos caracteres e eixos de 10 a 11 px.
- Contraste gráfico do losango e dos conectores em cerca de 2,3:1.
- Hierarquia de títulos irregular: seções irmãs como H3 sob o único H2 e painéis de MLT em H4.
- objetivo.json aponta 3 alvos abaixo de 44 px no celular (links de sigla com 17 px de altura).
- Justificativa do avaliador: Boa base de acessibilidade: axe limpo, foco visível, reflow em 320 px, movimento reduzido e teclado nos gráficos. Fica abaixo de 9 por leitor de tela não testado, texto pequeno, marcas gráficas de 2,3:1 e hierarquia de títulos irregular.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Só laboratório: o instrumento do projeto não mede LCP, INP nem CLS e não há coleta de campo.
- Protocolo de medição não documentado para a página.
- Justificativa do avaliador: Console limpo, CLS próximo de zero e testes dirigidos a risco. Teto de 8,5 porque só há medição de laboratório e o projeto não documenta protocolo nem mede LCP, INP e CLS.

## `/agua-e-clima/chuva-e-temperatura`

### A, Layout e hierarquia: nota 7.5 (produto)

- Página longa (7.245 px em 1440; 12.179 px em 390) com oito painéis de peso parecido; o painel central não se destaca.
- Coluna lateral do mapa com quatro parágrafos de 12 px que competem com a legenda.
- A quarta célula do bloco 'observação, estimativa, previsão e cenário' fica cinza e vazia em Entender, e o cartão 'Observação' só existe em Analisar.
- Selos 'Estimado' e 'Previsto' no cabeçalho do mapa, que só tem estimativa; a previsão está 4.500 px abaixo.
- Bacias do Sul quase invisíveis no mapa de 656 px.
- Justificativa do avaliador: Primeira tela traz resposta e ressalva, e a hierarquia é legível. Fica em 7,5 por página muito longa com oito painéis equivalentes, texto lateral denso, célula cinza vazia e selos que misturam estimativa e previsão no cabeçalho do mapa.

### B, Didática: nota 7.5 (produto)

- O título promete explicar a relação com a água e a demanda; a página entrega anomalias, uma correlação por bacia e um link.
- IMERG, MERRA-2, GEOS-IT, ECMWF IFS e dia UTC sem tradução no ponto de uso.
- 'Por que isso importa' recolhido no fim; limites só depois do mapa.
- O selo 'Previsto' no cabeçalho do mapa pode levar a ler o mapa como previsão.
- Sem ponte para PLD e conta de luz; só há link para Carga e Afluência no último bloco.
- Justificativa do avaliador: A separação entre estimativa, previsão e cenário é didática e o aviso de janela preliminar é exemplar. O título promete relação com água e demanda que a página não demonstra, e siglas de produtos ficam sem tradução; o motivo do tema está recolhido no fim.

### C, Utilidade: nota 7.5 (produto)

- O mapa colore só a anomalia percentual, que satura no período seco (14 de 22 bacias na maior classe); milímetros e percentil ficam na dica e na tabela.
- Sem visão que ponha chuva e ENA da mesma bacia lado a lado; a relação prometida no título fica numa frase.
- A previsão é comparada à média de outro produto (IMERG) 'só como ordem de grandeza', sem referência desenhada no gráfico.
- T5 não se aplica por desenho: a página não trata de armazenamento; a parte da tarefa da família que lhe cabe é chuva e temperatura.
- Justificativa do avaliador: Serve bem ao acompanhamento de chuva e temperatura por bacia, com tabela e previsão separada. Limitam a nota: mapa que satura em percentual no período seco, relação com ENA e demanda reduzida a uma frase e previsão sem referência desenhada. Julgada pela parte que cabe à página.

### D, Impacto social: nota 7.5 (produto)

- Sem imagem do mapa ou dos gráficos para compartilhar com legenda, fonte e data.
- Nenhuma ligação com custo, continuidade ou acesso do consumidor; a relação com a demanda é remetida a outro painel.
- A temperatura aparece por subsistema; o recorte por UF só existe no CSV.
- Quem quer uma bacia pequena (Itajaí, Capivari) depende do seletor, pois o polígono quase não é clicável.
- Justificativa do avaliador: Adaptado a público especializado: recorte por bacia com geometria documentada, lacunas e provisoriedade explícitas, link e exportação. Faltam imagem do mapa para compartilhar, recorte por UF na temperatura e ponte para custo e consumo. Impacto social é potencial.

### E, Profundidade: nota 8.0 (tecnico)

- Cenário climático não integrado; a página e o módulo dizem que o painel é parcial, embora a fonte de projeções responda.
- Temperatura sem conferência com estação; chuva conferida só de jan/2020 a out/2021 e em IMERG Final.
- Previsão de uma rodada, sem avaliação de acerto nem comparação com referência simples.
- Relação com a demanda só por remissão a outro painel.
- Justificativa do avaliador: Cobertura ampla e reproduzida das fontes primárias, com separação clara entre estimativa, previsão e cenário. Nota 8,0: painel parcial, sem cenário, sem conferência de temperatura, sem avaliação da previsão e sem observação atual de estação.

### F, Benchmarks e comparabilidade: nota 8.0 (tecnico)

- Janelas preliminares contra climatologia final sem estimar o viés (Late contra Final; GEOS-IT contra MERRA-2).
- Classe central de mais ou menos 10 % mais estreita que o erro conhecido do IMERG por bacia.
- A média de 25 anos não separa tendência de aquecimento: 22 de 24 meses acima da média, sem nota sobre isso.
- Justificativa do avaliador: Referências reproduzidas do NASA POWER, mas as duas janelas de destaque são preliminares e comparadas com produto final sem estimar o viés, e a classe central é mais estreita que o erro conhecido do IMERG. Falta ainda nota sobre a tendência de aquecimento.

### H, Rastreabilidade: nota 8.0 (tecnico)

- Climatologia da chuva fora do CSV publicado: só se refaz pela API externa com o manifesto, o que a página não ensina.
- Ficha da temperatura sem as duas médias e com valor de cálculo já arredondado.
- Código publicado alterado e roteiro com arquivos internos.
- Ficha diz nenhuma revisão detectada, mas a troca de Late por Final é revisão certa.
- Justificativa do avaliador: Fonte e fórmula claras e números reproduzidos, mas a climatologia da chuva não sai do CSV publicado, a ficha da temperatura omite as médias e o código é alterado e depende de arquivos internos.

### I, Visualizações: nota 8.0 (produto)

- Classes por percentual saturam no período seco: 14 de 22 bacias caem na mesma classe escura.
- Bacias pequenas sem rótulo no mapa e quase invisíveis (Itajaí, Capivari, Itabapoana).
- A linha tracejada de 'média das máximas' divide o eixo com a média diária e a faixa da média, o que pede legenda atenta.
- Gráficos de previsão sem referência climatológica desenhada; a tabela põe a média IMERG ao lado da prevista, com o aviso 'só ordem de grandeza' (conferir com o avaliador técnico).
- Eixos de 10 e 11 px; a classe neutra do mapa tem 1,23:1 contra as áreas fora do SIN, e a classe de 10% a 50% tem 2,25:1 contra o fundo.
- Justificativa do avaliador: Mapa e séries bem escolhidos, com classes fixas, faixas e marcas de dado preliminar. Abaixo de 9 porque as classes em percentual saturam no período seco, bacias pequenas somem, a previsão não tem referência desenhada e há texto de eixo pequeno.

### J, Navegação e interação: nota 8.0 (produto)

- O mapa é o acesso visual às bacias, mas as do Sul têm polígonos minúsculos; o seletor existe, separado do mapa.
- Escolher bacia abre a tabela sem pedido e muda a altura da página.
- O seletor de temperatura fica longe do seletor de bacia; a relação entre as duas escolhas só é dita no bloco de medidas.
- Sem restaurar geral de bacia, período e comparação.
- Justificativa do avaliador: Interação consistente: seletores, mapa por teclado e URL sincronizados, com bacias comparáveis e alternativa por seletor. Descontam polígonos pequenos como único acesso visual, tabela que abre sozinha, escolhas espalhadas pela página e falta de restaurar geral.

### K, Acessibilidade e responsividade: nota 8.0 (produto)

- Polígonos de bacia pequenos como alvo de toque (menos de 24 px em Capivari, Itajaí, Itabapoana e Jacuí); a alternativa é o seletor.
- Legenda do mapa com rótulo ARIA em div sem papel (axe incompleto).
- Leitor de tela real não testado; a descrição do mapa por polígono não foi ouvida.
- Texto de 10 a 12 px em eixos, legendas e notas; a classe neutra do mapa tem 1,23:1 contra as áreas fora do SIN.
- Hierarquia de títulos: as seções seguintes ao único H2 são H3 e os painéis de bacia são H4.
- Justificativa do avaliador: Teclado, contraste de texto, reflow e movimento reduzido estão bem resolvidos, inclusive no mapa. A nota é menor que nas irmãs por alvos de toque minúsculos no mapa, legenda com rótulo ARIA sem papel, leitor de tela não testado e texto pequeno.

### G, Rigor setorial: nota 8.5 (tecnico)

- O bloco Universo descreve o IMERG como calibrado, o que só vale para a versão final.
- Anomalia percentual em base seca domina o mapa; a ressalva existe, mas a classe usa só o percentual.
- Temperatura sem validação contra observação.
- Justificativa do avaliador: Separação rigorosa entre estimativa, previsão e cenário, com pesos, coberturas e preliminares conferidos. Descontos: Universo chama o IMERG de calibrado quando o destaque é Late, classes só em percentual na base seca e temperatura sem validação.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Só laboratório: o instrumento do projeto não mede LCP, INP nem CLS e não há coleta de campo.
- Protocolo de medição não documentado para a página.
- Justificativa do avaliador: Console limpo, CLS baixo mesmo com CPU e rede limitadas e testes por risco. Teto de 8,5 porque a medição é só de laboratório, sem protocolo documentado nem LCP, INP e CLS no instrumento do projeto.

## `/agua-e-clima/reservatorios`

### B, Didática: nota 7.5 (produto)

- 'Parte própria' e 'a jusante' só são explicadas abaixo do gráfico; na frase do Norte, Serra da Mesa aparece sem 'a jusante' e pode ser lida como reservatório do Norte.
- Glossário da conta da água vem depois dos gráficos que usam os termos.
- 'Fecham por construção', 'convenção da defluência' e 'balanço calculado' são jargão no modo Entender.
- O título 'Por que...' pede causa; a página entrega decomposição contábil e diz que a ENA não explica tudo, sem apontar o que explica.
- 'Por que isso importa' recolhido no fim; sem ponte para geração hidráulica ou PLD.
- Justificativa do avaliador: A fórmula da conta da água é clara e a página diz o que não prova. Fica em 7,5 porque 'a jusante' e o glossário vêm depois dos gráficos, o jargão do balanço aparece cedo e o título promete causa que a decomposição contábil não entrega.

### D, Impacto social: nota 7.5 (produto)

- Sem imagem dos gráficos para compartilhar com título, fonte e data.
- As variações por reservatório dos 35 demais não estão publicadas, o que limita jornalistas e gestores que queiram apontar onde a queda se concentrou.
- Nenhuma ligação com uso múltiplo da água, custo ou continuidade; sem ponte para geração hidráulica ou PLD.
- Justificativa do avaliador: Adaptado a público especializado: troca por subsistema e reservatório, limites do balanço explicados, link com estado e exportação. Faltam imagem compartilhável, variações dos 35 demais reservatórios e pontes para uso da água, custo e geração. Impacto social é potencial.

### A, Layout e hierarquia: nota 8.0 (produto)

- A diferença de janela entre esta página e a de armazenamento aparece três vezes no mesmo bloco (cartão, quadro e parágrafo).
- Os cartões 'Soma das 10 parcelas' e 'Soma dos demais 35' são repetidos por um parágrafo logo abaixo.
- Três gráficos de barras do mesmo reservatório com réguas diferentes (hm³ de menos 4.000 a 4.000, 0 a 3.000, menos 2,0 a 0,0).
- Glossário (afluência, defluência, resíduo, transferência) vem depois dos gráficos que usam os termos.
- Texto de 10 a 12 px em eixos, notas e fontes.
- Justificativa do avaliador: Primeira tela com resposta e gráfico, hierarquia clara e celular preservado. Perde pontos pela repetição do aviso de janela e dos totais no mesmo bloco, três réguas distintas para o mesmo reservatório e glossário depois dos gráficos.

### C, Utilidade: nota 8.0 (produto)

- No Sudeste/Centro-Oeste cerca de 60% da queda fica na barra 'Demais 35 reservatórios, soma', sem detalhe por reservatório.
- Janela única de 30 dias, sem seletor de período e sem dizer se a variação é usual para a época.
- T5 só em parte: a página decompõe a variação do armazenamento, mas não compara com a referência sazonal.
- Justificativa do avaliador: Responde bem 'quais reservatórios pesaram' e permite ver a conta da água de 67 reservatórios. Limitam a nota: 60% da queda do Sudeste/Centro-Oeste ficam agregados, janela única de 30 dias e nenhuma referência sazonal. Julgada pela parte da tarefa que cabe à página.

### E, Profundidade: nota 8.0 (tecnico)

- Decomposição incompleta: 35 de 45 reservatórios numa barra única, e o mesmo nos outros três subsistemas.
- Sem referência sazonal por reservatório nem por subsistema nesta página.
- Balanço de um reservatório por vez; a explicação do subsistema por fluxos só vem em médias de contexto.
- A comparação de até quatro reservatórios abre vazia.
- Justificativa do avaliador: Decomposição e balanço corretos e reproduzidos, mas a página responde quais reservatórios pesaram só pelas dez parcelas extremas, deixa 60 % da variação líquida numa barra de resto e não traz referência da data por reservatório.

### F, Benchmarks e comparabilidade: nota 8.0 (tecnico)

- Sem referência da data para volume e balanço por reservatório.
- A soma dos demais 35 por diferença junta reservatórios de sinais opostos sem mostrar a distribuição.
- Justificativa do avaliador: Comparações internas bem delimitadas e identidade conferida, mas o painel não oferece referência histórica nem de pares por reservatório e esconde a distribuição dos 35 reservatórios restantes numa soma.

### H, Rastreabilidade: nota 8.0 (tecnico)

- Decomposição da EAR por reservatório sem arquivo.
- Única captura: a página não mostra revisão de volume e vazões.
- O número de destaque (variação da EAR do subsistema) e as parcelas não têm ficha Comprove; as duas fichas são do resíduo de Serra da Mesa e do fechamento por construção.
- Código publicado alterado e roteiro com arquivos internos.
- Justificativa do avaliador: Balanço reproduzível por CSV e pela fonte, com ficha completa. Teto de 8,0 porque a decomposição por reservatório não tem arquivo, não há captura anterior para mostrar revisão e o código publicado é alterado.

### I, Visualizações: nota 8.0 (produto)

- A barra 'Demais 35 reservatórios, soma' tem a mesma cor e espessura das barras de reservatórios individuais.
- A legenda inicial diz que o gráfico mostra só parte das 11 categorias, mas as 11 já aparecem; 'Mostrar todas as 11' não muda nada.
- No gráfico de vazões a defluente fica coberta pela turbinada, e a legenda lista as duas.
- Três gráficos do mesmo reservatório com réguas diferentes em colunas pequenas.
- Selo 'Observado' em afluência e defluência, que o texto diz serem derivadas pelo ONS e não medição direta.
- Justificativa do avaliador: Barras e séries adequadas, com ausência tratada como 'sem dado' e avisos de régua. Fica abaixo de 9 pela barra agregada igual às individuais, legenda e botão 'Mostrar todas' sem efeito, defluente escondida e selo 'Observado' em valor derivado.

### J, Navegação e interação: nota 8.0 (produto)

- 'Mostrar todas as 11' e 'Mostrar só o início' não mudam o gráfico, e a legenda inicial afirma que há categorias ocultas.
- A seleção abre a tabela de parcelas sem pedido e muda a altura da página.
- Janela única de 30 dias, sem seletor de período.
- Sem restaurar geral de subsistema, reservatório e comparação.
- Justificativa do avaliador: Interação eficaz: subsistema, barra e seletor sincronizam gráfico, conta da água, séries e URL, com comparador e estado vazio claros. Descontam o botão 'Mostrar todas' sem efeito, a tabela que abre sozinha, a janela única e a falta de restaurar geral.

### G, Rigor setorial: nota 8.5 (tecnico)

- Glosa errada de parte própria e parte a jusante (própria usina e usinas rio abaixo) em Universo e em Fontes, datas e siglas.
- Sem aviso de provisoriedade do ONS no corpo da página, embora a janela caia na zona de revisão (9 de 153 reservatórios mudaram a afluência em mais de 1 %).
- Selo Observado em afluência derivada.
- Justificativa do avaliador: Balanço e decomposição corretos, unidades e convenção da defluência conferidas. Descontos: glosa de parte própria contrária ao dicionário do ONS, ausência de aviso de provisoriedade no corpo e selo Observado em afluência derivada.

### K, Acessibilidade e responsividade: nota 8.5 (produto)

- Leitor de tela real não testado.
- Texto de 12 px em cerca de 40% dos caracteres e eixos de 10 a 11 px.
- No celular os rótulos das barras de defluência tocam a linha de grade do eixo, e o link 'ir para a conta da água' tem 15 px de altura.
- Hierarquia de títulos: um H2 e H3 para as demais seções.
- Defluente e turbinada coincidem e só uma cor aparece, o que reduz a distinção para quem não vê cor.
- Justificativa do avaliador: Boa base: axe limpo, foco visível, teclado nas barras, reflow em 320 px e movimento reduzido. Abaixo de 9 por leitor de tela não testado, texto pequeno, link de 15 px de altura, rótulos tocando a grade no celular e linhas coincidentes no gráfico de vazões.

### L, Confiabilidade técnica: nota 8.5 (tecnico)

- Só laboratório: o instrumento do projeto não mede LCP, INP nem CLS e não há coleta de campo.
- Protocolo de medição não documentado para a página.
- Justificativa do avaliador: Console limpo, CLS próximo de zero e testes por risco. Teto de 8,5 porque só há medição de laboratório e o projeto não documenta protocolo nem mede LCP, INP e CLS.

## Achados que se repetem entre páginas

- (produto) Importância da medida ('Por que isso importa') recolhida no fim das quatro páginas e limites ('O que não é possível concluir') só depois dos gráficos: a abertura não reúne as cinco respostas (B).
- (produto) Termos e siglas usados antes de traduzidos: REE, MLT, ENA armazenável, IMERG, MERRA-2, 'a jusante', defluência e 'fecham por construção'; a tradução está em blocos recolhidos ou abaixo dos gráficos (B).
- (produto) Selo 'Observado' em valores que a própria página diz derivados pelo ONS (EAR, ENA, afluência) e selo 'Previsto' no cabeçalho do mapa de estimativa (B, I).
- (produto) Compartilhamento: link com estado e CSV e XLSX bons, mas nenhuma imagem de gráfico com título, fonte e data; os CSV de série são só colunas (ear_diario.csv sem unidade), com ponto e vírgula e decimal em ponto (D).
- (produto) Texto de 10 a 12 px (12 px em cerca de 35% a 40% dos caracteres), 'Comprove este número' em fonte condensada, marcas de referência com cerca de 2,3:1 e hierarquia de títulos irregular (A, K).
- (produto) Repetição de cartões e avisos: cartões do SIN duplicados (página 1), régua MLT e EAR dita duas vezes (página 2), janelas de 28 e 29/09 ditas três vezes (página 4) (A).
- (produto) Controles com efeito inesperado: a tabela abre sozinha ao escolher uma entidade nas quatro páginas; 'Mostrar todas as 11' não faz nada na página 4; seleções do painel e dos chips são independentes sem aviso nas páginas 1 e 2 (J).
- (produto) Pouca ponte do tema com geração hídrica, PLD, carga e conta de luz: só 'Outras perguntas' ou 'Próxima pergunta' e um link para Carga na página 3 (B, D).
- (tecnico) Código publicado com sufixo alterado (26 de 31 bases) e roteiro de reprodução das fichas que depende de arquivos internos (bronze e silver): o leitor refaz o número pelo CSV, não pelo roteiro. Quatro páginas.
- (tecnico) Selo Observado em séries que as próprias páginas descrevem como derivadas ou reconstituídas (EAR, ENA, afluência), com a definição do selo só na dica; não tratei como bloqueio porque o texto ao lado diz que não é medição direta. P017, P018 e P020.
- (tecnico) As 18 tabelas de dados de gráfico (recolhidas, nas quatro páginas) não têm exportação; a série mensal do SIN em MWmês desde 2000 só existe na tabela recolhida e no JSON da gold.
- (tecnico) Desempenho medido só em laboratório; o instrumento do projeto não mede LCP, INP e CLS, não há coleta de campo e o protocolo de medição não está documentado. Quatro páginas.
- (tecnico) Provisoriedade dita de modos diferentes: P017 e P018 avisam que o ONS revisa os dias recentes, P019 marca preliminar por dia, P020 não avisa embora sua janela caia na zona de revisão.
- (tecnico) Referência da data (faixa p10 a p90) só na EAR do SIN: a evolução da ENA (P018) e o volume dos reservatórios (P020) não a trazem.
- (tecnico) Comparações entre produtos ou versões diferentes (MLT por versão em P018; IMERG Late e GEOS-IT contra climatologia final e ECMWF contra IMERG em P019) têm aviso, mas nenhuma estima o viés.
- (tecnico) Dois descuidos de definição que vêm de interpretar o dicionário do ONS: MLT armazenável (P018) e parte própria como própria usina (P020).

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística por agente em Chromium headless com Playwright, sem participantes, sem tempos e sem leitor de tela real (NVDA, JAWS e VoiceOver não testados). Firefox, Safari, toque em aparelho real, impressão e rede lenta não foram avaliados. Os modos Analisar e Auditar das páginas 2 a 4 foram vistos só em texto, visoes.json e objetivo.json; na página 1 vi seis trechos de Auditar em 1440 e a tabela de Analisar em 390. O objetivo.json traz 360, 390, 768 e 1440 (sem 320); medi 320 por conta própria, só rolagem horizontal nas quatro páginas e capturas da página 1. Contraste medido para texto HTML e SVG; os preenchimentos do mapa só por inspeção visual. Conferi consistência aritmética visível (somas, diferenças, janelas), não a exatidão das fontes, que cabe ao avaliador técnico. Nenhum bloqueio da seção 7 pôde ser comprovado do ponto de vista do produto, o que não substitui a checagem técnica. A tarefa T5 foi inspecionada nas quatro páginas, mas só a raiz a cumpre por inteiro; as demais cumprem a parte da tarefa da família que lhes cabe, e as notas de C levam isso em conta.
- (tecnico) Avaliei o estado servido em http://localhost:3100 (commit d616ae877) lendo o repositório no mesmo SHA, sem build, instalação nem execução de testes (os testes foram lidos e contados: 88 de vitest e 83 de unittest do módulo). Fontes primárias abertas: arquivos do ONS no S3 (EAR e ENA por subsistema, EAR por REE, EAR por bacia, EAR por reservatório, dados hidráulicos, cadastro, ENA por reservatório), CKAN e dicionários do ONS, relatórios do PMO de setembro e julho de 2026, glossário do ONS Dados Relevantes 2010 (1 MWmês igual a 720 MWh), NASA POWER (IMERG_PRECTOT e T2M) e Open-Meteo (rodada de 30/09/2026). Os arquivos do ONS que baixei são de 08 e 09/10/2026, uma semana depois da captura da página (30/09): jan a ago/2026 são idênticos aos publicados e as diferenças aparecem só nas três últimas semanas, como revisão do ONS; por isso também refiz tudo com os CSV da própria página, que reproduzem exatamente. Não consegui abrir o INMET deste ambiente (sem resposta), nem os arquivos bronze e silver do projeto. Não testei leitor de tela nem desempenho de campo; as medidas de carga, LCP e CLS são de laboratório (Chromium headless local, uma execução por página, com e sem CPU 4x e 1,6 Mbps) e não valem como experiência real. Não refiz a faixa sazonal das 23 bacias nem da ENA por REE e bacia. Arquivos temporários ficaram em saida/tmp_tecnico_U03, com os downloads em pastas separadas e os scripts à parte.

