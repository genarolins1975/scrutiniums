# Correções pedidas pelas avaliações independentes: unidade U10

Fonte: produto em /tmp/claude-0/-home-user-scrutiniums/fdb6f8f5-b80e-56ed-ab31-342c1b46c73d/scratchpad/tmp_u10p. Meta: nota igual ou superior a 9 em cada critério, sem bloqueio.

| Página | Critérios abaixo da meta | Bloqueios |
| --- | --- | --- |
| `/perdas` | 7 | 0 |
| `/perdas/composicao` | 7 | 1 |
| `/perdas/custo-e-contexto` | 7 | 1 |
| `/perdas/regulatorio` | 7 | 1 |

## `/perdas`

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

## `/perdas/custo-e-contexto`

### Bloqueios

- (produto) {"tipo": "divergência entre gráfico, tabela e exportação", "descricao": "O total na ponta da barra difere da coluna 'Perdas' da tabela em 23 de 80 distribuidoras (até 0,01 R$/MWh): CERPRO tem 14,64 na barra e 14,65 na tabela, no CSV e na frase de abertura. A página explica por arredondamento em nota, mas mantém dois valores para o mesmo item.", "evidencia": "texto_entender.txt linhas 21 e 33; captura própria do gráfico expandido (CERPRO 14,64); CSV perdas-custo-tarifa-b1_completo (14.65)."}

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

## `/perdas/regulatorio`

### Bloqueios

- (produto) {"tipo": "barreira em tarefa essencial", "descricao": "A comparação de distribuidoras com a referência regulatória, parte essencial da tarefa da família, não pode ser feita nesta publicação: realizado contra regulatório de não técnicas aparece como 'Indisponível nesta publicação' (acesso à ANEEL recusado em 30/09/2026) e, para técnicas, 'Não se aplica' por construção. O site documenta o bloqueio externo e não mostra valor de reserva, mas a página segue incompleta para a tarefa.", "evidencia": "texto_entender.txt linhas 46 a 51; texto_auditar.txt, bloco 'Bloqueios externos'."}

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

## Limites declarados pelos avaliadores

- (produto) Inspeção heurística feita por agente em Chromium headless 1194 contra http://localhost:3101 (commit cbb5fbfeb), sem leitor de tela real, sem Firefox ou Safari (o salto ao topo foi medido só no Chromium), com toque emulado e sem teste com pessoas. As pastas de evidência trazem só parte das fatias de 390 px (faltam, por exemplo, 02, 04 e 06 de 07 em perdas e 03 de 05 em composição e custo); usei capturas próprias do mesmo servidor para as demais. O objetivo.json traz 360 e não 320 px e teclado só em 390 e 1440; medi 320 e 360 por conta própria (overflow, alvos, capturas) e rodei o axe-core do repositório em 1440 e 390, com 'contraste incompleto' em nós de gráfico. Não recebi os códigos P0xx de painel por rota, então 'paineis' está vazio. Não li avaliações anteriores. Correção numérica e rastreabilidade ficam com o avaliador técnico; conferi só, pelo CSV aberto, mediana, extremos, agregado e a divisão técnica e não técnica de 2025, que bateram com a página.

