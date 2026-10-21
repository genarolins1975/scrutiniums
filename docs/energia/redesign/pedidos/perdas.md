# Pedidos de mudança compartilhada: família Perdas de energia

Rotas `/setor-eletrico/perdas`, `/perdas/composicao`, `/perdas/regulatorio` e `/perdas/custo-e-contexto`. Cada pedido diz o que mudar, por que e em que arquivo. Nenhum bloqueia a família: as páginas seguem com a melhor solução local, descrita em cada item.

## 0. Arquivos sem uso para apagar no fim (regra do coordenador: não apagar componente com o servidor no ar)

- `src/components/energia/PerdasLinkPainel.tsx`: nenhum arquivo o importa mais. O rodapé de cada painel passou a usar o `SeguirPainel` compartilhado, por meio de `PerdasSeguir` (em `PerdasPainel.tsx`).
- `src/components/energia/PerdasLinkConsulta.tsx`: nenhum arquivo o importa mais. A consulta escolhida (período, medida e distribuidora) agora aparece como "Consulta aplicada", com o botão "Restaurar a consulta padrão", dentro de `PerdasExplorador.tsx`.
- Nenhum teste depende dos dois arquivos. Ao apagar, ajustar `docs/observatorios/energia/modulos/perdas.md`: a linha 18 (lista de componentes) cita os dois e não cita os dois componentes novos (`PerdasDistribuicao.tsx` e `PerdasLevaEscolha.tsx`), e as seções 1 e 1.1 descrevem a estrutura anterior das páginas (cartões de destino, painel com título fixo da especificação, contagem de 40 testes).

## 1. `NotasDoPainel` com nome acessível (atendido)

Atendido no componente compartilhado (propriedade `nome`); as páginas de Perdas usam `NotasDoPainel nome=...` e a cópia local `NotasDoPainelNomeadas` saiu.

## 2. `GraficoPontos` com texto de sentido configurável (atendido)

Atendido (propriedade `textoSentido`); a página do percentual técnico passa "maior que no trecho anterior", "menor que no trecho anterior" e "igual ao trecho anterior".

## 3. `NavegacaoLocal` e `SeguirPainel` (a próxima pergunta) não levam um parâmetro de URL do módulo

A escolha da distribuidora (`?d=`, CNPJ de 14 dígitos) precisa seguir de uma página de Perdas para outra (mapa, composição, percentual regulatório, custo). Os dois componentes compartilhados montam o destino (a faixa de páginas, os capítulos e o link "Próxima pergunta") sem conhecer parâmetros próprios de cada família. Proposta: uma propriedade `preservar` (lista de nomes de parâmetro, por exemplo `["d"]`) em `NavegacaoLocal` e em `SeguirPainel`, que copie esses parâmetros da página atual para o destino. Local: `src/components/energia/PerdasLevaEscolha.tsx`, um ouvinte de clique na janela (fase de captura) que, havendo `?d=` válido, acrescenta o parâmetro ao link para outra página `/setor-eletrico/perdas*` e mantém o nível `?modo=` pelo mesmo `urlComNivel` do `ModoProfundidade`. Link com modificador de tecla, de outra origem, de download ou para a mesma página segue sem alteração; sem JavaScript, o link vai sem a escolha. Quando houver `preservar`, apagar o componente.

## 4. Mesmo bloco "Período, universo e unidade" em quase todas as famílias, cada uma com seu componente

O atributo `data-recorte-painel` aparece em componentes locais de mais de vinte arquivos de `src/components/energia` (Água, Carga, Rede, PLD, Geração, Regulação, Qualidade, Empresas, Expansão, Previsões, Inclusão, Transição e Perdas) e em `src/app/setor-eletrico/conta-de-luz/partes.tsx`. Proposta: um `RecortePainel` compartilhado com `periodo`, `universo` e `unidade`, no mesmo `dl`. Local: `Recorte`, em `src/components/energia/PerdasPainel.tsx`.

## 5. Perguntas e promessas antigas de Perdas em arquivos de outras áreas

A abertura de Perdas passou a se chamar "Onde a energia se perde?" (a pergunta da tela 13 da galeria, constante `PERGUNTA_ABERTURA` em `PerdasPainel.tsx`), e a página do percentual regulatório não compara a perda realizada com a referência regulatória (a comparação está indisponível nesta publicação, com o bloqueio e a evidência na própria página). Os textos abaixo ainda dizem o contrário ou repetem a pergunta antiga:

- `src/lib/energia/navegacao.ts`, linha 144: pergunta "Onde se perde energia, quanto e com que efeito econômico?" (trocar por "Onde a energia se perde?"); linha 145: resumo "…o realizado diante da referência regulatória e o custo que chega à tarifa" (sugestão: "…o percentual técnico regulatório e o custo que chega à tarifa");
- `src/lib/energia/mapa.ts`, linha 123: a mesma pergunta antiga; linha 517: rótulo "Realizado diante da referência regulatória" (sugestão: "Percentual técnico regulatório por distribuidora"); linha 634: "…a evolução e a comparação com a referência regulatória" (sugestão: "…a evolução e o percentual técnico regulatório"); linha 728: "quanto a sua distribuidora perde e quanto disso a regulação reconhece" sugere a comparação completa, que a página não faz, e pede revisão;
- `src/app/setor-eletrico/empresas/distribuidoras/page.tsx`, linha 217: texto de reserva do link "próximo" com a pergunta antiga;
- `src/lib/telemetry.ts`, linha 216: rótulo "Perdas: realizado e regulatório" (sugestão: "Perdas: percentual técnico regulatório");
- `docs/observatorios/energia/ESPECIFICACAO.md`, linha 242: a tabela de perguntas guarda a pergunta antiga.

As três páginas filhas também têm pergunta nova: "Como se separam as perdas técnicas e não técnicas?" (composição), "Como mudou o percentual regulatório de perdas técnicas?" (regulatório) e "Qual é a dimensão econômica e territorial das perdas?" (custo e contexto), constantes `PERGUNTA_*` de `PerdasPainel.tsx`.

## 6. Texto de verbete que assimila perda não técnica a causa única

`src/lib/energia/conteudo/conceitos-perdas.ts`, linha 81: a frase em uma linha do verbete "Perdas não técnicas" diz que a perda "decorre principalmente de furto, fraude e erros de medição e de faturamento". A direção da família é que perda não técnica nunca seja equiparada a furto, e as páginas dizem "inclui furto, fraude e erros de medição, de leitura e de faturamento" (a fonte não separa as categorias). Sugestão: "inclui", no lugar de "decorre principalmente de". É texto do glossário (CONFERIDO), por isso não foi alterado.

## 7. Equivalências para a matriz de preservação

- `/perdas/custo-e-contexto`: o painel "Qual é a dimensão econômica das perdas na tarifa?" passou a se chamar "Quanto da tarifa residencial remunera as perdas?" (o mesmo `id="painel-custo"`, o mesmo nível Entender). O rastreador não o casa pelo título (semelhança abaixo de 0,6), então a linha precisa de equivalência manual.
- `/perdas`: o mapa (diagrama da seção `perdas-territorio`, sem `nivel`) aparece no rastreador só em Analisar e Auditar porque a malha municipal chega depois da primeira leitura da página; aberta em Entender, a figura fica visível 0,6 s depois do carregamento (medido). A malha (1,3 MB) e a relação município × distribuidora (565 KB) são lidas ao montar; carregá-las sob demanda (ao chegar perto da seção) faria o rastreador perder o mapa em todos os níveis, a menos que ele role a página.
- `/perdas`, painel "Onde estão as perdas e como evoluíram?": virou "Como variam as perdas entre as distribuidoras?" (`id="painel-mapa"`, Entender). O comparador de até quatro distribuidoras foi promovido de Analisar para Entender (`perdas-comparar`); as séries nacionais de técnica e não técnica e suas tabelas, em `/perdas/composicao`, também (`separacao-nacional`).

## 8. Rodada 2 (parte técnica e de produto): o que foi corrigido, o que fica como pendência e o que se pede ao pipeline

Corrigido nesta rodada, com teste em `src/tests/energia-perdas-coerencia.test.ts`: (a) a frase da distribuidora escolhida no percentual técnico diz a diferença dos dois valores que ela mesma mostra (antes misturava `troca_pp` com o trecho anterior de referência: 7 de 49 erradas); (b) gráfico, frase, tabela e arquivo exportado têm uma só diferença, "contra o trecho anterior de referência" (a coluna `troca_pp` do pipeline saiu da tabela); (c) em Custo e contexto a base econômica está no título da coluna, no do gráfico, na primeira frase e numa linha `limite` do cabeçalho; (d) o total no fim da barra é o número da tabela em composição (14,23 e 10,44) e em custo (14,65), sem nota que explique dois valores. Também: denominador de 2025 junto da taxa (TWh e aviso de que a taxa da ANEEL pode diferir), a perda técnica do SAMP chamada de "informada no balanço de energia" nas explicações e no verbete, contagem da soma nacional por medida (18 na técnica e na não técnica) e "nenhuma" no lugar de "sem dado" quando nada fica fora da soma.

### Pedidos ao pipeline (a gold, os CSV e as fichas não foram regenerados)

- **Referência regulatória (bloqueio que não se resolve na interface).** Fonte primária e extração do relatório "Perdas de Energia Elétrica na Distribuição" da ANEEL, edição 2026 (ano-base 2025): percentual técnico regulatório por concessionária (Figura 7), não técnica real e regulatória (Figuras 8 e 10) e peso das não técnicas na tarifa (Figura 16). As figuras vêm da leitura visual da avaliação independente de 09/10/2026 em cópia de terceiros; o observatório não leu a fonte primária e a página não usa número dessa cópia. Os endereços da ANEEL responderam 403 com desafio de verificação em 30/09/2026 e em 09/10/2026.
- **Definição da troca.** `perdas_tecnicas_regulatorias.csv` (coluna `troca_pp`) e o teste `resolucao_associada` das fichas dizem "contra o trecho anterior", mas medem contra o trecho imediatamente anterior de 2 meses ou mais (curto ou não) ou, no primeiro trecho, contra a razão do mês anterior (CERFOX −49,709, ENEL CE −1,648). Pedir a coluna `diferenca_referencia_pp` (contra o trecho de referência anterior) e o texto da ficha com a mesma definição da página; a ficha segue com a nota "a ficha cita a troca contra o trecho imediatamente anterior".
- **Rótulos da gold.** `definicoes.perdas_tecnicas` e `definicoes.tecnica_regulatoria`, os títulos da proveniência e das fichas ainda dizem "percentual regulatório do processo tarifário" ou "regulatório implícito" para a perda técnica do SAMP, que é a informada no balanço de energia e pode diferir do percentual homologado.
- **Fichas "Comprove" com uma casa.** `valor_exibido` da taxa nacional, do acumulado e da não técnica traz 14,7%, 14,8% e 15,0% enquanto a página mostra 14,75%, 14,77% e 14,99%: gerar a ficha com a precisão da página.
- **Tarifa de Aplicação.** `perdas_tarifa_b1.csv` traz as duas bases (Base Econômica e Tarifa de Aplicação, com quatro casas), a gold JSON só a Base Econômica com duas casas: pedir a Tarifa de Aplicação na gold para a página mostrar as duas lado a lado e a diferença entre elas. Pedir também as componentes de custo com quatro casas na gold, para o gráfico não depender do ajuste de desenho de `componentesParaBarra`.
- **Rastreabilidade.** Código `d329b83c69a5+alterado` (árvore suja) em toda ficha, e reprodução que exige silver e bronze não publicados. A conferência independente de 09/10/2026 achou o sha256 do Parquet igual ao da ANEEL e os CSV mensais iguais ao arquivo bruto, o que a ficha ainda não diz.
- **Reconciliação de 2025.** A taxa de 14,75% usa a energia injetada de referência; o relatório da ANEEL 2026/2025 traz outra injetada e outra taxa. Reconciliar na próxima coleta, com a fonte primária.
- **Contagem de quem publica a técnica.** A série nacional conta quem entra na soma (18 em 2025); quem publicou a técnica nos 12 meses é uma a mais (ELFSM, fora da soma porque a decomposição não fecha). Pedir `n_publicaram_tecnica` na linha nacional.

### Pendências declaradas (não feitas nesta rodada)

- Técnica (d), (e), (g): bases e definições dentro de gavetas (injetada de referência nos indicadores); ano de cada linha ao lado do valor no percentual técnico (50% dos trechos mais recentes terminam antes de 2025) e no custo (processo de 2014 ao lado de 2026); nota de rastreabilidade na ficha (sha256 e CSV mensal conferidos em 09/10/2026).
- Técnica, itens de profundidade: quartis e grupos por porte nas faixas, evolução da dispersão, referência regulatória, custo total em reais e Tarifa de Aplicação na página (aguardam o pipeline acima).
- Produto (a): o resumo nacional ("14,75%"), "O que mudou" e "Como interpretar" do mapa seguem o ano de referência quando o leitor muda período ou medida; a frase e a ficha da dispersão de custo seguem a taxa total quando o eixo vira "não técnicas". O selo de natureza do painel segue "Calculado, Observado" com perdas técnicas e não técnicas escolhidas.
- Produto (b): siglas e jargão sem tradução no ponto de uso (MMGD, BT, TUSD, TE, REH, B1, SIGEL, BDGD, GDAL); nota "liberação de acesso automatizado aos endereços tentados"; códigos P055, P057, P058, S5, S6 e `vigencia_encerrada` em Auditar (vêm de textos da gold).
- Produto (d), (e), (f), (g): acessos repetidos às tabelas ("Dados do gráfico em tabela", "Resumo em tabela", "Ver a tabela completa") e dois avisos de ano aberto seguidos; gráficos longos que abrem só com o topo (11 de 19, 11 de 80, 12 de 49) e frase de abertura que cita extremo fora da primeira tela; tabelas que abrem com linha fora da comparação (2020) ou encerrada (CERR) no topo; título do eixo x truncado sem a unidade da dispersão em 320 e 390; síntese "quantas subiram, caíram ou ficaram iguais" e abertura do percentual técnico com o achado; ordem do gráfico na URL do percentual técnico (já passa `chaveUrl`, a conferir).
- Mapa: a malha (1,3 MB) e a relação município por distribuidora (565 KB) são lidas ao montar; carga sob demanda faria o rastreador perder o mapa em todos os níveis.
