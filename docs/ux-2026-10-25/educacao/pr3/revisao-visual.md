# Revisão visual independente — Educação PR3

Revisão de 25/10/2026, somente leitura. Nenhuma alteração na implementação, nenhum teste, servidor ou navegador executado por esta revisão. Critérios do §10 de `.claude/skills/observatorio-layout/SKILL.md`. As 18 imagens fornecidas foram abertas, não apenas enumeradas.

## Evidência inspecionada

Diretório `recortes`, todos os arquivos abaixo:

| Conjunto | 390 | 768 | 1440 | Estado |
|---|---|---|---|---|
| padrao | padrao-390.jpg | padrao-768.jpg | padrao-1440.jpg | Panorama, todas as capitais, escala por habitante, ordenação por nome |
| recife | recife-390.jpg | recife-768.jpg | recife-1440.jpg | Panorama com Recife selecionada; exercício 2025; anos iniciais |
| recurso-educacao | recurso-educacao-390.jpg | recurso-educacao-768.jpg | recurso-educacao-1440.jpg | Cinco elos de Recife |
| laboratorio-ponte | laboratorio-ponte-390.jpg | laboratorio-ponte-768.jpg | laboratorio-ponte-1440.jpg | Ponte de Recife, tabela e ficha de fonte recolhidas |
| pontos | pontos-390.jpg | pontos-768.jpg | pontos-1440.jpg | 26 capitais, gasto por habitante, Recife destacada |
| metodos | metodos-390.jpg | metodos-768.jpg | metodos-1440.jpg | Dados e métodos, escores em preparação ao final |

Limitação técnica importante: o visualizador reduz páginas com mais de 6000 px de altura. Por exemplo, Recife 390 (390×16855) foi exibida em 139×6000; Método 390 (390×30416), em 77×6000. As páginas completas permitem conferir composição, continuidade e localização das seções, mas não certificar cada rótulo pequeno. Os nove recortes dos blocos novos foram inspecionados em resolução suficiente para ler valores, legendas e notas. Não confundo a redução da captura com fonte pequena no produto.

## Resultado observado

Não encontrei bloqueio visual concreto nos blocos novos examinados em detalhe. Há 26 capitais identificadas; Recife permanece na posição alfabética e recebe faixa de destaque. Círculo e losango distinguem observação e mediana sem depender apenas da cor. A diferença tem sinal e unidade, e a escala começa em zero. Em 390 a legenda e os controles quebram linhas sem se sobrepor; os nomes longos continuam legíveis.

Nos cinco elos, o fluxo muda de uma coluna em 390 para duas em 768 e cinco em 1440. Cada medida preserva definição, período/fonte, unidade e estado. As unidades monetárias e percentuais não aparecem duplicadas. O seletor de etapa está imediatamente antes dos modelos no contexto completo. Os universos diferentes e a ausência de interpretação causal estão declarados. Não há setas ou tratamento gráfico que prometa relação causal.

Na ponte, as três parcelas de Recife estão identificadas como dentro ou fora do numerador. Seus percentuais (5,2%, 6,0%, 88,8%) são coerentes com as barras e fecham 100%; o total e a reconciliação aparecem explicitamente. A troca entre razão por habitante e por matrícula explica numeradores e denominadores diferentes. A posição 13ª/5ª não é apresentada como eficiência. Em 390 rótulos longos ficam acima das barras; em 768/1440 a organização em colunas permanece legível. Tabela e fonte ficam disponíveis por controles recolhidos, sem ocupar a leitura inicial.

No estado sem seleção, o panorama conserva as três análises das 26 capitais e apresenta ao final uma orientação para escolher a capital e abrir os elos. No estado Recife, os modelos entram após as análises. As capturas não exibem escores pendentes no panorama. Em Método, o módulo aparece ao final, identificado como preparação e com pendências em vez de valores calculados. O caráter não clicável foi verificado na revisão anterior de código e informado como coberto pelos testes do agente principal; uma imagem não demonstra a ausência de links.

## Rubrica por rota e estado

9 significa o critério demonstrado na evidência disponível, não excepcionalidade. NV é falta de evidência suficiente, não defeito observado. A avaliação de interação exige evidência manual além da automação segundo o §10 e permanece NV nesta revisão estática.

| Rota / estado | Arte | Hierarquia | Tipografia / acabamento | Densidade / profundidade | Didática | Comparabilidade | Interação / acessibilidade | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---|
| Panorama das capitais / todas | 9 | 9 | 9* | 9 | 9 | 9 | NV | 9* |
| Panorama das capitais / Recife, 2025, anos iniciais | 9 | 9 | 9* | 9 | 9 | 9 | NV | 9* |
| Dados e métodos / preparação | 9 | 9 | NV | 9 | NV | NV | NV | NV |

*Notas de acabamento e responsividade do panorama apoiadas nos recortes dos pontos e modelos e na composição completa. Não certificam todos os pixels dos três gráficos, cada tabela expandida ou cada texto preexistente das páginas completas reduzidas. Os gráficos inteiros repetem a estrutura e preservam suas 26 linhas; não há evidência de truncamento estrutural. Para Método, a redução extrema impede pontuar honestamente legibilidade das matrizes, suas unidades e adaptação estreita. Não atribuo 8 por essa ausência de evidência.

Arte 9: mesma paleta sóbria, regras finas e tipos editoriais, cor funcional para destaque, sem decoração sem função. Hierarquia 9: pergunta inicial, referências, três análises separadas, depois modelos; Método organiza grupos com títulos e índice. Densidade 9: profundidade permanece, tabelas do panorama ficam recolhidas, extensão dos gráficos decorre das 26 capitais autorizadas, sem vazio artificial. Didática/comparabilidade 9 do panorama: universos, referências, escalas, unidades e limitações estão junto da leitura. A ponte explica a mudança de perímetro em vez de apenas mostrar duas posições.

## Ajuste opcional de acabamento, sem bloqueio

Em `recurso-educacao-1440.jpg`, a definição mais longa do segundo elo empurra seu valor para baixo dos outros quatro. Isso enfraquece um pouco a varredura horizontal, mas não oculta número, muda ordem ou impede leitura. Se houver trabalho futuro nesse componente, alinhar a linha de valores das cinco colunas sem inserir grandes vazios no celular seria verificável por nova captura 1440. Não recomendo abrir outra rodada apenas por esse polimento nem reduzo a nota global por uma diferença pequena e funcionalmente tolerável.

## Limites e evidência externa

O agente principal informou build aprovado,239 testes unitários e3 testes de navegador aprovados, cobrindo26 capitais, teclado em exercício/etapa, recarga com URL, seleção, ausência de overflow e escores sem links somente em Método. É evidência recebida, não execução independente minha. Informou também ausência de fontes abaixo de 12 px e imagens quebradas. Não usei essa informação para fingir leitura manual de Método 390.

Não examinei nestas 18 imagens outros exercícios, anos finais, dados ausentes/inelegíveis, tabela da ponte aberta, modais de fonte, foco de teclado, toque, contraste medido, estado anônimo redirecionado ou convite do aperitivo. Os testes citados e a revisão de código complementam, mas não substituem evidência visual desses estados. As 48 capturas gerais ainda em coleta não entram nesta conclusão.

Conclusão: os novos blocos do PR3 e sua composição nos dois estados do panorama estão visualmente consistentes nas três larguras, sem defeito impeditivo observado. Método requer recorte legível das partes alteradas para uma certificação tipográfica/responsiva completa; isso é limitação da evidência, não constatação de falha do produto.

## Adendo — recortes do módulo de escores

Abertos `escores-390.jpg`, `escores-768.jpg` e `escores-1440.jpg`, no mesmo diretório. O bloco alterado está legível nas duas larguras maiores: selo «em preparação», proposta experimental, escala de 0 a 100, três componentes pendentes e escore «Não calculável». A observação de que ausência não recebe zero aparece imediatamente sob a tabela. Critérios ficam em um controle recolhido; a fórmula e as condições de comparação ficam abaixo, com bom espaçamento. Não há representação gráfica de um escore inexistente.

Rubrica restrita ao módulo nas larguras 768/1440: arte 9; hierarquia 9; tipografia/acabamento 9; densidade/profundidade 9; didática 9; comparabilidade 9; interação/acessibilidade NV; responsividade 9 para essas duas larguras. Não estendo isso à matriz ou às tabelas preexistentes de Método.

Em 390, a imagem tem 358px de largura e a coluna «Escore»/«Não calculável» termina fora da borda direita. O texto introdutório também chega ao limite do recorte. A tabela usa o componente compartilhado rolável; não há evidência estática suficiente para distinguir integralmente recorte do screenshot, viewport da tabela e overflow indevido. Solicitei ao agente principal confirmação do procedimento de captura. Responsividade e acabamento completos em 390 permanecem NV até essa distinção; não atribuo defeito à rota por um possível artefato. Mesmo nessa imagem, o texto principal explica claramente que os escores ainda não são calculáveis e que ausência não é zero.

A limitação da página Método inteira permanece: as capturas completas foram reduzidas demais para conferir todos os textos e colunas. O adendo reduz a lacuna apenas no módulo alterado.

Confirmação posterior do agente principal: os recortes de escores são screenshots diretos do locator `#escores-servicos`, sem clip manual. `TabelaDados` preserva região rolável focável, `role=region`, nome acessível que informa «tabela rolável», e largura mínima de 28rem. Logo, a última coluna fora do viewport inicial em 390 é compatível com o contrato deliberado de rolagem interna e não prova perda de dado. O agente principal verificará por teclado a chegada à coluna final e o eventual overflow do texto introdutório; até receber essa evidência, mantenho NV nessa verificação, sem reprovar o bloco.

### Fechamento da verificação estreita do módulo de escores

Abri independentemente `recortes/escores-390-coluna-final.jpg` e li `/tmp/educacao-escores-rolagem.log`. A nova imagem mostra a região da tabela com foco visível e a última coluna inteira: «Escore / Não calculável». O texto externo à tabela conserva as quebras de linha. O log registra largura 358, conteúdo 448 e deslocamento 90, exatamente o extremo direito da região. Registra também página 390, bloco 358 e os seis parágrafos com largura de conteúdo igual à largura disponível 358: não há overflow horizontal de texto.

A execução por teclado (oito ArrowRight na região focável) foi feita pelo agente principal. Minha contribuição independente foi inspecionar a imagem resultante e confrontá-la com o log; não executei a interação. Essa evidência resolve a dúvida anterior: a coluna não foi perdida nem cortada de forma inacessível, apenas exige a rolagem interna prevista. O texto encostado à borda no recorte inicial não era overflow de conteúdo.

Atualização restrita ao módulo alterado em 390/768/1440: arte 9; hierarquia 9; tipografia/acabamento 9; densidade/profundidade 9; didática 9; comparabilidade 9; responsividade 9. A tarefa específica de alcançar a última coluna tem evidência de teclado e foco, executada por outro agente e inspecionada por mim. Interação/acessibilidade global permanece NV: não houve inspeção manual independente do conjunto de tarefas, toque ou leitura assistiva. A página Método inteira também conserva as limitações de resolução registradas acima.

## Adendo — matriz geral final de 48 casos

Inspeção independente concluída das 48 imagens de página completa em `coleta-anterior`, build `QdEQE89Q3AcugwG-WUe-N`. Cada prefixo abaixo foi aberto nas larguras 390, 768 e 1440, com e sem sessão (seis imagens por linha):

| Prefixo do arquivo | Estado examinado |
|---|---|
| `educacao_municipal` | Entrada sem cidade |
| `educacao_municipal_ibge_2800100` | Entrada com Amparo do São Francisco |
| `educacao_municipal_ibge_2611606` | Entrada com Recife |
| `educacao_municipal_municipio_2800100` | Ficha de Amparo; aperitivo no estado anônimo |
| `educacao_municipal_mapa` | Mapa; Entrar no estado anônimo |
| `eficiencia_estatal_educacao_municipal_capitais` | Panorama sem seleção; Entrar no estado anônimo |
| `eficiencia_estatal_educacao_municipal_capitais_cap_recife` | Panorama com Recife; Entrar no estado anônimo |
| `eficiencia_estatal_educacao_municipal_capitais_metodos` | Método público nos dois estados |

O sufixo é `-{largura}-{com|sem}-sessao.jpg`. Os arquivos separados `-primeira-tela.jpg` não foram objeto desta rodada; o topo foi visto dentro das páginas completas. Permanecem complementares os 22 recortes já discriminados neste relatório. Nenhum navegador, build ou teste foi executado por mim nesta revisão; não alterei os worktrees.

### Resultado visual e limites

As três entradas preservam a hierarquia e a informação municipal. Amparo apresenta 5,3/3,8; Recife 5,8/4,9. A cidade aparece antes dos indicadores nacionais no estado autenticado. O convite anônimo inclui as 26 capitais e a ponte por matrícula, com quebras naturais e sem disputar com o resultado. A ficha anônima apresenta o aperitivo da cidade, não o conteúdo autenticado. A entrada sem cidade continua com a composição autorizada.

A ficha autenticada mantém séries, lacunas, metas, componentes, laboratório, distribuições, matrículas, arquivos e notas. Não observei seção desaparecida ou colisão na composição geral. A imagem de 390 tem 18.528 px e foi reduzida para 126 × 6.000 na inspeção: isso não permite certificar cada rótulo. A avaliação fina dos blocos municipais continua apoiada nos recortes PR2 anteriormente revisados, não em uma falsa leitura de todos os textos desta miniatura.

O mapa conserva a legenda de 20 classes, ausência hachurada, busca, controles, motivos de ausência e tabela. A legenda estreita é longa, mas os intervalos permanecem explícitos; em 1440 a tabela fica ao lado. A tabela tem rolagem interna: a última linha parcialmente exposta e a coluna fora do viewport em 390 não demonstram perda de dado. O estado anônimo é acesso bloqueado com página Entrar, não uma publicação do mapa. Persiste apenas o acabamento já registrado no PR2: o resumo repete a unidade nos extremos («Valores de 3,3 Ideb, de 0 a 10 a 10,0 Ideb, de 0 a 10»). Sugestão verificável: «Valores de 3,3 a 10,0; Ideb, escala de 0 a 10». Não é regressão deste PR nem torna a escala ambígua.

No panorama, o estado sem seleção termina com convite a escolher capital; com Recife aparecem os cinco elos e a ponte. Os três gráficos preservam os 26 nomes, a mediana e o destaque da cidade. Os controles e textos dos módulos novos têm a avaliação detalhada dos recortes anteriores. Não há escore apresentado como calculado no panorama. Método permanece público e apresenta o módulo de escores como preparação, com ausência sem zero.

**Achado concreto adicional, de baixa gravidade:** no gráfico Ideb do panorama com Recife, a coluna de diferença mostra «−0,2», enquanto a frase abaixo diz «0,3 ponto abaixo». Observado nas capturas finais do estado Recife, especialmente 1440. A direção e a ordem não mudam, mas duas formas de exibir a mesma diferença divergem em um décimo. Não atribuo causa de implementação sem investigação; a hipótese é arredondamento do sinal/valor absoluto em torno da mediana. Correção verificável: aplicar uma regra de arredondamento comum à diferença no gráfico e na frase, preservando os valores subjacentes, e conferir ambos no mesmo estado. O problema está no gráfico/texto geral, fora dos dois blocos didáticos novos; não invalida a revisão positiva desses blocos.

Método inteiro continua com limitação de resolução: 390 chega a cerca de 30 mil px, reduzidos a 77 × 6.000. A estrutura foi inspecionada, mas a matriz de referências, todas as colunas e cada parágrafo não foram revalidados visualmente em escala legível. O módulo alterado de escores já dispõe de recortes legíveis nas três larguras e de evidência de rolagem por teclado, conforme adendo anterior.

### Rubrica consolidada por rota/estado

Notas referem-se à evidência visual disponível, incluindo os recortes anteriores explicitamente identificados; não são certificação de todas as tarefas. A = arte; H = hierarquia; T = tipografia/acabamento; D = densidade/profundidade; V = didática visual; C = comparabilidade; I = interação/acessibilidade; R = responsividade.

| Rota/estado, três larguras | A | H | T | D | V | C | I | R |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Entrada sem cidade, anônimo | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Entrada Amparo, anônimo | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Entrada Recife, anônimo | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Entrada sem cidade, com sessão | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Entrada Amparo, com sessão | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Entrada Recife, com sessão | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Ficha Amparo, anônimo (aperitivo) | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Ficha Amparo, com sessão, composição e blocos previamente recortados | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Mapa, com sessão | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Mapa, anônimo | — | — | — | — | — | — | NV | — |
| Panorama sem seleção, com sessão | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Panorama Recife, com sessão | 9 | 9 | 8 | 9 | 9 | 9 | NV | 9 |
| Panorama sem seleção/Recife, anônimo | — | — | — | — | — | — | NV | — |
| Método inteiro, com e sem sessão | 9 | 9 | NV | 9 | NV | NV | NV | NV |
| Módulo de escores e novos blocos didáticos, recortes detalhados | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |

A nota 8 de acabamento no panorama Recife corresponde exclusivamente à divergência −0,2/0,3 observada, com correção verificável acima. Não é falta de evidência. Os NV de Método inteiro e interação são falta de evidência suficiente, não defeitos. Os traços são estados redirecionados para autenticação, que não devem receber notas como se exibissem o painel. A repetição de unidade do mapa é um refinamento pequeno, já conhecido, insuficiente para reduzir a nota por si só. Não encontrei novo bloqueio visual nos blocos acrescentados pelo PR3.

### Evidências automatizadas e ocorrências preservadas

Li o resumo e conferi o JSON da matriz: 48 casos; zero violações axe e zero overflow horizontal. O relatório registra Login secundário zero; isso exclui o redirecionamento principal a Entrar, cujo endereço final consta na matriz. Portanto não implica acesso público aos painéis protegidos.

O lote original registra erro de console nos mapas com sessão em **390 e 768**: `Failed to fetch RSC payload` para `/eficiencia-estatal/educacao-municipal-capitais/metodos`, seguido de `ChunkLoadError: Loading chunk 70769 failed` e timeout. As capturas mostram o mapa renderizado, mas não apago nem reclassifico esses erros. Não há prova suficiente para atribuir causa. A repetição isolada foi anunciada pelo agente principal; `repeticao-mapa-anterior/evidencias.md` ainda não existia ao encerrar esta leitura. Um resultado posterior deve ser acrescentado sem substituir as ocorrências originais.

### Situação da correção do arredondamento

Após o adendo, o agente principal informou ter identificado `Math.round(v * f)` em `src/lib/painel/escalas.ts` como causa da assimetria −0,25 → −0,2 / +0,25 → +0,3. Anunciou correção de exibição por magnitude e sinal, com teste de simetria e do caso Recife, sem mudar classes do mapa. Essa investigação e implementação são dele; ainda não conferi o diff nem as novas imagens. **As 48 capturas acima e a nota 8 de acabamento descrevem a versão anterior a essa correção.** A nota só deve ser atualizada após evidência correspondente ao novo build.

## Adendo — conferência após correção simétrica de arredondamento

Abri as seis capturas solicitadas em `recortes-finais`: `pontos-{390,768,1440}.jpg` e `recife-{390,768,1440}.jpg`. São posteriores à correção, conforme identificação do agente principal. Não reabri as 48 imagens do lote anterior nem atribuo a estas seis uma cobertura equivalente a uma nova matriz completa.

Nos três recortes `pontos`, o gráfico é de **gasto por habitante**, não de Ideb: preserva os 26 nomes, o destaque Recife e a diferença +12 R$ por habitante. Portanto esses recortes demonstram preservação de composição e rótulos, mas não são, sozinhos, prova da correção do meio décimo do Ideb.

Nas páginas completas Recife, a linha destacada do gráfico de Ideb agora apresenta **−0,3**, coerente com a frase **0,3 ponto abaixo**. A leitura é verificável nas imagens 768 e 1440; a página 390 continua reduzida a 139 × 6.000 e não oferece a mesma legibilidade de detalhe. Sua composição permanece estável, com os três gráficos, cinco elos e ponte, sem nova colisão observada. A confirmação da regra comum em todas as larguras também se apoia na leitura de código descrita abaixo; não finjo leitura de cada pequeno caractere da página estreita reduzida.

Conferi somente leitura `src/lib/painel/escalas.ts`: `arredondaExibicao` aplica magnitude e depois sinal, com limpeza do zero negativo. `formatarValor`, `formatarDiferenca` e `sentidoDiferenca` usam essa função. O arredondamento das classes de mapa continua chamando `arredonda`, separadamente. Li o teste em `src/tests/energia-comp-escalas.test.ts`, que cobre simetria em 0,05/0,25/1,25, valor/diferença/sentido e o caso `diferencaPar(5.8, 6.05)` com saída «−0,3». O log `arredondamento.txt` registra 276 testes aprovados em três arquivos. A execução é do agente principal; minha revisão consistiu na leitura do log, código e imagens, sem rodar testes.

**Achado de divergência encerrado para esta versão.** O registro anterior e a nota 8 da versão anterior permanecem como histórico. Na versão corrigida, o acabamento do panorama Recife passa a **9**, porque o defeito concreto que impedia essa nota foi corrigido e a composição já demonstrada foi preservada. Rubrica atual do panorama Recife: arte 9; hierarquia 9; tipografia/acabamento 9; densidade/profundidade 9; didática visual 9; comparabilidade 9; responsividade 9, com as limitações de inspeção detalhadas acima; interação/acessibilidade global NV. Mantêm-se as notas anteriores dos novos blocos e os NV da página Método inteira. Não há novo defeito visual concreto nas seis imagens conferidas.

Este adendo não avalia o cadastro de busca nem antecipa o resultado da suíte geral em andamento. Os dois ChunkLoadError do lote original continuam registrados e não são apagados pela correção de arredondamento.

## Adendo — envelope dos laboratórios, build GFOKxgFZcOaJbB-3QGFOq

Inspecionei as **12 páginas completas** de `depois-envelope`: os prefixos `eficiencia_estatal_educacao_municipal_capitais` e `eficiencia_estatal_educacao_municipal_capitais_cap_recife`, cada um nas larguras 390, 768 e 1440, com e sem sessão. Abri também os **seis recortes** `ideb-{390,768,1440}.jpg` e `laboratorios-{390,768,1440}.jpg` de `recortes-envelope`. Não afirmo ter reaberto os outros 18 recortes desse diretório ou os 48 casos anteriores nesta rodada.

O envelope aparece aberto nas seis páginas autenticadas. Sem seleção, o título «Da despesa ao resultado da sua capital» introduz o convite para escolher a capital. Com Recife, «Laboratórios de Recife» e o subtítulo dos cinco elos e da ponte antecedem os controles e os dois modelos. O sinal horizontal à direita corresponde ao conteúdo exposto. O resumo interno «Ver tabela» conserva seu indicador fechado, sem herdar visualmente o estado aberto do envelope. Não observei título cortado, sobreposição ou desaparecimento de conteúdo após a mudança.

Nos recortes dos laboratórios, os controles ficam empilhados a 390 e lado a lado nas larguras maiores. Os cinco elos passam de uma para duas e cinco colunas; permanecem visíveis definições, unidades, fontes e ressalvas. A definição mais longa da aplicação por matrícula desloca seu número para baixo em 1440, mas não o sobrepõe nem o associa a outro elo. A ponte conserva posições, parcelas e explicação dos numeradores distintos. Os blocos mantêm distinção visual sóbria por fundo, regras e tipografia, sem decoração que dispute com os dados.

Os recortes agora mostram efetivamente o **gráfico de Ideb**, inclusive em 390 com legibilidade suficiente para conferir Recife **−0,3** e a frase **0,3 ponto abaixo**. Fica resolvida a limitação da rodada anterior, cujo recorte de pontos mostrava gasto. O gráfico estreito preserva os 26 nomes, escala 0–10, mediana em losango, pontos das capitais e faixa de Recife. Não há colisão observada entre nome, diferença e marcadores. Mantém-se encerrado o achado de arredondamento; seu registro histórico anterior permanece.

As seis páginas anônimas mostram Entrar: o panorama continua bloqueado para quem não tem sessão. Não se trata de uma versão pública desses gráficos. Li `depois-envelope/evidencias.md`: os 12 casos registram axe 0, console 0, ausência de rolagem horizontal e Login secundário 0. O destino principal de autenticação está registrado separadamente. A coleta e os testes são execução do agente principal; minha contribuição é a inspeção independente de imagens e leitura do relatório, sem rodar navegador, testes ou build.

### Rubrica após o envelope

| Rota/estado, três larguras | Arte | Hierarquia | Tipografia/acabamento | Densidade/profundidade | Didática | Comparabilidade | Interação/acessibilidade global | Responsividade |
|---|---:|---:|---:|---:|---:|---:|---|---:|
| Panorama sem seleção, autenticado | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Panorama Recife, autenticado | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Laboratórios e Ideb, recortes detalhados | 9 | 9 | 9 | 9 | 9 | 9 | NV | 9 |
| Panorama sem seleção/Recife, anônimo (Entrar) | — | — | — | — | — | — | NV | — |

As notas confirmam a composição previamente avaliada: identidade coerente; pergunta e medidas priorizadas; textos e controles sem colisões nos recortes; profundidade preservada sob agrupamento reconhecível; universos, unidades e não causalidade explícitos; mesmos dados e tarefas nas três larguras. Não encontrei defeito visual novo que impeça 9 nesses critérios. Isso não atribui 10 nem substitui a verificação de tarefas por teclado/leitor de tela. O NV de interação representa o limite desta inspeção estática, não um defeito observado.

Limite preservado: as páginas completas longas são reduzidas pelo visualizador a 6.000 px; Recife 390, por exemplo, passa de 390 × 16.982 para 138 × 6.000. A leitura fina do envelope e do Ideb se apoia nos seis recortes, não na miniatura da página inteira. Os NV do Método inteiro e as ocorrências de ChunkLoadError dos lotes anteriores permanecem registrados; este lote de 12 casos sem erros não os apaga nem demonstra sua causa. Nenhuma alteração em worktree foi realizada.
