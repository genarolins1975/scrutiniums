# Apresentação de datas e literais da fonte (Energia e OBEE)

Política, contrato do teste e inventário reconciliado da rodada de 08/10/2026 (PR genarolins1975/scrutiniums#117). Substitui, para o assunto "data crua nas páginas de Energia", o diagnóstico provisório de `VERIFICACAO_FINAL.md`, seção 4, que fica preservado como histórico. Esta é a única descrição vigente da regra; os outros documentos apontam para cá.

## 1. Princípio: distinguir apresentação de evidência

Uma data em formato ISO não é, por si só, um erro. O tratamento depende do papel do texto:

| Papel | Tratamento |
| --- | --- |
| Prosa, rótulo ou explicação ao leitor (inclui `aria-label`, `title`, `alt`, `placeholder`) | Data, competência e instante legíveis, em português, com o original em `<time datetime>` |
| Valor, trecho ou identificador que precisa ser preservado como a fonte ou o pipeline o escreveu | `LiteralFonte`: texto intacto, rótulo visível com a origem, endereço da origem em `data-origem` |
| Atributos e dados de máquina (`datetime`, `href`, `data-*`, ids, gold, CSV, XLSX, JSON) | Formato canônico, sem mudança |

## 2. Política de apresentação

Implementada em `src/lib/texto-datas.ts` (formatador), `src/components/TextoComDatas.tsx` e, para Energia, `src/components/energia/TextoEnergia.tsx`.

| Tipo na fonte | Apresentação | Exemplo real |
| --- | --- | --- |
| Competência mensal em prosa | Mês por extenso, sem inventar dia; abreviado (`out/2005`) em célula de tabela | `2026-06` → `junho de 2026`; `2005-10` → `out/2005` |
| Data civil | `dd/mm/aaaa`, sem conversão de fuso nem horário | `2025-12-31` → `31/12/2025` |
| Instante com `Z` | UTC, com a precisão recebida (segundos incluídos) | `2026-09-30T00:00Z` → `30/09/2026 às 00h00 UTC`; `2026-10-01T06:40:21Z` → `01/10/2026 às 06h40min21s UTC` |
| Instante com deslocamento | O deslocamento é mantido | `2026-09-29T21:00-03:00` → `29/09/2026 às 21h00 (UTC−03:00)` |
| Horário sem fuso | Só recebe fuso se o chamador informa uma convenção documentada; senão: "fuso não informado" | Energia informa `Brasília` (convenção do domínio, registrada em `src/lib/energia/formato.ts`); o OBEE não informa |
| Identificador, URL, nome de arquivo | Intactos: a data não pode estar colada a letra, dígito, `_`, `@`, `/`, `.`, `%`, `#`, `=`, `&`, `?`, `~`, `+` nem `-` | `Despacho_2025-02-29.xlsx`, `https://x/2024-04-01.csv` |
| Data inexistente ou horário inválido | Nunca corrigido: `2021-02-29`, mês 13 e hora 25 ficam como vieram; fora de um literal registrado, reprovam o gate | `2021-02-29` |
| Data válida no calendário, mas incompatível com o contexto | Formatável como qualquer data; quando a página a cita como anomalia, é literal | `3036-03-13` |

Regras do formatador: uma ocorrência é a expressão completa, contada uma vez, com precedência instante > data > competência; o calendário (inclusive bissexto) e o relógio são validados antes de formatar; frase que começa pela data ganha inicial maiúscula.

Onde o tratamento ocorre (um ponto compartilhado, não uma regra por página): gaveta "Sobre este dado" (limitações, transformações, descrição da fonte); `TabelaInterativa`, `TransicaoTabela`, `TerritorioTabela` e `ExpansaoTabelaSimples` (texto das células); `ExpansaoLimitacoes`; títulos de tabela (`textoComDatas`); e os pontos de página que montam frases com texto do pipeline (Carga, empresas, PLD, regulação, qualidade, Visão geral). `textoData` (células de data) deixou de repassar como válida uma data que o calendário não admite.

## 3. Literais da fonte

Registro de classes em `src/lib/literais-fonte.ts`. O texto do literal é escapado, copiável e nunca HTML. O rótulo visível sai do papel e da fonte curta.

| Papel (rótulo) | Classe | Conteúdo preservado | Origem registrada |
| --- | --- | --- | --- |
| Trecho da fonte | `texto-direitos-camada` | `EPE, ONS, IBGE; 2020-09-11; criação`, o `copyrightText` do serviço de mapas citado entre aspas | WebMap EPE |
| Valor na fonte | `marcador-ausencia-siga` | `1900-01-03`, o marcador que o SIGA grava no lugar de uma data de entrada em operação | Dados abertos da ANEEL, SIGA |
| Valor na fonte | `data-planilha-inexistente` | Datas de planilha do MCTI que não existem no calendário (`2021-02-29`, `2025-02-29`, `2025-02-30`, …) | Página de fatores de emissão do MCTI |
| Valor na fonte | `data-fim-fora-da-cronologia` | `3036-03-13`, data de fim de evento posterior à geração do arquivo (válida no calendário, cronologia inconsistente) | Dados abertos da ANEEL |
| Identificador gerado pelo observatório | `ato-retificacao-sem-numero` | `DSP-RET 2016-11-24`: espécie do ato + data de publicação, composta pelo pipeline (`SIGLA_ATO` em `aneel_conta.py`) como chave do ato | Dados abertos da ANEEL |
| Registro composto pelo observatório | `registro-composto-bandeiras` | Campos do conjunto de dados de bandeiras (ato; vigência ou competência; patamar; valor) reunidos pelo pipeline com `;` | Dados abertos da ANEEL |

Reavaliação da classificação provisória (P/B) do relatório anterior, a partir do código do pipeline:

* **Trecho das bandeiras**: não é citação do ato. Para os eventos de origem `conjunto_de_dados`, o pipeline compõe a string (`regulacao.py`, ``"; ".join(f"{ato};{ini};{patamar};{valor}")``), `trecho_confere` é nulo e o ato não foi lido; nos acionamentos mensais agrupados (`2015-09 a 2016-01;Vermelha P1;45,00`) o intervalo é composição do pipeline. Por isso o rótulo é "Registro composto pelo observatório", e a linha da evidência deixou de dizer "Trecho:" para esses eventos. Trechos de atos lidos no PDF seguem como citação (`<q>`).
* **`DSP-RET 2016-11-24`**: identificador gerado pelo pipeline, não texto da fonte.
* **`DFP 2019-12-31 individual: x1000`** e **"escala da DFP de 2025-12-31"**: rótulos compostos pelo pipeline para a conversão de escala. A data é prosa e foi formatada (`31/12/2019`), não é literal da fonte.
* **Marcador do SIGA**: a versão 1 do formatador (commit `77ded6400`) formatava `1900-01-03` como `03/01/1900` na gaveta, apresentando o marcador de ausência como data comum. A versão atual preserva o literal.
* **Competências em prosa** (território, regulação, PLD, expansão, Visão geral, qualidade) e **períodos de fontes** (Carga): prosa gerada, formatada.

## 4. Contrato do teste de HTML

`src/tests/html-gerado.test.ts`, com a análise em `src/tests/support/html-contrato.ts` (árvore DOM do `parse5`; não procura datas no HTML sem tags).

* **Prosa**: o texto de cada elemento (texto direto, juntando nós adjacentes separados por comentários de hidratação) e os atributos `aria-label`, `aria-description`, `title`, `alt` e `placeholder`. Qualquer data, competência ou instante ISO, válido ou não, reprova (`data-iso-em-prosa`); `undefined` e `NaN` reprovam (`undefined-nan`). O padrão antigo (`20AA/MM` e `20AA-MM`) continua valendo.
* **Atributos e dados de máquina**: livres (`datetime`, `href`, `data-*`, `id`), `script`, `style`, `template` e `noscript` ficam de fora.
* **Literais** (`data-literal-fonte`): só são aceitos se a classe estiver registrada; o contêiner for `<span>` com `data-origem` (https ou caminho do site); houver exatamente um rótulo visível (não `sr-only`, não oculto) com o texto do papel e da fonte curta, e um valor em `<code>` ou `<q>` só com texto; o conteúdo casar com o padrão da classe e caber no tamanho máximo dela; e não houver literal aninhado nem texto solto. O literal não autoriza ignorar o texto ao redor.
* **Cobertura obrigatória** (`EXIGIR_BUILD_HTML=1`, no CI): build, rotas esperadas e páginas ausentes reprovam; sem a variável e sem build, os testes ficam ignorados.
* **Registro auditável**: nenhuma classe admite `undefined` ou `NaN`; classe nova exige entrada em `literais-fonte.ts` (revisada como código); o log de cada execução lista os literais por classe. Não há lista de páginas dispensadas: todas as páginas passam pelo mesmo contrato, e o registro é por classe de conteúdo, não por rota. Não há regeneração automática de expectativas.

Casos negativos (fixtures sintéticas em `src/tests/html-contrato.test.ts`, 23 testes; formatador em `src/tests/texto-datas.test.ts`, 15):

| Caso | Resultado |
| --- | --- |
| Data, competência ou instante crus em prosa | Reprova |
| Data inexistente em prosa | Reprova, com "inválida" na mensagem |
| Data partida por comentário de hidratação | Reprova |
| Data em `aria-label` | Reprova; em `href`, `data-*`, `datetime`, ids: livre |
| Prosa crua em `<code>` ou em `<span data-literal>` genérico | Reprova |
| Contêiner amplo ou prosa marcada como literal | Reprova (`literal-fora-do-padrao`) |
| Literal sem origem, com origem malformada (`javascript:`), de classe desconhecida, aninhado, com rótulo oculto ou diferente, com texto solto ou elemento extra | Reprova, com mensagem da regra |
| Data crua em prosa ao lado de literal válido | Reprova (a prosa), o literal conta |
| `undefined` ou `NaN` em prosa ou em literal | Reprova |
| Build ausente; rota esperada ausente; poucas páginas | Reprova com a instrução de gerar o build |
| URL, identificador e nome de arquivo com data em prosa | Aceito |
| Literal registrado, com origem e rótulo | Aceito |

## 5. Inventário reconciliado

Contagens que parecem divergentes e por quê:

| Número | De onde vem |
| --- | --- |
| 122 (`5 instantes, 66 dias, 51 meses`) | Varredura de 24 páginas, anterior à correção da gaveta (inclui 2 do OBEE, 1 de `chuva-e-temperatura` e 1 de `pld/diferencas-regionais`, hoje tratadas, e 5 de listas da gaveta) |
| 113 (21 páginas) | Varredura posterior à gaveta v1, pelo regex antigo do teste (exige espaço ou `(` antes e `20AA`), só `setor-eletrico`; o regex antigo não via `1900-01-03` nem datas seguidas de `:` |
| 143 (22 páginas) | Gramática nova, nó de texto a nó de texto, sem atributos |
| 147 | 143 mais 4 datas seguidas de `:` (`2021-03-31: coluna_nao_preenchida`, `2026-09-16: …`), que o regex antigo e a primeira varredura excluíam |
| **150 (23 páginas)** | Contrato atual no commit `10f64b302`: os 147 do texto + 3 em atributos lidos (1 `aria-label` e 2 `placeholder`) |

Uma ocorrência é a expressão completa, contada uma vez; instante, data e competência são mutuamente exclusivos (em `10f64b302`: 82 datas, 53 competências, 2 instantes e 13 datas inválidas).

Resultado por rota, de `10f64b302` para o commit final (`scripts/inventario-datas.mjs`; localização de cada ocorrência antiga no HTML novo, por `<time datetime>` ou por literal):

| Rota | Ocorrências antes | Formatadas (`<time datetime>`) | Literais preservados | Formatadas em texto | Instrução de uso reescrita | Não localizadas | Violações remanescentes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/setor-eletrico/regulacao/linha-do-tempo` | 43 | 43 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/territorio` | 22 | 21 | 1 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/empresas/financas` | 19 | 19 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/transicao/emissoes` | 16 | 2 | 13 | 0 | 1 | 0 | 0 |
| `/setor-eletrico/empresas/equatorial-go` | 13 | 13 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/regulacao` | 6 | 6 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/carga/perfil-horario` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/pld/historico` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/pld` | 3 | 3 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/carga` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/carga/clima-e-calendario` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/expansao/carteira` | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/expansao/geracao-e-transmissao` | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| `/setor-eletrico/pld/previsoes` | 2 | 2 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/qualidade` | 2 | 1 | 1 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/dados/aneel-siga` | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/dados/cvm-dfp` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/dados/cvm-itr` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/empresas/chesp` | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/empresas/neoenergia-pe` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/expansao` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| `/setor-eletrico/transicao/energia-estimada` | 1 | 0 | 0 | 0 | 1 | 0 | 0 |
| `/setor-eletrico/visao-geral` | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| **Total (23 rotas)** | **150** | **128** | **18** | **2** | **2** | **0** | **0** |

Leitura da tabela:

* **Formatadas**: o texto visível passou a ser legível e o valor original está no atributo `datetime`.
* **Literais preservados** (18 ocorrências em 35 literais, porque um literal pode conter várias datas): evidência intacta e identificada.
* **Formatadas em texto** (2): título de tabela de `geracao-e-transmissao` (caption e `aria-label`), formatado por função; o valor original segue na gold e no CSV/XLSX da tabela.
* **Instrução de uso reescrita** (2): o exemplo `Mês (2025-08)` do campo de busca passou a `Mês (08/2025)`; a busca continua indexando o ISO e o formato exibido, e a instrução agora mostra o que o leitor vê.
* **Não localizadas**: 0. **Violações remanescentes**: 0, nas 360 páginas varridas (359 de Energia e 1 do OBEE).

Literais por classe e rota (35): `marcador-ausencia-siga` 6 (`dados/aneel-siga`, `expansao/carteira` ×3, `expansao/cenarios`, `territorio`), `data-planilha-inexistente` 13 (`transicao/emissoes`), `registro-composto-bandeiras` 13 (`regulacao/linha-do-tempo`), `data-fim-fora-da-cronologia` 1 (`qualidade`), `ato-retificacao-sem-numero` 1 (`empresas/chesp`), `texto-direitos-camada` 1 (`territorio`).

## 6. Antes e depois (texto visível)

| Rota | Antes | Depois |
| --- | --- | --- |
| `/carga` | `período: 2000-01-01 a 2026-09-28` | `período: 01/01/2000 a 28/09/2026` |
| `/territorio` | `última competência publicada: 2005-10 (distribuidora encerrada…)` | `última competência publicada: out/2005 (distribuidora encerrada…)` |
| `/regulacao` | `de 2015-01 a 2015-02` | `de janeiro de 2015 a fevereiro de 2015` |
| `/pld` | `busca de 2026-10-01T06:40:21Z` | `busca de 01/10/2026 às 06h40min21s UTC` |
| `/empresas/equatorial-go` | `DFP 2019-12-31 individual: x1000` | `DFP 31/12/2019 individual: x1000` |
| `/qualidade` | `fim (3036-03-13) posterior à geração do arquivo (2026-08-12)` | `fim (` **`3036-03-13`** `) posterior à geração do arquivo (12/08/2026)`, com `3036-03-13` como "Valor na fonte" |
| `/transicao/emissoes` | `2021-02-29` na coluna "Data na planilha" | O mesmo texto, com o rótulo "Valor na fonte · planilha do MCTI"; a coluna "Motivo" diz "data inexistente no calendário" |
| `/regulacao/linha-do-tempo` | `Trecho: REH nº 3.306/2024;2024-04-01;Amarela;18,85; …` | `Registro no conjunto de dados:` "Registro composto pelo observatório · dados abertos da ANEEL" e o mesmo texto |
| `/dados/aneel-siga` | `inclui o marcador 1900-01-03 do SIGA` (v1 da gaveta: `03/01/1900`) | `inclui o marcador` "Valor na fonte · SIGA/ANEEL" `1900-01-03` `do SIGA` |

## 7. Preservação dos dados

* Nenhum arquivo de `public/`, `data/` nem `pipeline/` foi alterado nesta etapa: a correção está na camada de apresentação (`git diff --stat` do intervalo de commits sem linhas nesses diretórios). Números, unidades, períodos, identificadores, gold, séries e CSV/XLSX continuam como estavam; o mesmo vale para a gold do OBEE (6.667 observações, `hash_dados` `2c1ae8573966662e…`, verificado na rodada anterior e sem mudança de dados desde então).
* Cada uma das 150 ocorrências antigas foi localizada no HTML novo (seção 5).
* A comparação de números renderizados e o contrato rodam sobre o mesmo build; o CI repete o contrato a cada commit.

## 8. Limitações

* O registro de literais é por classe de conteúdo. Uma classe nova de literal (ou uma nova data ISO em prosa de Energia, gerada por um módulo do pipeline) reprova o gate até alguém formatar o texto ou registrar a classe, em revisão de código. Isso é intencional: o gate também atua sobre as atualizações diárias de dados.
* Competência em prosa gerada como "SE 2026-09" fica "SE setembro de 2026": o texto do pipeline não foi reescrito.
* As áreas modificadas foram inspecionadas em 1440, 768, 390 e 320 px (`scripts/obee/energia-datas.mjs`); não houve teste com leitor de tela.

## 9. Inspeção visual e ajustes de layout

Rotas afetadas inspecionadas em 1440, 768, 390 e 320 px com `scripts/obee/energia-datas.mjs` (estouro horizontal, axe e captura dos literais) e `scripts/obee/energia-datas-prosa.mjs` (texto formatado em contexto). Capturas em `docs/obee/capturas/rodada-4/`:

| Captura | O que mostra |
| --- | --- |
| `transicao_emissoes-literal-1440.png`, `-390.png` | Datas de planilha inexistentes preservadas, com rótulo "Valor na fonte · planilha do MCTI" e motivo na coluna ao lado |
| `regulacao_linha-do-tempo-literal-390.png` | Registro composto das bandeiras, com rótulo visível e quebra de linha sem estouro |
| `qualidade-literal-1440.png`, `-320.png` | `3036-03-13` preservado, com a frase que registra a incompatibilidade cronológica |
| `empresas_chesp-literal-390.png` | Identificador `DSP-RET 2016-11-24` |
| `expansao_carteira-literal-1440.png`, `territorio-literal-390.png` | Marcador `1900-01-03` do SIGA e trecho de direitos da camada |
| `competencia-regulacao-1440.png`, `-390.png`, `competencia-territorio-tabela-390.png` | Competência formatada (junho de 2026; abreviada `out/2005` em espaço curto) |
| `instante-utc-pld-1440.png`, `-390.png` | Instante com fuso: `01/10/2026 às 06h40min21s UTC` |
| `periodo-carga-1440.png`, `-390.png` | Período de fonte: `01/01/2000 a 28/09/2026` |

Cinco estouros horizontais anteriores a esta etapa, presentes em rotas afetadas e idênticos no build do commit `10f64b302` (evidência: medição repetida no build de base), foram corrigidos por causas pequenas de CSS, sem redesenho:

* `empresas/financas`: rótulo do seletor com `flex min-w-0 max-w-full flex-col`;
* `pld/previsoes`: dois rótulos e selects com `min-w-0 max-w-full` (`PrevisoesAtual`) e rótulo em `PrevisoesArquivo`;
* `pld`: grade com `grid-cols-[minmax(0,1fr)]` no mobile e `lg:grid-cols-2`;
* `pld/previsoes` (página): gutter `px-6` no rodapé da página.

Após os ajustes, as 23 rotas medem 0 estouro horizontal nas quatro larguras e 0 violações axe.
