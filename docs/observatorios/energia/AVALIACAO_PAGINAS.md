# Avaliação das páginas do observatório

Gerado por `scripts/energia_avaliacao.py` a partir de `public/energia/gold/avaliacao.json` (rodada 2026-10-07-r4, inspeção de 07/10/2026, rubrica 1.0). Não editar à mão: a página `/setor-eletrico/metodologia/avaliacao` lê o mesmo arquivo e mostra a evidência de cada nota.

A escala é uma ferramenta de revisão, não uma certificação externa. Nota só existe com evidência medida ou revisão registrada; dimensão não testada fica como não avaliada (n.av.) e não satisfaz o aceite; dimensão que não se aplica ao tipo de página fica como não aplicável (n.ap.) e sai do cálculo ponderado. Toda nota é truncada em uma casa decimal.

## Resultado da rodada

- Páginas avaliadas: 94 (de 368 rotas construídas; as famílias dinâmicas foram amostradas, ver limites).
- Nota ponderada média: 8,3.
- Páginas que atendem a meta de produto (todas as dimensões a partir de 9,0, didatismo e qualidade visual a partir de 9,5, nenhuma dimensão aplicável não avaliada, nenhum defeito crítico): 0 de 94.
- Páginas com todas as dimensões aplicáveis avaliadas: 94 de 94.
- Defeitos abertos: 49 (críticos 0, altos 4, médios 33, baixos 12); corrigidos desde a rodada anterior: 10.
- Jornadas da seção 15.2: 10 cumpridas, 0 interrompidas, 0 com falha, de 10 (roteiro por script, sem participante humano).

## Por dimensão

| Dimensão | Peso | Meta | Avaliadas | Não avaliadas | Não aplicáveis | Média | Mínimo | Atendem a meta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Didatismo | 15% | 9,5 | 94 | 0 | 0 | 6,9 | 4,5 | 0 de 94 |
| Qualidade visual | 12% | 9,5 | 94 | 0 | 0 | 7,4 | 6,0 | 0 de 94 |
| Navegação e usabilidade | 10% | 9,0 | 94 | 0 | 0 | 9,2 | 9,0 | 94 de 94 |
| Interatividade | 8% | 9,0 | 88 | 0 | 6 | 9,9 | 9,5 | 88 de 88 |
| Acessibilidade | 7% | 9,0 | 94 | 0 | 0 | 9,0 | 9,0 | 94 de 94 |
| Completude | 12% | 9,0 | 94 | 0 | 0 | 8,7 | 3,0 | 57 de 94 |
| Correção técnica e metodológica | 15% | 9,0 | 94 | 0 | 0 | 7,9 | 5,5 | 24 de 94 |
| Rastreabilidade | 10% | 9,0 | 94 | 0 | 0 | 9,3 | 4,5 | 87 de 94 |
| Atualidade e confiabilidade operacional | 6% | 9,0 | 81 | 0 | 13 | 7,9 | 5,4 | 12 de 81 |
| Desempenho e manutenção | 5% | 9,0 | 94 | 0 | 0 | 8,7 | 7,0 | 84 de 94 |

## Evolução entre rodadas

A comparação só vale para dimensões avaliadas nas duas rodadas: uma média que inclui a revisão visual não se compara com outra que não a inclui.

| Rodada | Data | Páginas | Dimensões com nota | Nota ponderada média das dimensões avaliadas | Atendem a meta | Defeitos crítico/alto/médio/baixo | Jornadas cumpridas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-07-r1 | 07/10/2026 | 89 | 8 de 10 | 8,4 | 0 | 0/12/85/12 | 8 |
| 2026-10-07-r2 | 07/10/2026 | 94 | 10 de 10 | 8,0 | 0 | 0/9/72/12 | 10 |
| 2026-10-07-r3 | 07/10/2026 | 94 | 10 de 10 | 8,2 | 0 | 0/4/34/12 | 10 |
| 2026-10-07-r4 | 07/10/2026 | 94 | 10 de 10 | 8,3 | 0 | 0/4/33/12 | 10 |

| Rodada | Didat. | Visual | Naveg. | Interat. | Acess. | Compl. | Correção | Rastr. | Atual. | Desemp. |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-07-r1 | n.av. | n.av. | 9,1 | 9,5 | 7,6 | 8,4 | 7,8 | 9,0 | 7,8 | 8,7 |
| 2026-10-07-r2 | 6,8 | 6,9 | 9,2 | 9,4 | 7,7 | 8,5 | 7,8 | 9,0 | 7,9 | 8,7 |
| 2026-10-07-r3 | 7,0 | 7,2 | 9,2 | 9,9 | 9,0 | 8,6 | 7,9 | 9,3 | 7,9 | 8,7 |
| 2026-10-07-r4 | 6,9 | 7,4 | 9,2 | 9,9 | 9,0 | 8,7 | 7,9 | 9,3 | 7,9 | 8,7 |

O que mudou no método entre as rodadas:

- Rodada 2026-10-07-r1 recalculada: o instrumento ainda não registrava se o título do painel é uma pergunta, e a rubrica contava esse item como ausente em todos os painéis. A rodada foi recalculada com o item fora do cálculo, que é como a regra passou a tratar item não medido. As demais notas não mudaram.
- Rodada 2026-10-07-r2 recalculada: o instrumento ainda não registrava se o título do painel é uma pergunta, e a rubrica contava esse item como ausente em todos os painéis. A rodada foi recalculada com o item fora do cálculo, que é como a regra passou a tratar item não medido. As demais notas não mudaram.
- Rodada 2026-10-07-r3: o título em forma de pergunta passou a ser medido (antes o instrumento não o registrava) e o texto do título é lido também nos painéis com título de nível 4; o item só entra no cálculo quando medido
- Rodada 2026-10-07-r3: o link no meio de uma frase, mesmo dentro de bloco sem parágrafo, e o glossário marcado dentro de uma frase passam pela exceção de alvo de toque do WCAG 2.5.8 (a r2 só aceitava parágrafo, item de lista e célula)
- Rodada 2026-10-07-r3: o botão Copiar link e a ficha Comprove têm até três tentativas, porque o primeiro toque pode chegar antes de o componente estar ativo; o resultado registra quando o clique do navegador expirou e só o clique por script funcionou (a página de CEMIG-D, a única em que isso ocorreu, foi medida de novo com o instrumento final e substituiu a medição anterior da rodada)
- Rodada 2026-10-07-r3: o rodapé do observatório e a linha de referência dos módulos passam a usar os rótulos Fontes e datas de referência, que o instrumento reconhece como declaração de fonte e de data
- Rodada 2026-10-07-r3: vocabulário de engenharia no texto do leitor em Entender passou a ser registrado como evidência de didatismo, sem dedução de nota
- Rodada 2026-10-07-r4: as capturas de leitura entregues aos revisores passam a ser feitas por modo próprio do instrumento (--limpas 1): a página carrega, é rolada como um leitor a rolaria, as tabelas voltam ao início e só então vêm a primeira dobra, a página inteira e o texto, sem teste de teclado nem clique antes. Nas rodadas 1 a 3 a captura vinha depois do teste de teclado, que deixava tabelas largas roladas até o fim. A mesma versão do site foi revisada duas vezes pelos nove revisores, com a captura antiga e com a limpa: didatismo 6,91 contra 6,90 e qualidade visual 7,40 contra 7,44, de modo que o efeito da mudança de captura ficou abaixo de 0,1 ponto e a comparação com a rodada 3 não depende dela. A rodada registra a revisão sobre a captura limpa
- Rodada 2026-10-07-r4: as jornadas J3, J4 e J7 abrem a tabela recolhida de Entender pelo botão Ver a tabela completa antes de ler ou filtrar (no teclado, J7 alcança o botão com Tab e o abre com Enter), e J9 abre os detalhes técnicos da ficha do conjunto; o clique entra na contagem de interações
- Rodada 2026-10-07-r4: o exercício de controles, sem mudança de código, passa a alcançar os botões novos de recolher a tabela e de mostrar todas as categorias do gráfico, que não existiam na rodada 3

Defeitos corrigidos desde a rodada anterior:

- (medio) itens ausentes da anatomia do painel: h1 único com abertura; limite de leitura declarado; caminho seguinte
- (baixo) HTML de 1.006 KB, acima da meta de 600 KB
- (baixo) HTML de 623 KB, acima da meta de 600 KB
- (baixo) HTML de 637 KB, acima da meta de 600 KB
- (baixo) HTML de 645 KB, acima da meta de 600 KB
- (baixo) HTML de 665 KB, acima da meta de 600 KB
- (baixo) HTML de 676 KB, acima da meta de 600 KB
- (baixo) HTML de 713 KB, acima da meta de 600 KB
- (baixo) HTML de 821 KB, acima da meta de 600 KB
- (baixo) HTML de 876 KB, acima da meta de 600 KB

## Por entrega (média das páginas de cada módulo)

| Entrega | Págs. | Didat. | Visual | Naveg. | Interat. | Acess. | Compl. | Correção | Rastr. | Atual. | Desemp. | Ponderada | Atendem |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Página inicial | 1 | 7,5 | 7,5 | 10,0 | 10,0 | 9,0 | 10,0 | 9,0 | 9,5 | n.ap. | 9,0 | 8,9 | 0/1 |
| Visão geral | 1 | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 9,6 | 8,0 | 9,5 | 7,0 | 9,0 | 8,4 | 0/1 |
| Água e clima | 4 | 7,3 | 7,3 | 9,2 | 10,0 | 9,0 | 9,7 | 8,1 | 9,5 | 7,2 | 9,0 | 8,5 | 0/4 |
| Carga | 3 | 7,0 | 7,1 | 9,0 | 10,0 | 9,0 | 10,0 | 5,5 | 9,5 | 7,0 | 7,6 | 7,9 | 0/3 |
| Rede | 4 | 6,3 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,4 | 9,5 | 8,6 | 8,5 | 8,2 | 0/4 |
| PLD e previsões | 12 | 6,2 | 7,0 | 9,4 | 10,0 | 9,0 | 8,5 | 8,4 | 8,8 | 8,1 | 8,8 | 8,1 | 0/12 |
| Geração | 4 | 7,3 | 7,1 | 9,2 | 9,8 | 9,0 | 10,0 | 7,1 | 9,5 | 8,8 | 8,0 | 8,4 | 0/4 |
| Mercado | 4 | 7,6 | 7,7 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 8,1 | 9,0 | 8,6 | 0/4 |
| Conta de luz | 2 | 7,2 | 7,5 | 9,5 | 10,0 | 9,0 | 9,5 | 8,1 | 9,5 | 8,2 | 8,0 | 8,5 | 0/2 |
| Perdas | 4 | 6,8 | 7,8 | 9,2 | 10,0 | 9,0 | 7,4 | 7,3 | 9,5 | 9,0 | 9,0 | 8,2 | 0/4 |
| Qualidade | 1 | 8,0 | 8,0 | 10,0 | 10,0 | 9,0 | 9,8 | 8,0 | 9,5 | 8,9 | 7,0 | 8,8 | 0/1 |
| Inclusão energética | 5 | 7,8 | 7,8 | 9,0 | 10,0 | 9,0 | 8,7 | 7,7 | 9,5 | 5,4 | 9,0 | 8,3 | 0/5 |
| Transição e ambiente | 4 | 7,2 | 7,6 | 9,0 | 10,0 | 9,0 | 8,3 | 8,3 | 9,5 | 7,7 | 9,0 | 8,4 | 0/4 |
| Empresas | 12 | 6,9 | 7,2 | 9,1 | 10,0 | 9,0 | 9,1 | 7,5 | 9,4 | 8,4 | 9,0 | 8,3 | 0/12 |
| Expansão | 5 | 7,0 | 7,4 | 9,0 | 10,0 | 9,0 | 9,1 | 8,4 | 9,5 | 8,6 | 9,0 | 8,5 | 0/5 |
| Regulação | 3 | 6,8 | 6,5 | 9,0 | 10,0 | 9,0 | 8,6 | 8,3 | 8,8 | 8,3 | 8,3 | 8,1 | 0/3 |
| Território | 1 | 6,0 | 7,0 | 10,0 | 10,0 | 9,0 | 10,0 | 9,1 | 9,5 | 7,7 | 7,0 | 8,4 | 0/1 |
| Aprenda | 12 | 7,3 | 8,1 | 9,4 | 10,0 | 9,0 | 7,3 | 8,7 | 9,0 | n.ap. | 9,0 | 8,4 | 0/12 |
| Dados e metodologia | 12 | 6,0 | 7,4 | 9,3 | 10,0 | 9,0 | 7,7 | 7,5 | 9,5 | 7,3 | 9,0 | 7,9 | 0/12 |

## Jornadas de usuário (seção 15.2)

Execução de roteiro por script em Chromium headless. Cada passo verifica um fato observável (texto, URL, valor, arquivo baixado). Não é teste com pessoas.

| Jornada | Perfil | Resultado | Passos | Interações | Erros de console |
| --- | --- | --- | --- | --- | --- |
| J1 | Iniciante, sem vocabulário do setor, desktop 1440 | cumprida | 11 de 11 | 8 | 0 |
| J2 | Consumidor residencial de Minas Gerais, desktop 1440 | cumprida | 11 de 11 | 12 | 0 |
| J3 | Analista de mercado, desktop 1440 | cumprida | 8 de 8 | 5 | 0 |
| J4 | Pesquisador que reproduz números, desktop 1440 | cumprida | 10 de 10 | 12 | 0 |
| J5 | Professor de engenharia ou economia, desktop 1440 | cumprida | 12 de 12 | 10 | 0 |
| J6 | Leitor no celular (390 px de largura, toque, Chromium headless com emulação móvel) | cumprida | 19 de 19 | 21 | 0 |
| J7 | Leitor que usa só o teclado (desktop 1440 px; Tab, Shift+Tab, Enter, Espaço, setas e Esc) | cumprida | 18 de 18 | 168 | 0 |
| J8 | Leitor que recebe um endereço copiado de outra pessoa (desktop 1440 px, contexto de navegador novo) | cumprida | 11 de 11 | 37 | 0 |
| J9 | Leitor que precisa saber se uma lacuna é zero, atraso ou ausência da fonte (desktop 1440 px) | cumprida | 13 de 13 | 27 | 0 |
| J10 | Leitor que quer auditar o que foi previsto antes do resultado (desktop 1440 px, modo Auditar) | cumprida | 14 de 14 | 12 | 0 |

### J1: Iniciante: entender PLD versus tarifa e achar os dados dos dois lados

- ok: Abre a página inicial do Observatório e localiza a busca (h1 "Entenda a energia que move o Brasil"; campo de busca com o rótulo "Busque por pergunta, conceito, página ou distribuidora")
- ok: Digita "PLD" na busca e lê os resultados (8 resultados listados (página diz: "15 resultados; os 8 mais próximos:"); tipos vistos: PÁGINA, PAINEL, CONCEITO, PERGUNTA; CONCEITO leva a /setor-eletrico/aprenda/pld, PÁGINA leva a /setor-eletrico/pld)
- ok: Abre o conceito PLD pelo resultado da busca (URL /setor-eletrico/aprenda/pld; h1 "PLD Preço de Liquidação das Diferenças"; em uma frase: "Preço do Mercado de Curto Prazo, calculado pela CCEE diariamente para cada hora do dia seguinte e para cada submercado, com base no Custo Ma...")
- ok: Lê "Não confundir com" e confere o contraste entre PLD e tarifa (TE e TUSD) (Contraste: "O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora segue a TE e a TUSD, que a ANEEL homologa nos processos "; em "O que não se pode concluir": "O PLD não é a tarifa do consumidor atendido pela distribuidora: essa conta segue os v..."; links ao verbete de tarifa: 1)
- ok: Segue "ver no painel" do exemplo real e chega à página PLD (Exemplo no verbete: "Em 30/09/2026, o PLD horário do Sudeste/Centro-Oeste variou de R$ 57,31 a R$ 577,20/MWh"; URL /setor-eletrico/pld#hoje; h1 "PLD"; botão de retorno: "← Voltar ao verbete PLD")
- ok: Baixa o CSV do PLD e confere cabeçalho, linhas e último dia (Arquivo pld_horario.csv; cabeçalho data_hora_local;SE;S;NE;N; 50376 linhas de dados; primeira 2021-01-01T00:00;204.37;204.37;204.36;204.37; última 2026-09-30T23:00;99.03;99.02;99.02;99.03; HTTP 200 text/csv; charset=UTF-8)
- ok: Volta ao verbete pelo botão "Voltar ao verbete PLD" (URL /setor-eletrico/aprenda/pld#exemplo)
- ok: Segue o link "TE e TUSD" de "Não confundir com" até o verbete da tarifa (URL /setor-eletrico/aprenda/tarifa-te-tusd; h1 "TE e TUSD Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição"; contraste do lado da tarifa: "O PLD é o preço das diferenças liquidadas no Mercado de Curto Prazo. A conta do consumidor atendido pela distribuidora s..."; exemplo real: R$ 0,8212/kWh)
- ok: Segue "Ver no painel: Conta de luz: tarifa" até a página de dados da tarifa (URL /setor-eletrico/conta-de-luz#tarifa; h1 "Quanto custa a energia ao consumidor e o que compõe a conta?")
- ok: Baixa o CSV de tarifas e confere cabeçalho e linhas (Arquivo conta_tarifas_b1_vigentes.csv; colunas cnpj;sigla;nome;inicio_vigencia;fim_vigencia;ato;te_rs_mwh;tusd_rs_mwh;total_rs_mwh;total_rs_kwh...; 81 distribuidoras; primeira DMED a R$ 0.6176/kWh; HTTP 200 text/csv; charset=UTF-8)
- ok: Contabiliza as interações do leitor até os dois conjuntos de dados (8 interações a partir da home (digitação, cliques e dois downloads). PLD: página de dados na interação 3, arquivo na 4. Tarifa: página de dados na 7, arquivo na 8)
- atrito: A busca por PLD mostra 8 dos 15 resultados e nenhum é de tarifa: o verbete de tarifa só é alcançado dentro do verbete PLD, em Não confundir com.
- atrito: PLD e tarifa aparecem em unidades diferentes (R$/MWh e R$/kWh). O único CSV visível na página PLD em Entender é o horário, com cabeçalho sem unidade e decimal com ponto; o diário existe, mas fica oculto em Entender.
- limite: Roteiro por script confere que o contraste está escrito, que os links levam aos dados e que os arquivos baixam; não mede se uma pessoa sem vocabulário entende o texto.

### J2: Consumidor: achar a distribuidora e comparar perdas e qualidade

- ok: Abre a página inicial e digita CEMIG na busca (1 resultado(s): "DISTRIBUIDORACEMIG-D · CEMIG DISTRIBUICAO S.A MG · CNPJ 06.981.180/0001-16" (/setor-eletrico/empresas/cemig-d))
- ok: Abre a ficha da CEMIG-D e lê perdas, DEC, FEC e tarifa (Síntese: perdas 12,12%, DEC 8,98 h (limite 9,50), FEC 5,14 (limite 5,84), tarifa B1 R$ 903,29/MWh. Cartão de perdas: "PERDAS TOTAIS 12,12%da energia injetada 01/20" (sinal % repetido: não); botão "Comprove": 12,1%)
- ok: Lê como a ficha posiciona a distribuidora frente às pares (Perdas: posição 32 de 51 entre as concessionárias (ordem crescente); DEC: posição 17 de 33 entre as de porte grande; link para o comparador: sim)
- ok: Procura na ficha o link para Perdas e Qualidade com a distribuidora já escolhida (No nível Entender (padrão) o link para Perdas está visível (links visíveis para Perdas, Qualidade ou Conta de luz: 3); rótulos: Perdas, com o mapa por conjunto e município | Qualidade do serviço, com os conjuntos elétricos)
- ok: Abre Perdas pelo link da ficha e confere a distribuidora e o número (URL /setor-eletrico/perdas?d=06981180000116&tab.pag=2; "CEMIG-D (concessionária, MG): em 2025, perdas totais de 7.394.845 MWh, 12,12% da energia injetada de referência (60.989.117 MWh). A taxa subiu 0,89 p.p. em relação a 2024"; consulta com "Distribuidora: CEMIG-D"; 12,12% = ficha 12,12%)
- ok: Procura a CEMIG-D na tabela de Perdas e lê a classe e a variação (Linha CEMIG-D: taxa 12,12%, classe "10% a menos de 15%", variação 0,89 p.p., comparável. Contexto: faixa de 3,25% (EFLUL) a 43,19% (ÂMBAR AMAZONAS); posição ordinal escrita na página: não; contagem "1 de 123 linhas")
- ok: Volta à ficha e abre Qualidade pelo link da ficha (URL /setor-eletrico/qualidade?dist=06981180000116; "CEMIG-D: DEC acima do limite em 4 de 11 anos com valor e limite, de 2015 a 2025. Em 2025: 8,98 h para um limite de 9,50 h."; DEC 8,98 h e limite 9,50 h iguais aos da ficha)
- ok: Troca o indicador do gráfico para FEC e confere o número (URL /setor-eletrico/qualidade?dist=06981180000116&ind=fec; "CEMIG-D: FEC acima do limite em 0 de 11 anos com valor e limite, de 2015 a 2025. Em 2025: 5,14 interrupções para um limite de 5,84 interrupções."; FEC 5,14 e limite 5,84 iguais aos da ficha)
- ok: Abre a tabela de Qualidade, busca a CEMIG-D e lê limite, razão e posição no ranking (Linha CEMIG-D: dentro dos dois limites; DEC 8,98 h para limite 9,50 (razão 0,944); FEC 5,14 para limite 5,84 (razão 0,881); DGC no ranking 0,91, posição 31, porte grande)
- ok: Reabre a ficha e segue o link para o comparador de distribuidoras (URL /setor-eletrico/empresas/distribuidoras?dist.cmp=cemig-d#p037; comparador com a CEMIG-D já escolhida (1 de 4 selecionada); referência nacional de perdas: 14,75% (51 concessionárias))
- ok: Adiciona a COPEL-DIS ao comparador e lê perdas, tarifa, DEC e FEC lado a lado (Perdas CEMIG-D 12,12% contra COPEL-DIS 7,87%; tarifa B1 R$ 903,29 contra R$ 768,02/MWh; DEC menos limite: −0,52 h contra −0,97 h; FEC menos limite: −0,70 contra −1,16 interrupções)
- atrito: O botão Comprove do cartão de perdas da ficha diz 12,1%, enquanto o cartão e a página Perdas dizem 12,12%.
- atrito: Três noções de posição sem ponte entre elas: a ficha diz 32 de 51 (perdas) e 17 de 33 (DEC), a tabela da Qualidade mostra posição no ranking 31 sem o total, e Perdas não escreve posição. A tabela da Qualidade tem 1.812 px de largura num contêiner de 1.118 px, e duas colunas ficam fora da área visível a 1440 px.
- limite: Roteiro por script confere os números e a consistência entre páginas; não mede se o consumidor reconhece sua distribuidora pelo nome nem se entende DEC e FEC.

### J3: Analista: ler a variação do PLD, abrir a ficha e conferir período, fonte e versão

- ok: Abre o histórico do PLD e lê até quando vão os dados (h1 "Histórico e distribuição"; PLD até 30/09/2026 às 23h; carga do balanço do ONS até 28/09/2026 às 23h)
- ok: Lê os quatro números de destaque e o período de cada um (Média diária de 30/09/2026: R$ 135,25, período 30/09/2026, sem "Comprove este número" || Média temporal de ago/2026: R$ 128,12, período sem linha de período, sem "Comprove este número" || Ponderada pela carga do balanço, ago/2026: R$ 131,73, período 01/08/2026 00:00 a 31/08/2026 23:00, com "Comprove este número" || Ponderada pela carga sem MMGD, ago/2026: R$ 137,82, período 01/08/2026 00:00 a 31/0)
- ok: Identifica a variação entre set/2026 e ago/2026 e confere na tabela mensal (Média temporal do Sudeste/Centro-Oeste: set/2026 R$ 125,78 contra ago/2026 R$ 128,12, variação −2,34 R$/MWh (−1,8%), iguais no texto, no destaque e na tabela. Dia 30/09/2026: R$ 135,25, percentil 38,7 entre 150 dias de setembro de 2021 a 2025 (mediana R$ 247,81))
- ok: Procura o aviso de mês parcial e confere a linha de set/2026 na tabela (Aviso na página: "No mês em curso, as ponderadas usam só as horas com carga publicada (coluna “mesmas horas” da tabela) e podem mudar com as próximas publicações e revi..." Tabela em 09/2026: dias completos 30, mês parcial "não", 720 horas com PLD e 672 com carga do balanço, "ponderada nas mesmas horas" = não (em 08/2026: sim); filtro "Mês parcial" existe: sim)
- ok: Abre a ficha "Comprove este número" da ponderada pela carga do balanço de ago/2026 (Ficha aberta: "PLD médio de ago/2026 ponderado pela carga do balanço do ONS". Valor exibido R$ 131,73/MWh (igual ao destaque), valor de cálculo 131,73306792188131. Período da ficha "01/08/2026 00:00 a 31/08/2026 23:00" igual ao do destaque (01/08/2026 00:00 a 31/08/2026 23:00) e ao mês do rótulo (ago/2026, filtro "mês 2026-08"))
- ok: Lê na ficha a fonte, o arquivo (sha256), a fórmula e a versão (Fonte: CCEE; ONS · PLD_HORARIO; Balanço de Energia nos Subsistemas; 2 arquivos com sha256 (b8fc7539..., 81f6ecfc...); captura 29/09/2026, 23:20 (Brasília); fórmula "Σ PLD_h × carga_h ÷ Σ carga_h (carga_h > 0)"; versão energia-0.1.0, código eec0a3121e05+alterado, publicada em 01/10/2026, 03:54 (Brasília); aviso de código alterado fora do commit: sim)
- ok: Fecha a ficha com a tecla Esc e confere o retorno do foco (Ficha fechada (0 diálogos abertos); foco de volta em "Comprove este número: PLD médio de ago/2026 ponderado pela carga do balanço do ONS, R$ 131")
- ok: Abre a ficha da ponderada sem MMGD e compara período, valor, fonte e fórmula com a primeira (Ficha da ponderada sem MMGD: R$ 137,82/MWh, período "01/08/2026 00:00 a 31/08/2026 23:00" (o mesmo da outra ficha), fonte da carga "Carga Verificada" (a outra usa o Balanço de Energia), fórmula "Σ PLD_h × (global_h − MMGD_h) ÷ Σ (global_h − MMGD_h)", "a MMGD estimada fica fora do peso". Diferença para a ponderada pelo balanço: R$ 6,09/MWh, só pela escolha do peso)
- atrito: A linha de destaques mostra ago/2026, enquanto o texto de abertura e a média diária falam de set/2026 e 30/09. A média temporal, base da variação de set contra ago, não tem período escrito nem ficha Comprove, ao contrário das duas ponderadas.
- atrito: Em set/2026 a tabela diz Mês parcial: não (30 dias), mas as ponderadas usam 672 das 720 horas. O aviso está no texto de abertura, longe dos destaques, e fala de mês em curso.
- atrito: A ficha de prova tem dez seções e avisa que o código foi publicado com alterações fora do commit, o que pode impedir a reprodução pelo primeiro passo (git checkout).
- atrito: A tabela mensal do histórico vem recolhida em Entender: o leitor abre o botão Ver a tabela completa antes de conferir os números, um clique a mais que na rodada 3 (5 contra 4).
- limite: Roteiro por script confere que período, fonte e versão estão escritos e coerentes entre o número e a ficha; não avalia se um analista confiaria na evidência nem reproduz o cálculo da ficha.

### J4: Pesquisador: filtrar a série mensal do PLD, exportar e reproduzir agregados

- ok: Abre o histórico do PLD, localiza a tabela mensal e lê o KPI de ago/2026 (Tabela "PLD médio mensal, Sudeste/Centro-Oeste": "69 de 69 linhas", 13 colunas; KPI "Média temporal de ago/2026": R$ 128,12/MWh; botões BAIXAR CSV e BAIXAR XLSX)
- ok: Digita "2026" na busca da tabela e confere a contagem e o chip do filtro ("9 de 69 linhas"; 9 linhas, de 01/2026 a 09/2026; chip: "Remover filtro Busca: “2026”")
- ok: Aplica o filtro "Ponderada nas mesmas horas da temporal = sim" e confere o recorte ("8 de 69 linhas"; meses 01/2026, 02/2026, 03/2026, 04/2026, 05/2026, 06/2026, 07/2026, 08/2026 (09/2026 saiu); 2 chips: Remover filtro Busca: “2026” | Remover filtro Ponderada nas mesmas horas da temporal: sim)
- ok: Ordena por média temporal e confere o aria-sort e a ordem dos valores (aria-sort="ascending"; primeira linha 08/2026 com 128,12, última 02/2026 com 382,41; 8 valores em ordem crescente)
- ok: Baixa o CSV do recorte e confere linhas, cabeçalho e ordem com a tabela (Arquivo pld-mensal-se_busca-2026_mesmas-horas-sim_ordem-temporal-asc_v2026-09-30.csv; 8 linhas de dados = "8 de 69 linhas"; 13 colunas iguais às da tabela; mesma ordem e mesmos valores da média temporal; formato do arquivo: mês "2026-08" e decimal com ponto ("128.12"), na tela "08/2026" e "128,12")
- ok: Baixa o XLSX do mesmo recorte e confere as linhas da planilha (Arquivo pld-mensal-se_busca-2026_mesmas-horas-sim_ordem-temporal-asc_v2026-09-30.xlsx (16975 bytes, zip válido, abas 2); 8 linhas de dados = CSV; célula E2 = 128.12 igual à primeira linha do CSV)
- ok: Reproduz o KPI "média temporal de ago/2026" a partir do CSV e da série horária (KPI exibido R$ 128,12/MWh; linha 2026-08 do CSV exportado 128.12 (diferença 0); recalculado sobre 744 horas de pld_horario.csv (coluna SE) 128.1175; diferença para o KPI −0,0025 R$/MWh, só de arredondamento)
- ok: Reproduz a mediana e o percentil da média diária de 30/09/2026 a partir da série diária (Exibido: média de 30/09/2026 R$ 135,25, percentil 38,7, mediana R$ 247,81 (150 dias). Recalculado em pld_diario.csv (SE): média 135.2458, percentil 38.67 (fração de dias abaixo), mediana 247.8111; diferenças só de arredondamento)
- ok: Remove os dois filtros pelos chips e confere que voltam as 69 linhas (Depois do primeiro chip: "68 de 69 linhas"; depois do segundo: "69 de 69 linhas"; chips restantes: 0)
- ok: Pagina a tabela inteira e confere que o CSV traz todas as linhas, não só a página (Rodapé: "Página 2 de 3 · linhas 26 a 50" (25 linhas na tela); "69 de 69 linhas"; pld-mensal-se_completo_ordem-temporal-asc_v2026-09-30.csv com 69 linhas de dados, isto é, todas as páginas)
- atrito: O arquivo exportado difere da tela: mês 2026-08 contra 08/2026, decimal com ponto contra vírgula, separador ponto e vírgula com BOM. Compará-los exige conversão.
- atrito: O filtro Mês parcial só tem a opção não, e não filtra nada nesta base.
- atrito: A tabela mensal vem recolhida em Entender; o botão Ver a tabela completa soma um clique à jornada (12 contra 11 na rodada 3). Em Analisar a tabela já abre inteira.
- limite: Roteiro por script reproduz a média temporal, a mediana e o percentil a partir dos arquivos oferecidos na página; as médias ponderadas pela carga não foram reproduzidas porque dependem da carga horária do ONS, que a página não oferece como arquivo.

### J5: Professor: levar um conceito de água e um de preço, com exemplo real e gráfico, para a sala

- ok: Abre a página Aprenda e localiza os verbetes de água e de preço (h1 "Como funciona o sistema elétrico brasileiro, conceito a conceito"; 45 de 48 verbetes conferidos na fonte primária; 48 cartões de verbete; cartões EAR, PLD e a trilha "Água, operação e preço" presentes)
- ok: Abre o verbete EAR e lê a definição, o exemplo real com data e número e a natureza do dado (Em uma frase: "Energia associada ao volume de água nos reservatórios que pode ser convertido em..."; exemplo real: 28/09/2026, Sudeste/Centro-Oeste com 56,9% da EAR máxima (observado), mediana da data 49,5%; unidade: MWmês ou percentual da EAR máxima)
- ok: Segue "ver no painel" do exemplo da EAR e confere gráfico, tabela, unidade e botão de retorno (Botão de retorno: "← Voltar ao verbete EAR"; 7 gráfico(s) com nome acessível, o primeiro: "EAR do SIN no último ano, a cada 14 dias, com a faixa do 10º ao 90º percentil da mesma data. Use as "; tabela equivalente com 27 linhas; unidade: "MWmês (energia armazenada; 1 MWmês = 720 MWh) e % da EAR máxima do pró")
- ok: Compara o número do exemplo do verbete com o que o painel mostra (Verbete: 28/09/2026, 56,9%. Painel (padrão): 29/09/2026, Sudeste/Centro-Oeste 56,65% e SIN 61,5% em 29/09/2026. O número do exemplo não é o mostrado no painel (data do painel 29/09/2026, diferença de −0,25 p.p.); "56,9%" aparece em algum texto da página: não)
- ok: Volta ao verbete pelo botão "Voltar ao verbete EAR" (URL /setor-eletrico/aprenda/ear#exemplo; h1 "EAR Energia Armazenada")
- ok: Segue "Nas trilhas" do verbete EAR até o passo 2 da trilha Água, operação e preço (URL /setor-eletrico/aprenda/trilhas/agua-operacao-preco#passo-armazenamento; passo 2 de 6 "A água guardada": EAR do SIN 61,5% da EAR máxima em 29/09/2026 (escopo SIN, não Sudeste/Centro-Oeste como no verbete))
- ok: Vai ao passo 5, o preço de curto prazo, pelo índice da trilha e lê o número do observatório (Passo 5 de 6: em 30/09/2026, PLD horário do Sudeste/Centro-Oeste de R$ 57,31 a R$ 577,20/MWh, média simples das 24 horas R$ 135,25/MWh)
- ok: Segue "ver no painel" do passo 5 até o PLD e confere que o painel mostra os mesmos números (Botão de retorno: "← Voltar à trilha Água, operação e preço, passo 5"; cartão Sudeste/Centro-Oeste: média R$ 135,25 em 30/09/2026, faixa horária R$ 57,31 a R$ 577,20, iguais ao texto da trilha. Ao chegar (rolagem 4975 px): gráfico horário não está à vista; abas de período cobertas pelo botão fixo: Dia 30/09, 7 dias, 30 dias, 12 meses)
- ok: Confere o gráfico do PLD: nome acessível, unidade e a tabela equivalente com o pico do exemplo (Gráfico: "PLD dos quatro submercados, dia 30/09. Use as setas para percorrer os pontos."; tabela equivalente com 24 horas, legenda "PLD dos quatro submercados, dia 30/09, em R$/MWh", colunas Hora | Sudeste/Centro-Oeste (R$/MWh)...; pico R$ 577,20 às 30/09 18h (Sudeste/Centro-Oeste); média das 24 linhas 135,25 contra R$ 135,25 no texto)
- ok: Lê no painel o que o professor leva para a sala: interpretação, "o que não é possível concluir" e fonte (Como interpretar: "Alterne os períodos. O dia de referência, 7 e 30 dias mostram horas; 12 meses mostra média..."; O que não é possível concluir: "a posição no histórico não diz para onde o preço vai, e a faixa horária mostra os extremos..."; Fonte: CCEE, PLD_HORARIO; médias e posição calculadas pela Scrutiniums.; ações do painel: baixar CSV 1, exportar o gráfico como imagem 0)
- ok: Volta à trilha pelo botão "Voltar à trilha Água, operação e preço, passo 5" (URL /setor-eletrico/aprenda/trilhas/agua-operacao-preco#passo-pld; o passo 5 está na janela de leitura)
- ok: Abre o verbete PLD pela trilha e confere que o exemplo real é o mesmo número (URL /setor-eletrico/aprenda/pld; exemplo real em 30/09/2026: R$ 57,31 a R$ 577,20/MWh, média R$ 135,25/MWh, igual ao da trilha e do painel; "O PLD não é a tarifa do consumidor" em "O que não se pode concluir": sim)
- atrito: O verbete EAR dá 56,9% (Sudeste/Centro-Oeste, 28/09/2026), o painel de Água e clima abre em 29/09/2026 com 56,65% e a trilha usa 61,5% do SIN. São datas e escopos diferentes, todos escritos, mas o professor encontra três números de EAR para o mesmo conceito.
- atrito: Ao chegar ao PLD vindo da trilha, o gráfico horário não está à vista, e o botão fixo Voltar à trilha cobre as abas de período.
- atrito: O painel só oferece Baixar CSV e Sobre este dado: nenhum controle leva o gráfico como imagem, e a tabela equivalente vem fechada.
- limite: Roteiro por script confere que exemplo, gráfico, tabela, unidade, fonte e caminho de volta existem e batem entre si; não avalia se o material serve didaticamente nem se o gráfico fica legível projetado.

### J6: Usuário de celular escolhe uma região, lê o detalhe, compara e remove o filtro sem perder o contexto

- ok: Abre Minha região no celular e confere o título e a ausência de rolagem horizontal (h1 "O que acontece na minha região?"; largura da página 390 px para janela de 390 px (sem rolagem horizontal))
- ok: Toca em ANALISAR no seletor de profundidade e confere o modo na URL (URL /setor-eletrico/territorio?modo=analisar; alvo 110 por 44 px; aria-checked=true)
- ok: Toca em Minas Gerais no mapa de UFs e confere a escolha na URL (URL /setor-eletrico/territorio?modo=analisar&sel=uf:MG; região tocada com 80 por 66 px; a ficha começa 285 px abaixo do fim do mapa (topo da ficha a 864 px do topo da janela de 780 px), fora da tela)
- ok: Mede o tamanho de toque de cada UF no mapa (só medição, sem tocar): quantas regiões ficam abaixo de 24 px (7 de 27 UFs têm o menor lado do contorno abaixo de 24 px no mapa a 390 px: DF 7 por 4, AL 23 por 13, SE 13 por 16, RN 26 por 16, ES 16 por 25, PB 29 por 17, RJ 28 por 19; o botão + do mapa aproxima na seleção. As tocadas (MG 79 por 65 px) ficam acima de 24 px)
- ok: Rola até a ficha e lê Minas Gerais: submercado, municípios, capacidade e PLD do dia (Minas Gerais no submercado Sudeste/Centro-Oeste; 853 municípios; 25.257,3 MW em 943 usinas; PLD médio do dia 30/09/2026: R$ 135,25/MWh (do submercado, não da UF))
- ok: Toca em BA na tabela de UFs para comparar e lê a ficha da Bahia (URL /setor-eletrico/territorio?modo=analisar&sel=uf:BA; alvo 96 por 44 px; a ficha da Bahia ficou a -1766 px do topo da janela logo após o toque (acima da tela); Nordeste; 417 municípios; 22.031,2 MW em 677 usinas; PLD 30/09/2026: R$ 124,93/MWh)
- ok: Compara as duas fichas: municípios, capacidade e submercado de cada UF (MG tem 853 municípios e a BA 417 (diferença 436); capacidade em operação MG 25.257,3 MW contra BA 22.031,2 MW (diferença 3.226,1 MW); submercados Sudeste/Centro-Oeste e Nordeste; PLD do dia MG R$ 135,25/MWh e BA R$ 124,93/MWh)
- ok: Toca em Limpar a escolha e confere que o modo e a posição na página continuam (URL /setor-eletrico/territorio?modo=analisar; rolagem 5285 px antes e 5285 px depois; ficha voltou a "NENHUMA ESCOLHA"; alvo 117 por 44 px)
- ok: Usa o botão voltar do navegador e confere que a escolha da Bahia volta (URL /setor-eletrico/territorio?modo=analisar&sel=uf:BA; ficha mostra de novo a Bahia com 417 municípios)
- ok: Varre a página de Minha região: rolagem horizontal e textos espremidos (largura 390 px para janela de 390 px; 0 bloco(s) de texto com menos de 120 px de largura)
- ok: Abre Perdas, toca em ANALISAR e escolhe o ano 2024 e o indicador Perdas técnicas (URL /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica; ano "2024"; indicador "Perdas técnicas (% da energia injetada)")
- ok: Filtra a tabela por UF = MG (toca em UF, marca MG, fecha o painel) e lê o chip e a contagem (antes "123 de 123 linhas", depois "2 de 123 linhas"; caixa tocada com 290 por 44 px; URL /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica&tab.f.ufs=MG; chip "Remover filtro UF: MG" presente)
- ok: Toca no botão da linha CEMIG-D e lê a ficha da distribuidora (URL /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica&tab.f.ufs=MG&d=06981180000116; alvo 101 por 88 px; ficha da CEMIG-D diz "em 2025, perdas totais de 7.394.845 MWh, 12,12% da energia injetada", com a página no ano 2024)
- ok: Compara com COELBA e COPEL-DIS no comparador e lê os valores do último ano (2 de 4; 2025: COELBA 18,11%; COPEL-DIS 7,87%; Concessionárias (agregado) 14,75%; o comparador mostra a taxa de perdas totais (3 séries) embora a página esteja no indicador "Perdas técnicas (% da energia injetada)")
- ok: Remove o filtro de UF pelo chip e confere modo, ano, indicador, escolha, comparação e posição (alvo do chip 96 por 44 px; contagem "123 de 123 linhas"; ano "2024", indicador "Perdas técnicas (% da energia injetada)", modo analisar, escolha d=06981180000116 e comparação cmp mantidos; rolagem 7095 para 7095 px)
- ok: Usa o botão voltar e confere que o filtro de UF = MG volta (URL /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica&tab.f.ufs=MG&d=06981180000116&cmp=15139629000194,04368898000106; chip "Remover filtro UF: MG" de volta)
- ok: Varre Perdas: rolagem horizontal e textos espremidos (largura 390 px para janela de 390 px; 0 bloco(s) de texto com menos de 120 px de largura)
- ok: Confere o conjunto: alvos tocados com pelo menos 24 px e nenhuma rolagem horizontal nas páginas medidas (16 alvos tocados, o menor foi ANALISAR (nível de profundidade) com 110 por 44 px; páginas medidas territorio e perdas sem rolagem horizontal)
- ok: Confere a legibilidade: nenhum bloco de texto espremido (menos de 120 px de largura) nas páginas visitadas (2 páginas varridas, nenhum bloco de texto com menos de 120 px de largura)
- atrito: O efeito do toque fica fora da vista: no mapa a ficha vem 2.909 px abaixo, e na tabela, 1.766 px acima. O único retorno visível é o contorno e o balão no mapa.
- atrito: Em Perdas, com ano 2024 e indicador Perdas técnicas, a ficha da CEMIG-D diz que em 2025 as perdas totais foram de 12,12% e o comparador traz a taxa de perdas totais de 2003 a 2025, sem respeitar o ano e o indicador escolhidos.
- atrito: No mapa, 7 das 27 UFs têm o menor lado abaixo de 24 px (DF 7 por 4 px, AL 23 por 13 px, entre outras); a alternativa em tabela tem alvos de 44 px.
- limite: Emulação de celular no Chromium (toque e viewport), não aparelho real; roteiro por script, sem pessoas.

### J7: Usuário por teclado alcança o campo do mapa e a tabela equivalente e chega aos mesmos dados que o mouse

- ok: Abre Minha região e percorre com Tab até o campo de busca do mapa, conferindo foco visível e ordem (19 Tabs até o campo "Município, distribuidora, UF ou submercado"; 19 paradas, todas com indicador de foco (contorno 2px e sombra); primeira "Pular para o conteúdo", ordem do documento respeitada, nenhum tabindex positivo, foco nunca no corpo)
- ok: Volta uma parada com Shift+Tab e avança com Tab: o foco não fica preso (Shift+Tab foi para "COMPROVE ESTE NÚMERO : USINAS COM TODOS OS MUNICÍPIOS DECLAR" e Tab voltou ao campo de busca (sombra))
- ok: Digita minas no campo: a lista abre com Minas Gerais na frente (aria-expanded=true; 30 opções; primeira "Minas Gerais UF MG")
- ok: Pressiona Esc: a lista fecha, o foco fica no campo e nada foi escolhido (aria-expanded=false, nenhuma opção visível, foco no campo, URL /setor-eletrico/territorio sem escolha)
- ok: Abre a lista com a seta para baixo, percorre as opções com setas e escolhe Minas Gerais com Enter (opção 1 "Minas Gerais UF MG", opção 2 "Minas Novas município · MG", volta à 1; Enter escolheu e a URL ficou /setor-eletrico/territorio?sel=uf:MG; ficha com 1535 caracteres)
- ok: Repete a escolha de Minas Gerais com clique na tabela e compara URL e texto da ficha com a do teclado (URL igual (?sel=uf:MG) e ficha idêntica (1535 caracteres) nas duas formas)
- ok: Segue com Tab até a tabela equivalente e escolhe BA com Espaço (25 Tabs do campo de busca até o botão BA (mais 19 até o campo, 44 no total desde o topo); Espaço escolheu: URL /setor-eletrico/territorio?sel=uf:BA, aria-pressed=true)
- ok: Repete a escolha da Bahia com clique e compara URL e ficha com a do teclado (sel=uf:BA nas duas formas; ficha idêntica (1523 caracteres))
- ok: Usa o link Pular para o conteúdo e conta os Tabs até o campo do mapa (Enter no link levou o foco para main#conteudo (hash #conteudo); depois 5 Tabs até o campo, contra 19 sem o salto)
- ok: Segue até o filtro de submercado da tabela, abre com Enter, marca uma caixa com Espaço e fecha com Esc (2 Tabs do campo do mapa até o filtro; Enter abriu, Tab foi à caixa "Nordeste 8 linhas", Espaço marcou: URL ganhou ter.uf.f.submercado=Nordeste, contagem "8 de 27 linhas", chip "Remover filtro Submercado (cor no mapa): Nordeste"; Esc fechou e o foco voltou ao título do filtro; clique deu o mesmo parâmetro e a mesma contagem)
- ok: Abre Perdas e percorre com Tab até o campo de busca do mapa, conferindo foco visível e ordem (30 Tabs até o campo "Sigla, nome, UF ou município"; 30 paradas, todas com indicador de foco; ordem do documento respeitada)
- ok: Digita cemig, desce com a seta e escolhe a distribuidora com Enter (opção "CEMIG-D · CEMIG DISTRIBUIÇÃO S.A, MG (distribuidora) 12,12%"; d=06981180000116; ficha: em 2025, perdas totais de 7.394.845 MWh, 12,12%)
- ok: Escolhe a mesma distribuidora com clique na tabela e compara a ficha com a do teclado (d=06981180000116 nas duas formas; ficha idêntica (824 caracteres). A URL do teclado traz tab.pag=2, a do mouse traz tab.q=CEMIG)
- ok: Abre Comprove este número com Enter, confere onde cai o foco e fecha com Esc (24 Tabs até "COMPROVE ESTE NÚMERO : TAXA DE PERDAS TOTAIS "; Enter abriu o diálogo "COMPROVE ESTE NÚMERO Taxa de perdas totais na distribuição 1" com o foco em "Fechar"; Esc fechou e o foco voltou ao botão)
- ok: Em Diferenças regionais, alcança o seletor Par em destaque com Tab e troca para Sul e Norte só com setas (24 Tabs até o seletor; 4 setas para baixo; URL /setor-eletrico/pld/diferencas-regionais?modo=analisar&hora.t.pag=7&par=S_N; indicador: "HORAS SEPARADAS: SUL E NORTE 35,53%das horas Últimos 12 meses ◆ NATUREZA DO DADO: CALCULAD")
- ok: Escolhe o mesmo par com clique na tabela e compara URL e indicador (par=S_N nas duas formas; indicador idêntico: "HORAS SEPARADAS: SUL E NORTE 35,53%das horas Últimos 12 meses ◆ NATUREZA DO DADO")
- ok: Entra na matriz de pares com Tab, percorre as células com setas e confere uma célula com a tabela equivalente (5 Tabs até a matriz; duas setas para a direita levaram a "17,8%, classe 10,0 a menos de 20,0", seta para baixo a "33,1%, classe 30,0 a menos de 40,0", End a "35,5%, classe 30,0 a menos de 40,0", Home a "13,0%, classe 10,0 a menos de 20,0"; a tabela equivalente traz SE/CO por Nordeste = 17,76% (célula 17,8%))
- ok: Resume a jornada: nenhuma parada sem indicador de foco e nenhuma perda de foco (133 paradas de foco medidas em 4 páginas; indicadores: contorno 2px 125, sombra 7, anel no gráfico 1; nenhuma sem indicador, nenhuma no corpo da página)
- atrito: Distância em Tabs: 19 até o campo em Minha região (5 com o atalho de pular), 30 em Perdas, mais 25 do campo até a tabela (24 na rodada 3: a barra da tabela acrescentou uma parada), e 24 até o seletor em Diferenças regionais.
- atrito: O mapa não tem elemento focável: a saída por teclado é o campo e a tabela, como o aviso diz. Depois de escolher, o foco fica no campo e a ficha muda sem região de leitura automática (não verificado com leitor de tela).
- atrito: Visto na exploração, fora do roteiro: Enter ou Espaço numa célula da matriz de pares não muda nada visível, e nada avisa que a célula não é selecionável.
- atrito: Em Minha região a tabela equivalente vem recolhida em Entender: o teclado chega ao botão Ver a tabela completa, abre com Enter e só então alcança o filtro de submercado. Escolhida uma região, ou aplicada uma busca ou um filtro, a tabela abre sozinha.
- limite: Teclado simulado pelo Playwright no Chromium; não cobre leitor de tela nem outros navegadores. Roteiro por script, sem pessoas.

### J8: Leitor abre um link compartilhado e encontra o mesmo recorte

- ok: Em Histórico e distribuição, monta o recorte: Analisar, Sul, série desligada, 5 anos, busca, ordem e filtro (URL /setor-eletrico/pld/historico?modo=analisar&sm=S&de=2021-10-01&ate=2026-09-01&mes.q=2024&mes.ord=-temporal&mes.f.parcial=n%C3%A3o; a série "Ponderada pela carga do balanço do ONS" ficou desligada (não vai para a URL) e "Dados do gráfico em tabela" ficou aberto)
- ok: Clica em Copiar link deste painel e confere a mensagem, o campo e a área de transferência (mensagem "Copiado para a área de transferência."; link /setor-eletrico/pld/historico?modo=analisar&sm=S&de=2021-10-01&ate=2026-09-01&mes.q=2024&mes.ord=-temporal&mes.f.parcial=n%C3%A3o#p011; campo "Endereço deste painel com o recorte atual" igual à área de transferência)
- ok: Abre o link num novo contexto de navegador e compara o recorte de Histórico e distribuição (âncora #p011 (O preço está alto para esta época?) a 112 px do topo da janela, rolagem 524 px; voltaram: modo de profundidade, opções marcadas (submercado, moeda, camada), seletores de ano e indicador, intervalo do gráfico, busca na tabela, ordenação (aria-sort), contagem de linhas, chips de filtro e de comparação; não voltaram: seleção e séries ligadas (ligada só no link: Ponderada pela carga do b)
- ok: Em Perdas, monta o recorte: Analisar, ano 2024, indicador técnicas, zoom no mapa, filtro de UF, ordem, distribuidora e comparação (URL /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica&tab.f.ufs=MG&tab.ord=taxa_tecnica&d=06981180000116&cmp=15139629000194,04368898000106; a seção "Dados do gráfico em tabela" do comparador ficou aberta (não vai para a URL))
- ok: Clica em Copiar link deste painel de Perdas e confere a mensagem e a área de transferência (mensagem "Copiado para a área de transferência."; link /setor-eletrico/perdas?modo=analisar&periodo=2024&medida=tecnica&tab.f.ufs=MG&tab.ord=taxa_tecnica&d=06981180000116&cmp=15139629000194,04368898000106#mapa (esta página não mostra um campo com o endereço, só a mensagem))
- ok: Abre o link de Perdas num novo contexto e compara ano, indicador, filtro, ordem, escolha e comparação (âncora #mapa: elemento existe no destino, topo 112 px, rolagem 1342 px; voltaram: modo de profundidade, seletores de ano e indicador, ordenação (aria-sort), contagem de linhas, chips de filtro e de comparação, seleção e séries ligadas; não voltaram: seção Dados do gráfico em tabela aberta; zoom do mapa (a origem estava aproximada; o link abre o mapa inteiro))
- ok: Confere em Perdas que o painel certo ficou à vista ao abrir o link (âncora do link copiado) (painel #mapa a 112 px do topo da janela)
- ok: Em Minha região, monta o recorte: Analisar, UF BA, zoom no mapa, filtro de submercado e ordem na tabela (URL /setor-eletrico/territorio?modo=analisar&sel=uf:BA&ter.uf.f.submercado=Nordeste&ter.uf.ord=municipios)
- ok: Clica em Copiar link deste painel de Minha região e confere a mensagem e a área de transferência (mensagem "Copiado para a área de transferência."; link /setor-eletrico/territorio?modo=analisar&sel=uf:BA&ter.uf.f.submercado=Nordeste&ter.uf.ord=municipios#p002)
- ok: Abre o link de Minha região num novo contexto e compara escolha, ficha, filtro e ordem (âncora #p002: elemento existe, topo 112 px, rolagem 520 px; voltaram: modo de profundidade, opções marcadas (submercado, moeda, camada), seletores de ano e indicador, ordenação (aria-sort), contagem de linhas, chips de filtro e de comparação, seleção e séries ligadas, ficha da escolha; não voltaram: zoom do mapa (a origem estava aproximada; o link abre o mapa inteiro))
- ok: Resume o que o link não restaurou nas três páginas (não voltaram em historico: seleção e séries ligadas, séries desligadas, seção Dados do gráfico em tabela aberta | perdas: seção Dados do gráfico em tabela aberta, zoom do mapa | territorio: zoom do mapa)
- atrito: O que não volta no link compartilhado: a série desligada em Histórico do PLD, a seção Dados do gráfico em tabela aberta e o zoom do mapa (Perdas e Minha região abrem o mapa inteiro).
- atrito: Em Perdas, Copiar link deste painel é um link âncora que só mostra a mensagem, sem o campo com o endereço que o Histórico mostra.
- limite: Segundo contexto do mesmo Chromium (sem cookies nem armazenamento), mesma máquina e mesmo servidor; roteiro por script, sem pessoas.

### J9: Leitor entende que sem dado e atrasado não são zero

- ok: Abre Saúde dos dados, escolhe Analisar e lê as contagens por situação (data de referência 01/10/2026; 151 conjuntos integrados: 103 em dia, 1 atrasado, 43 sem SLA, 4 sem dado (soma confere))
- ok: Filtra a tabela por Situação = Atrasado e refaz a conta do atraso com as datas da própria linha (1 de 151 linhas; "SCS: Sistema de Controle de Subvenções e Programas Sociais (": frequência Mensal, último período 06/2025, prazo 29/09/2025, atraso 367 dias; a conta 01/10/2026 menos 29/09/2025 dá 367 dias (confere); última captura 30/09/2026 22:30, completude 99,5%)
- ok: Troca o filtro para Situação = Sem dado e confere que o atraso não aparece como zero (4 de 151 linhas; em todas as 4 linhas "Atraso (dias)" e "Prazo do próximo período" dizem "sem dado" (nenhum 0); conjuntos: Estimativas de população residente (SI | POF 2017-2018: despesa com energia elé | População residente estimada por UF (S | IBGE: população residente, Censo 2022 )
- ok: Baixa o CSV desta tabela e confere que cada célula sem dado da tela é campo vazio no arquivo (CSV com 4 linhas, 72 células comparadas, 28 com "sem dado" na tela, 28 vazias no arquivo e nenhuma 0)
- ok: Lê como a página explica sem dado, sem SLA e atrasado, e a regra do CSV (SLA: "SLA é o prazo derivado da frequência que a própria fonte declara: diária, 2 dias; semanal, 7; quinzenal, 15; mensal, 60; trimestral, 90; anual, 365, c..."; atraso: "Situação e atraso valem para a data de referência da publicação, e o prazo é o fim do último período disponíve..."; ausência: "“sem dado” indica ausência na fonte, nunca zero; nos arquivos baixados a ausência é célula vazia")
- ok: Compara a data de referência com as datas de captura e de processamento mostradas na página (referência 01/10/2026; gold processada 01/10/2026, 08:22; última captura registrada 01/10/2026, 04:37; captura do conjunto atrasado 30/09/2026 22:30 (antes da gold, na ordem esperada); o último período dele é 06/2025, 487 dias antes da referência (contados do dia 1º do mês); o rodapé da mesma página diz "Catálogo e manifesto publicados em 01/10/2026, 08:22", a mesma data do cabeçalho)
- ok: Em Perdas, mostra a tabela inteira e confere sem dado na tela contra célula vazia no CSV (CSV com 123 linhas e 123 na tela; 1845 células comparadas, 437 com "sem dado", 417 vazias no CSV e nenhuma 0; 20 células "sem dado" de coluna de classe viram o TEXTO "sem dado" no CSV (Classe no mapa (taxa de perdas totais): 20), não campo vazio; exemplo ÂMBAR AMAZONAS: Técnicas "sem dado", Decomposição "sem separação publicada" (motivo na mesma linha))
- ok: Em Restrições de geração, confere a tabela por razão: sem dado na tela, célula vazia no CSV, e o total (CSV com 5 linhas, 25 células, 5 "sem dado" na tela, 5 vazias no CSV e nenhuma 0. Linha "Parecer de acesso": origem local "sem dado", origem sistêmica "sem dado", mas Total "0,0" e Parcela "0,00": o total é um número, a página não diz se é zero medido ou soma de ausências)
- ok: No Histórico do PLD, confere o mês sem moeda constante: sem dado na tela, vazio no CSV e o motivo escrito (CSV com 69 linhas, 828 células (pareadas por posição: o mês é 09/2026 na tela e 2026-09 no arquivo), 1 "sem dado" na tela, 1 vazias no CSV e nenhuma 0. Em 09/2026 a média em moeda constante é "sem dado" e em 08/2026 é 128,12; motivo escrito: "Moeda constante só existe até o último mês com IPCA publicado." (cabeçalho: IPCA até ago/2026))
- ok: No Catálogo, busca SCS, escolhe a linha e lê no painel Ficha do conjunto como o atraso é explicado (painel: "Atualidade: atrasado; último período disponível 06/2025; 367 dias além do prazo"; última captura em 30/09/2026; coincide com a página de saúde (06/2025, 367 dias))
- ok: Abre a ficha completa do conjunto atrasado pelo link do painel e lê os campos de captura (/setor-eletrico/dados/aneel-scs; título "SCS - Sistema de Controle de Subvenções e Programas Sociais"; última captura "30/09/2026, 19:30 (Brasília)"; última tentativa de coleta direta "undefined"; menciona atraso: sim)
- ok: Abre a ficha completa de um conjunto sem dado e confere que a ausência vem escrita, nunca como zero (/setor-eletrico/dados/ibge-pof-6715; última captura 30/09/2026, ; atualidade "sem dado para medir"; campos sem valor: Última modificação na fonte "não informada"; Formatos "não informado"; a ficha traz "campo vazio significa ausência, nunca zero")
- ok: Confere se a ficha completa do conjunto atrasado diz que ele está atrasado e concorda com a saúde sobre a última captura (a ficha concorda com a saúde e com o painel do catálogo)
- atrito: Em Restrições de geração, a linha Parecer de acesso mostra dois sem dado ao lado de Total 0,0 e Parcela 0,00, e a página não diz se é zero medido ou soma de ausências. Nas tabelas de saúde e de catálogo o nome do conjunto não tem link para a ficha.
- atrito: A Saúde contava 151 conjuntos integrados e o catálogo, 126 publicados, sem dizer que a Saúde conta integrações e que um conjunto pode ter mais de uma. A frase foi corrigida depois da medição, ainda não medida.
- limite: Confere a ausência em três tabelas e duas fichas; não cobre todos os módulos. Roteiro por script, sem pessoas.

### J10: Leitor inspeciona uma previsão passada e o resultado, sem reescrita do histórico

- ok: Abre Previsões e modelos, escolhe Auditar e lê que nenhum modelo está aprovado e o número do B0 (modo=auditar; "Não há previsão oficial do PLD: nenhum modelo está aprovado para produção"; B0 semanal SE/CO R$ 124,09/MWh e mensal R$ 128,12/MWh; rodada de 30/09/2026, PLD até 30/09/2026; arquivo com 56 registros de 2 rodadas)
- ok: Lê como a página separa a previsão (PREVISTO) do dado já publicado (OBSERVADO) (cartão B0: selo PREVISTO, R$ 124,09/MWh; cartão PLD já publicado no corte: selo OBSERVADO, R$ 155,21/MWh (30/09/2026, 07h a 23h), "É dado, não previsão"; a página acrescenta que "nenhuma entrega prevista inclui essas horas")
- ok: Vai ao painel Arquivo de emissões pelo link da página e lê a contagem de registros e rodadas (painel #p015 a 112 px do topo; 56 registros de 2 rodadas; rodada de 27/09: sem número, motivo "nenhum PLD do período exigido havia sido capturado até o corte", emitida 490 min depois do prazo, transcrita em 28/09/2026; rodada de 30/09: 28 números, emitida 751 min depois do prazo; nenhuma entrega terminou, a primeira (W2026-10-03) termina em 10/10/2026; subtítulo "Arquivo imutável de emissões · uma)
- ok: Escolhe a rodada de 27/09/2026 no gráfico e lê as linhas: sem número, motivo e sem realizado (Rodada de 27/09/2026: com número 0 células; sem número 28 células; total 28 células; 28 de 28 linhas; todas as 28 com "sem número", Previsão arquivada "sem dado" (nenhum 0), Realizado "sem dado", motivo "nenhum PLD do período exigido havia sido capturado até o corte"; incluídas no arquivo em 28/09/2026; transcrita depois da emissão: sim, incluído depois da emissão)
- ok: Seleciona a primeira linha da rodada de 27/09 e lê a ficha do registro (reg=...:W1:SE na URL; ficha "Registro W1 SE/CO da rodada de 27/09/2026": PREVISÃO "sem número: nenhum PLD do período exigido havia sido capturado até o corte"; REALIZADO "ainda sem realizado (a entrega não terminou)"; INCLUSÃO "28/09/2026; transcrito depois da emissão: sim"; CORREÇÃO "registro original (não substitui outro)"; sha256 c7acd8447e62...)
- ok: Escolhe a rodada de 30/09/2026 no gráfico e lê as linhas: com número, sem faixa e sem realizado (Rodada de 30/09/2026: com número 28 células; sem número 0 células; total 28 células; 28 de 28 linhas; todas "com número", P10 e P90 "sem dado" (sem faixa), Realizado "sem dado"; W1 SE/CO arquivada em R$ 124,0911/MWh, emitida em 30/09/2026 às 20h31, atraso 751,3 min, código 30ad85ccb171+alterado)
- ok: Seleciona W1 SE/CO da rodada de 30/09 e compara a previsão arquivada com a de Previsão atual (ficha: PREVISÃO R$ 124,0911/MWh, FAIXA "sem faixa gravada", REALIZADO "ainda sem realizado"; o painel Previsão atual mostra R$ 124,09/MWh para o mesmo W1 SE/CO (mesmo número com 2 casas; o arquivo guarda 4); PLD já publicado no corte, outro dado: R$ 155,21/MWh)
- ok: Desfaz a escolha de rodada e mostra as 56 linhas do arquivo de hoje, guardando cada uma pelo identificador (56 de 56 linhas; 56 identificadores únicos: 28 da rodada de 27/09 e 28 da de 30/09)
- ok: Usa Ver o arquivo como estava ao fim de 29/09/2026: o texto e as linhas visíveis são só as que existiam (controle aceita datas de 2026-09-28 a 2026-09-30; texto: "Ao fim de 29/09/2026, o arquivo tinha 28 registros (de 56 hoje) de 1 rodada"; tabela "28 de 28 linhas"; as 28 linhas são exatamente as incluídas até 29/09/2026 (todas da rodada de 27/09) e nenhuma da rodada de 30/09)
- ok: Compara célula a célula as 28 linhas da visão antiga com as mesmas linhas de hoje (28 linhas e 616 células comparadas (inclusive Previsão arquivada, Realizado, sha256 e Incluída no arquivo em): nenhuma diferença entre a visão de 29/09 e a de hoje)
- ok: Usa a data 30/09/2026 (a rodada nova já incluída) e depois limpa a data: volta às 56 linhas iguais às de hoje ("Ao fim de 30/09/2026, o arquivo tinha 56 registros de 2 rodadas"; as 56 linhas coincidem com as de hoje; com a data limpa, a URL perde em= e o texto volta a "O arquivo tem 56 registros de 2 rodadas")
- ok: Baixa o CSV Emissões registradas e confere contra a tela: 56 linhas, sha256 iguais, sem número é campo vazio (56 linhas (como na tela); os 56 sha256 coincidem com a coluna sha256 do registro; as 28 linhas sem número têm previsao, realizado, p10 e p90 vazios (não 0); as 28 com número batem com a tela até a 4ª casa)
- ok: Confere as frases do painel: arquivo imutável, nada reescrito, sem faixa calibrada não vira probabilidade (imutável: "Arquivo imutável de emissões · uma linha por célula"; "guarda todas as emissões como foram registradas, antes do resultado, para que o desempenho possa ser medido depois sem r"; "Sem faixa calibrada, não há probabilidade associada ao número."; "Não é previsão aprovada nem diz que o preço vai ficar onde está"; "Sem faixa de incerteza: nenhum segmento está calibrado.")
- ok: Abre Desempenho e calibração e lê que ainda não há resultado para comparar com a previsão (/setor-eletrico/pld/modelos#p016 (modo de profundidade marcado: ENTENDER; modo na URL: nenhum; a página anterior estava em auditar); "No acompanhamento prospectivo, nenhuma das 28 previsões com número tem realizado: a primeira entrega termina em 10/10/2026" (igual ao arquivo: 28 números, primeira entrega W2026-10-03 termina em 10/10/2026); o painel diz que os números de desempenho do teste retrosp)
- atrito: Até 10/10/2026 não há resultado para ver: a coluna Realizado é sem dado nas 56 linhas e a ficha diz ainda sem realizado, de modo que a comparação entre previsão e resultado não pôde ser verificada.
- atrito: O arquivo e a ficha mostram 124,0911 e Previsão atual mostra 124,09 para o mesmo número.
- atrito: O link P016 Desempenho e calibração, seguido a partir de Auditar, abre em Entender, sem o modo na URL. As rodadas se escolhem clicando nas barras do gráfico, sem lista separada.
- limite: Não há resultado publicado para comparar: nenhuma entrega prevista terminou até a publicação lida. Roteiro por script, sem pessoas.

## Defeitos abertos

| Id | Severidade | Dimensão | Descrição | Páginas |
| --- | --- | --- | --- | --- |
| D001 | alto | atualidade | conjunto atrasado: aneel_social/aneel_scs (367 dias) | 6 |
| D002 | alto | correcao | nenhuma gold da página tem ficha de evidência com teste registrado | 5 |
| D003 | alto | rastreabilidade | painel numérico sem Comprove este número | 5 |
| D004 | alto | rastreabilidade | página sem fonte declarada | 1 |
| D005 | medio | correcao | 3 arquivo(s) CSV com checagem reprovada em publicacao.json (arquivos.csv_com_problema) | 12 |
| D006 | medio | completude | itens ausentes da anatomia do painel: gráfico ou mapa | 9 |
| D007 | medio | completude | itens ausentes da anatomia do painel: limite de leitura declarado; caminho seguinte | 8 |
| D008 | medio | completude | itens ausentes da anatomia do painel: h1 único com abertura; equivalente textual para as figuras | 4 |
| D009 | medio | completude | itens ausentes da anatomia do painel: gráfico ou mapa; Comprove este número | 3 |
| D010 | medio | completude | itens ausentes da anatomia do painel: h1 único com abertura | 3 |
| D011 | medio | completude | itens ausentes da anatomia do painel: período, universo e unidade; gráfico ou mapa; tabela equivalente; interação local; como ler e o que não permite concluir; download e link compartilhável; próxima pergunta | 3 |
| D012 | medio | completude | itens ausentes da anatomia do painel: resposta curta | 3 |
| D013 | medio | completude | itens ausentes da anatomia do painel: resposta curta; gráfico ou mapa | 3 |
| D014 | medio | completude | itens ausentes da anatomia do painel: resposta curta; período, universo e unidade; download e link compartilhável | 3 |
| D015 | medio | navegacao | link compartilhado: a série desligada, o zoom do mapa e a seção de tabela aberta não voltam para quem abre o endereço copiado | 3 |
| D016 | medio | completude | itens ausentes da anatomia do painel: gráfico ou mapa; tabela equivalente; interação local; Comprove este número | 2 |
| D017 | medio | atualidade | frase com número e a palavra hoje, sem data de referência: Cada regra é reavaliada em todos os dias desde 01/01/2021 com os dados vigentes hoje (já revisados): | 1 |
| D018 | medio | atualidade | frase com número e a palavra hoje, sem data de referência: MMGD estimada pela API de carga verificada, como publicada hoje, é 3 | 1 |
| D019 | medio | completude | data em formato cru no texto: 1900-01-03 | 1 |
| D020 | medio | completude | data em formato cru no texto: 2011-12-31 / 2023-12-31 | 1 |
| D021 | medio | completude | data em formato cru no texto: 2021-12-31 | 1 |
| D022 | medio | completude | itens ausentes da anatomia do painel: evidência ou fonte oficial | 1 |
| D023 | medio | completude | itens ausentes da anatomia do painel: fonte ou data declarada; limite de leitura declarado; equivalente textual para as figuras | 1 |
| D024 | medio | completude | itens ausentes da anatomia do painel: gráfico ou mapa; interação local | 1 |
| D025 | medio | completude | itens ausentes da anatomia do painel: h1 único com abertura; limite de leitura declarado; evidência ou fonte oficial | 1 |
| D026 | medio | completude | itens ausentes da anatomia do painel: limite de leitura declarado; equivalente textual para as figuras | 1 |
| D027 | medio | completude | itens ausentes da anatomia do painel: limite de leitura declarado; evidência ou fonte oficial | 1 |
| D028 | medio | completude | itens ausentes da anatomia do painel: pergunta como título; resposta curta | 1 |
| D029 | medio | completude | itens ausentes da anatomia do painel: período, universo e unidade; gráfico ou mapa; como ler e o que não permite concluir; download e link compartilhável; próxima pergunta | 1 |
| D030 | medio | completude | itens ausentes da anatomia do painel: resposta curta; período, universo e unidade; gráfico ou mapa; download e link compartilhável | 1 |
| D031 | medio | correcao | Restrições de geração: a linha Parecer de acesso mostra origem local e sistêmica como sem dado e, na mesma linha, Total 0,0 e Parcela 0,00, sem dizer se é zero medido ou soma de ausências | 1 |
| D032 | medio | interatividade | Perdas: com ano e indicador escolhidos, a ficha da distribuidora e o comparador continuam em perdas totais de 2025 e de 2003 a 2025, sem respeitar a escolha | 1 |
| D033 | medio | interatividade | controle sem efeito observável: /Brasil inteiro | 1 |
| D034 | medio | rastreabilidade | histórico do PLD: a média temporal de ago/2026, base da variação mostrada, não traz período escrito nem ficha Comprove este número, ao contrário das médias ponderadas | 1 |
| D035 | medio | rastreabilidade | histórico do PLD: as médias ponderadas pela carga não podem ser reproduzidas a partir dos arquivos oferecidos na página, porque nenhum deles traz a carga horária do ONS | 1 |
| D036 | medio | rastreabilidade | painel sem download | 1 |
| D037 | medio | rastreabilidade | página sem data de referência ou de conferência | 1 |
| D038 | baixo | desempenho | HTML de 1.019 KB, acima da meta de 600 KB | 1 |
| D039 | baixo | desempenho | HTML de 629 KB, acima da meta de 600 KB | 1 |
| D040 | baixo | desempenho | HTML de 641 KB, acima da meta de 600 KB | 1 |
| D041 | baixo | desempenho | HTML de 646 KB, acima da meta de 600 KB | 1 |
| D042 | baixo | desempenho | HTML de 654 KB, acima da meta de 600 KB | 1 |
| D043 | baixo | desempenho | HTML de 671 KB, acima da meta de 600 KB | 1 |
| D044 | baixo | desempenho | HTML de 682 KB, acima da meta de 600 KB | 1 |
| D045 | baixo | desempenho | HTML de 722 KB, acima da meta de 600 KB | 1 |
| D046 | baixo | desempenho | HTML de 822 KB, acima da meta de 600 KB | 1 |
| D047 | baixo | desempenho | HTML de 880 KB, acima da meta de 600 KB | 1 |
| D048 | baixo | navegacao | Previsões: o link do painel P016, seguido a partir do modo Auditar, abre em Entender e perde o nível de profundidade | 1 |
| D049 | baixo | rastreabilidade | ficha de distribuidora: o Comprove do cartão de perdas exibe 12,1% enquanto o cartão e a página Perdas exibem 12,12% | 1 |

## Por página

Nota de cada dimensão (0 a 10); n.av. = não avaliada; n.ap. = não aplicável. A evidência de cada nota, com deduções e tetos, está em `public/energia/gold/avaliacao.json` e na página de avaliação.

| Rota | Tipo | Didat. | Visual | Naveg. | Interat. | Acess. | Compl. | Correção | Rastr. | Atual. | Desemp. | Ponderada | Meta |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | home | 7,5 | 7,5 | 10,0 | 10,0 | 9,0 | 10,0 | 9,0 | 9,5 | n.ap. | 9,0 | 8,9 | não |
| /agua-e-clima | painel | 8,0 | 8,0 | 10,0 | 10,0 | 9,0 | 10,0 | 8,1 | 9,5 | 7,2 | 9,0 | 8,8 | não |
| /agua-e-clima/afluencia | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 8,1 | 9,5 | 7,2 | 9,0 | 8,6 | não |
| /agua-e-clima/chuva-e-temperatura | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 8,1 | 9,5 | 7,2 | 9,0 | 8,4 | não |
| /agua-e-clima/reservatorios | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 9,0 | 8,1 | 9,5 | 7,2 | 9,0 | 8,3 | não |
| /aprenda | editorial | 7,5 | 7,5 | 10,0 | n.ap. | 9,0 | 8,5 | 9,0 | 9,5 | n.ap. | 9,0 | 8,6 | não |
| /aprenda/trilhas | editorial | 8,0 | 8,5 | 9,0 | n.ap. | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,5 | não |
| /aprenda/trilhas/agua-operacao-preco | editorial | 8,0 | 8,0 | 10,0 | 10,0 | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,7 | não |
| /aprenda/trilhas/custo-tarifa-orcamento | editorial | 7,5 | 8,0 | 9,0 | 10,0 | 9,0 | 5,7 | 9,0 | 4,5 | n.ap. | 9,0 | 7,8 | não |
| /carga | painel | 7,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 5,5 | 9,5 | 7,0 | 7,0 | 8,0 | não |
| /carga/clima-e-calendario | painel | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 5,5 | 9,5 | 7,0 | 9,0 | 8,1 | não |
| /carga/perfil-horario | painel | 6,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 5,5 | 9,5 | 7,0 | 7,0 | 7,8 | não |
| /conta-de-luz | painel | 7,0 | 8,0 | 10,0 | 10,0 | 9,0 | 10,0 | 8,1 | 9,5 | 8,2 | 7,0 | 8,6 | não |
| /conta-de-luz/reajustes-e-subsidios | painel | 7,5 | 7,0 | 9,0 | 10,0 | 9,0 | 9,0 | 8,1 | 9,5 | 8,2 | 9,0 | 8,4 | não |
| /dados | painel | 7,0 | 7,5 | 10,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 6,0 | 9,0 | 8,3 | não |
| /dados/reproducao | painel | 6,5 | 7,5 | 9,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 6,0 | 9,0 | 8,1 | não |
| /dados/saude | painel | 7,5 | 8,0 | 10,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 6,0 | 9,0 | 8,4 | não |
| /empresas | painel | 7,5 | 8,0 | 9,0 | 10,0 | 9,0 | 3,0 | 9,1 | 8,5 | 9,0 | 9,0 | 7,9 | não |
| /empresas/ativos | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 9,0 | 9,1 | 9,5 | 9,0 | 9,0 | 8,6 | não |
| /empresas/controle | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 8,5 | 9,1 | 9,5 | 9,0 | 9,0 | 8,5 | não |
| /empresas/distribuidoras | painel | 7,0 | 7,5 | 10,0 | 10,0 | 9,0 | 9,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/financas | painel | 6,5 | 6,5 | 9,0 | 10,0 | 9,0 | 10,0 | 9,1 | 9,5 | 9,0 | 9,0 | 8,5 | não |
| /expansao | painel | 7,5 | 8,0 | 9,0 | 10,0 | 9,0 | 5,5 | 8,4 | 9,5 | 8,6 | 9,0 | 8,2 | não |
| /expansao/carteira | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 8,4 | 9,5 | 8,6 | 9,0 | 8,7 | não |
| /expansao/cenarios | painel | 6,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 8,4 | 9,5 | 8,6 | 9,0 | 8,5 | não |
| /expansao/cronograma | painel | 6,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 8,4 | 9,5 | 8,6 | 9,0 | 8,5 | não |
| /expansao/geracao-e-transmissao | painel | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 8,4 | 9,5 | 8,6 | 9,0 | 8,6 | não |
| /geracao | painel | 7,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,1 | 9,5 | 8,8 | 7,0 | 8,3 | não |
| /geracao/capacidade | painel | 7,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,1 | 9,5 | 8,8 | 9,0 | 8,4 | não |
| /geracao/restricoes | painel | 7,5 | 7,5 | 10,0 | 9,5 | 9,0 | 10,0 | 7,1 | 9,5 | 8,8 | 9,0 | 8,6 | não |
| /geracao/termica | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,1 | 9,5 | 8,8 | 7,0 | 8,3 | não |
| /inclusao-energetica | painel | 8,0 | 8,5 | 9,0 | 10,0 | 9,0 | 3,5 | 7,7 | 9,5 | 5,4 | 9,0 | 7,8 | não |
| /inclusao-energetica/acesso | painel | 8,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 5,4 | 9,0 | 8,5 | não |
| /inclusao-energetica/cobertura | painel | 8,0 | 8,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 5,4 | 9,0 | 8,5 | não |
| /inclusao-energetica/orcamento | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 5,4 | 9,0 | 8,4 | não |
| /inclusao-energetica/tarifa-social | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 5,4 | 9,0 | 8,4 | não |
| /mercado | painel | 8,0 | 8,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 8,1 | 9,0 | 8,7 | não |
| /mercado/agentes | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 8,1 | 9,0 | 8,5 | não |
| /mercado/encargos | painel | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 8,1 | 9,0 | 8,5 | não |
| /mercado/mre-e-gsf | painel | 8,0 | 8,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,7 | 9,5 | 8,1 | 9,0 | 8,7 | não |
| /metodologia | painel | 6,0 | 7,0 | 9,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 6,0 | 9,0 | 8,0 | não |
| /perdas | painel | 7,5 | 8,0 | 10,0 | 10,0 | 9,0 | 8,3 | 7,3 | 9,5 | 9,0 | 9,0 | 8,5 | não |
| /perdas/composicao | painel | 7,0 | 8,0 | 9,0 | 10,0 | 9,0 | 7,5 | 7,3 | 9,5 | 9,0 | 9,0 | 8,2 | não |
| /perdas/custo-e-contexto | painel | 7,5 | 8,0 | 9,0 | 10,0 | 9,0 | 7,5 | 7,3 | 9,5 | 9,0 | 9,0 | 8,3 | não |
| /perdas/regulatorio | painel | 5,5 | 7,5 | 9,0 | 10,0 | 9,0 | 6,5 | 7,3 | 9,5 | 9,0 | 9,0 | 7,8 | não |
| /pld | painel | 7,0 | 7,5 | 10,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 8,4 | 7,0 | 8,3 | não |
| /pld/cmo-e-formacao | painel | 6,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 7,5 | 9,5 | 8,4 | 9,0 | 8,4 | não |
| /pld/diferencas-regionais | painel | 7,5 | 7,0 | 10,0 | 10,0 | 9,0 | 10,0 | 7,5 | 9,5 | 8,4 | 9,0 | 8,6 | não |
| /pld/historico | painel | 6,0 | 7,0 | 10,0 | 10,0 | 9,0 | 10,0 | 7,5 | 9,5 | 8,4 | 9,0 | 8,3 | não |
| /pld/limites | painel | 8,0 | 7,5 | 9,0 | 10,0 | 9,0 | 9,0 | 7,5 | 9,5 | 8,4 | 9,0 | 8,5 | não |
| /pld/modelos | painel | 5,5 | 6,5 | 10,0 | 10,0 | 9,0 | 8,4 | 9,1 | 9,5 | 8,0 | 9,0 | 8,2 | não |
| /pld/modelos/b0 | painel | 6,5 | 7,0 | 9,0 | 10,0 | 9,0 | 8,0 | 9,1 | 9,5 | 8,0 | 9,0 | 8,3 | não |
| /pld/modelos/c1 | painel | 5,5 | 7,0 | 9,0 | 10,0 | 9,0 | 6,0 | 9,1 | 7,5 | 8,0 | 9,0 | 7,7 | não |
| /pld/modelos/c2-h | painel | 4,5 | 6,5 | 9,0 | 10,0 | 9,0 | 8,0 | 9,1 | 7,5 | 8,0 | 9,0 | 7,7 | não |
| /pld/modelos/c2-p | painel | 4,5 | 6,5 | 9,0 | 10,0 | 9,0 | 8,0 | 9,1 | 7,5 | 8,0 | 9,0 | 7,7 | não |
| /pld/modelos/s0 | painel | 6,5 | 7,5 | 9,0 | 10,0 | 9,0 | 6,0 | 9,1 | 7,5 | 8,0 | 9,0 | 7,9 | não |
| /pld/previsoes | painel | 7,0 | 7,0 | 10,0 | 10,0 | 9,0 | 10,0 | 9,1 | 9,5 | 8,0 | 9,0 | 8,7 | não |
| /qualidade | painel | 8,0 | 8,0 | 10,0 | 10,0 | 9,0 | 9,8 | 8,0 | 9,5 | 8,9 | 7,0 | 8,8 | não |
| /rede | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,4 | 9,5 | 8,6 | 7,0 | 8,3 | não |
| /rede/balanco-e-exterior | painel | 6,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,4 | 9,5 | 8,6 | 9,0 | 8,2 | não |
| /rede/programado | painel | 6,5 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,4 | 9,5 | 8,6 | 9,0 | 8,3 | não |
| /rede/restricoes | painel | 6,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 7,4 | 9,5 | 8,6 | 9,0 | 8,2 | não |
| /regulacao | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 9,3 | 8,3 | 9,5 | 8,3 | 7,0 | 8,3 | não |
| /regulacao/consultas-e-agenda | painel | 6,5 | 6,5 | 9,0 | 10,0 | 9,0 | 8,5 | 8,3 | 9,5 | 8,3 | 9,0 | 8,2 | não |
| /regulacao/linha-do-tempo | painel | 7,0 | 6,0 | 9,0 | 10,0 | 9,0 | 8,0 | 8,3 | 7,5 | 8,3 | 9,0 | 8,0 | não |
| /territorio | painel | 6,0 | 7,0 | 10,0 | 10,0 | 9,0 | 10,0 | 9,1 | 9,5 | 7,7 | 7,0 | 8,4 | não |
| /transicao | painel | 7,5 | 8,0 | 9,0 | 10,0 | 9,0 | 3,5 | 8,3 | 9,5 | 7,9 | 9,0 | 7,9 | não |
| /transicao/emissoes | painel | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 8,3 | 9,5 | 7,9 | 9,0 | 8,5 | não |
| /transicao/energia-estimada | painel | 7,0 | 8,0 | 9,0 | 10,0 | 9,0 | 10,0 | 8,3 | 9,5 | 7,4 | 9,0 | 8,6 | não |
| /transicao/mmgd | painel | 7,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 8,3 | 9,5 | 7,9 | 9,0 | 8,6 | não |
| /visao-geral | painel | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 9,6 | 8,0 | 9,5 | 7,0 | 9,0 | 8,4 | não |
| /aprenda/acl | verbete (amostra) | 8,0 | 8,5 | 9,0 | 10,0 | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,6 | não |
| /aprenda/cde | verbete (amostra) | 8,0 | 8,5 | 9,0 | 10,0 | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,6 | não |
| /aprenda/dessem | verbete (amostra) | 7,0 | 8,5 | 9,0 | 10,0 | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,5 | não |
| /aprenda/gsf | verbete (amostra) | 4,5 | 7,5 | 9,0 | n.ap. | 9,0 | 5,7 | 6,0 | 9,5 | n.ap. | 9,0 | 7,0 | não |
| /aprenda/percentual-regulatorio-de-perdas | verbete (amostra) | 7,0 | 8,0 | 9,0 | n.ap. | 9,0 | 8,5 | 9,0 | 9,5 | n.ap. | 9,0 | 8,5 | não |
| /aprenda/tarifa-te-tusd | verbete (amostra) | 8,0 | 8,5 | 10,0 | 10,0 | 9,0 | 7,1 | 9,0 | 9,5 | n.ap. | 9,0 | 8,7 | não |
| /dados/aneel-agentes-geracao | ficha (amostra) | 6,0 | 7,5 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 9,0 | 9,0 | 8,0 | não |
| /dados/aneel-pautas-atas-diretoria | ficha (amostra) | 5,5 | 7,5 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 9,0 | 9,0 | 7,9 | não |
| /dados/ccee-lista-agente-associado | ficha (amostra) | 5,0 | 7,0 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 9,0 | 9,0 | 7,8 | não |
| /dados/ibge-pof-cv | ficha (amostra) | 5,5 | 7,5 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 6,0 | 9,0 | 7,7 | não |
| /dados/ons-ena-diario-por-bacia | ficha (amostra) | 6,0 | 7,5 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 9,0 | 9,0 | 8,0 | não |
| /dados/senado-leis-feriados | ficha (amostra) | 5,0 | 7,0 | 9,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 6,0 | 9,0 | 7,6 | não |
| /empresas/ambar-amazonas | ficha (amostra) | 6,5 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/cerbranorte | ficha (amostra) | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/certhil | ficha (amostra) | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/cpfl-piratining | ficha (amostra) | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/emt | ficha (amostra) | 7,0 | 7,5 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /empresas/uhenpal | ficha (amostra) | 7,0 | 7,0 | 9,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,3 | não |
| /aprenda/ear | verbete (amostra) | 8,0 | 8,0 | 10,0 | n.ap. | 9,0 | 8,5 | 9,0 | 9,5 | n.ap. | 9,0 | 8,7 | não |
| /aprenda/pld | verbete (amostra) | 7,0 | 8,0 | 10,0 | n.ap. | 9,0 | 8,5 | 9,0 | 9,5 | n.ap. | 9,0 | 8,6 | não |
| /dados/aneel-scs | ficha (amostra) | 6,5 | 7,5 | 10,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 7,5 | 9,0 | 8,1 | não |
| /dados/ibge-pof-6715 | ficha (amostra) | 5,5 | 7,5 | 10,0 | 10,0 | 9,0 | 7,1 | 7,5 | 9,5 | 8,3 | 9,0 | 8,0 | não |
| /empresas/cemig-d | ficha (amostra) | 7,0 | 7,5 | 10,0 | 10,0 | 9,0 | 10,0 | 6,8 | 9,5 | 8,2 | 9,0 | 8,4 | não |

## Rubrica

### Didatismo (peso 15%)

Evidência exigida: Pergunta respondida, linguagem, exemplo, interpretação e ligação entre conceitos.

- Nota do revisor em contexto limpo, que leu o texto da página e abriu as capturas em desktop e celular.
- 9,5 ou mais exige que o revisor não registre nenhum defeito de clareza nos blocos lidos.
- Sem revisão registrada para a página, a dimensão fica não avaliada.

### Qualidade visual (peso 12%)

Evidência exigida: Capturas inspecionadas, hierarquia, tipografia, densidade e consistência.

- Nota do revisor em contexto limpo, a partir das capturas abertas em 1440 e 390 px (primeira dobra e página inteira).
- 9,5 ou mais exige que o revisor não registre nenhum defeito de hierarquia, densidade ou consistência.
- Sem revisão registrada para a página, a dimensão fica não avaliada.
- Teto 6,0: rolagem horizontal da página em alguma largura medida (defeito visível ao leitor).

### Navegação e usabilidade (peso 10%)

Evidência exigida: Jornadas executadas, descoberta de conteúdo e restauração de estado.

- Parte do teto aplicável (10 sem teto). Cada link interno quebrado tira 2,0 (até 6,0); cada âncora ausente no destino tira 0,5 (até 2,0).
- Primeiro foco que não seja o atalho Pular para o conteúdo tira 1,0; h1 diferente de um tira 1,5; título do documento vazio ou repetido em outra página tira 1,0.
- Foco preso nos primeiros passos de Tab tira 4,0; seletor de profundidade incoerente com URL, marcação ou botão voltar tira 2,0.
- Página sem menu de navegação tira 1,0.
- Teto 9,0: nenhuma jornada de usuário executada passou pela página.
- Teto 8,0: só jornadas interrompidas passaram pela página.

### Interatividade (peso 8%)

Evidência exigida: Controles funcionais e coerência das seleções.

- Parte do teto aplicável (10 sem teto) sobre os controles visíveis acionados em 390 e 1440 px (até 18 por largura): rádios, abas, botões de estado, resumos, caixas, seletores e cabeçalhos de ordenação, mais a ficha Comprove este número, o link copiável e o seletor de profundidade.
- Controle que não aciona tira 1,5 (até 6,0); controle intermitente (aciona com a página recarregada, mas não depois da sequência de ações) tira 0,5 (até 2,0); controle sem efeito observável (URL, conteúdo ou resumo aberto) tira 0,5 (até 2,0); erro de console depois da ação tira 3,0 por controle (até 6,0); rolagem horizontal depois da ação tira 1,0 por controle (até 2,0).
- Ficha Comprove que não abre, não traz sha256, fonte e reprodução, ou não fecha com Esc tira 2,0 por falha (até 4,0); link copiável sem mensagem nem campo tira 2,0; seletor de profundidade incoerente tira 2,0.
- Página sem nenhum controle acionável fica não aplicável nesta dimensão e sai do cálculo ponderado.

### Acessibilidade (peso 7%)

Evidência exigida: Teclado, foco, contraste, semântica, alternativas e mobile.

- Parte do teto aplicável (10 sem teto). Cada regra distinta do axe-core (WCAG 2.0, 2.1 e 2.2, A e AA) violada em qualquer largura ou modo: crítica tira 3,0, séria 2,0, moderada 1,0, leve 0,5.
- Parada de Tab sem indicador de foco visível tira 0,5 (até 2,0); foco fora da tela tira 0,5 (até 1,0); primeiro foco que não seja o atalho de conteúdo tira 1,0.
- Página sem idioma pt tira 1,0; sem região principal tira 2,0; alvos de toque menores que 24 px em 390 px tiram 0,25 cada (até 1,5); rolagem horizontal em 360 px tira 1,5.
- Teto 9,0: sem leitor de tela real nem auditoria manual de WCAG: ferramenta automática e roteiro de teclado não cobrem todos os critérios.

### Completude (peso 12%)

Evidência exigida: Todos os itens e recortes obrigatórios com conteúdo válido.

- Painéis numéricos (seção 7.2): nota igual a 10 vezes a média de dez itens, cada um de 0 a 1: pergunta como título, resposta curta, período e universo e unidade, gráfico ou mapa, tabela equivalente, interação local, como ler e o que não permite concluir, Comprove este número, download e link compartilhável, próxima pergunta.
- Páginas editoriais, fichas e navegação (a seção 7.2 manda não aplicar o molde): nota igual a 10 vezes a média de sete itens: h1 único com abertura, fonte ou data declarada, limite de leitura declarado, caminho seguinte, evidência ou fonte oficial, conteúdo sem valor de reserva nem data crua nem marcador de obra, equivalente textual para figuras.
- A presença é medida no modo com mais conteúdo (Auditar, 1440 px) e no Entender.

### Correção técnica e metodológica (peso 15%)

Evidência exigida: Fórmulas, universos, unidades, reconciliações e limites de inferência.

- Painéis numéricos: parte do teto aplicável (10 sem teto) sobre as golds que alimentam a página (publicacao.json, eixos.por_gold). Gold com veredito reprovado tira 4,0; ficha com divergência tira 3,0; ficha sem teste registrado tira 0,5 (até 3,0); ficha com ressalva tira 0,15 (até 1,5); gold com veredito ressalva tira 0,3 (até 1,0).
- Verbetes: conferidos na fonte primária valem 9,0; pendentes de conferência, declarados como tal, valem 6,0. Páginas editoriais e de navegação: teste automatizado confere cada promessa, nota 9,0 menos 1,0 por link ou âncora quebrados.
- Páginas de Dados e Metodologia: integridade do manifesto conferida no build e nenhuma checagem reprovada; cada checagem de arquivo reprovada tira 0,5 (até 2,0).
- Não se dá 10 em acurácia: o teto abaixo evita representar certeza sobre a fonte.
- Teto 6,0: testes automatizados do módulo falham.
- Teto 7,5: nenhuma gold da página tem ficha de evidência com teste registrado.
- Teto 9,5: teto de acurácia: 8,5 mais 1,0 vezes a fração de fichas com reconciliação independente aprovada.

### Rastreabilidade (peso 10%)

Evidência exigida: Fonte, transformação, versão e reprodução do número.

- Parte do teto aplicável (10 sem teto). Sem fonte declarada na página tira 3,0; sem data de referência ou de conferência tira 2,0; painel numérico sem Comprove este número tira 2,0; painel sem download tira 1,0.
- Ficha Comprove aberta sem sha256, sem fonte ou sem passos de reprodução tira 1,5 por ausência (até 3,0); gold da página fora do manifesto da publicação tira 3,0 por gold.
- Teto 9,5: reprodução por terceiros, fora do ambiente do observatório, não foi exercitada.

### Atualidade e confiabilidade operacional (peso 6%)

Evidência exigida: Atualização, revisão, falha e recuperação verificadas.

- Conjuntos que alimentam a página (publicacao.json, conjuntos[].golds): parte do teto aplicável (10 sem teto). Atrasado tira 1,5; sem dado tira 0,7 (até 3,0); com falha recente de coleta tira 0,3 (até 1,5); captura atrás da fonte tira 0,2 (até 1,0).
- Frase com número e a palavra hoje, sem data, tira 0,5 (até 1,5).
- Página sem conjunto de dados associado (editorial, navegação) fica não aplicável nesta dimensão e sai do cálculo ponderado.
- Teto 9,0: falha e recuperação verificadas por testes com falha simulada, sem exercício em produção.
- Teto variável: 10 menos 4 vezes a fração de conjuntos sem SLA (cadência não monitorável).

### Desempenho e manutenção (peso 5%)

Evidência exigida: Medição, volume de dados, simplicidade e documentação.

- Parte do teto aplicável (10 sem teto). HTML acima de 600 KB tira 2,0 e acima de 1 MB tira 4,0; JavaScript acima de 1 MB tira 1,0; mais de 8.000 nós no DOM tira 1,0 e mais de 15.000 tira 2,0.
- Módulo sem teste automatizado tira 2,0; módulo sem documento em docs/observatorios/energia/modulos tira 1,0. O tempo de carga em laboratório fica registrado como evidência e não pontua: depende da carga da máquina que mede.
- Teto 9,0: desempenho medido só em laboratório, sem dado de campo (LCP, INP, CLS) de usuários reais.

## Limites desta avaliação

- A revisão de didatismo e de qualidade visual foi feita por revisores em contexto limpo (agentes de IA) sobre capturas abertas e o texto da página; não é teste com pessoas e não substitui um.
- As dez jornadas da seção 15.2 foram executadas como roteiro por script em Chromium headless, com verificação de fatos observáveis; não houve participante humano, amostra ou tarefa cronometrada.
- Acessibilidade foi medida com axe-core (WCAG 2.0, 2.1 e 2.2, A e AA) e roteiro de teclado; não houve teste com leitor de tela real (NVDA, JAWS, VoiceOver) nem auditoria manual de todos os critérios, e por isso a nota tem teto de 9,0.
- Desempenho foi medido em laboratório (Chromium headless, sem limitação de rede ou CPU); não há dado de campo (LCP, INP, CLS) de usuários reais, e por isso a nota tem teto de 9,0.
- Correção técnica depende das fichas de evidência e das validações já publicadas nas golds e dos testes do repositório; não houve reconciliação nova com fonte primária nesta avaliação.
- As famílias dinâmicas (verbetes do Aprenda, fichas de conjuntos de Dados e fichas de empresas) foram amostradas (seis páginas de cada); a nota da família vale para a amostra, não para as demais páginas.
- Os limiares de desempenho e de alvo de toque e os pontos de cada dedução são decisão de revisão registrada na rubrica, não norma externa.
- A avaliação mede a página como publicada na rodada indicada; a data de referência dos dados é a da publicação das golds (01/10/2026).
- A página de avaliação não está entre as 94 páginas medidas: ela nasce desta rodada e entra na próxima. O teto de correção por testes usa a execução do repositório de 07/10/2026 nas duas rodadas, de modo que a diferença de correção entre elas vem das medições e não de uma mudança no resultado dos testes.
- Correções feitas depois da medição de uma rodada ficam em posteriores.json e na página como corrigidas depois da medição: valem como mudança de código, não como nota nova.
