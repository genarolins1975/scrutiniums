# Módulo Previsões (P013 a P016): previsão do PLD, modelos, arquivo de emissões e desempenho

Gold: `public/energia/gold/previsoes_desempenho.json` (este módulo, `pipeline/energia/modulos/previsoes.py`, família de silver `previsoes`, ordem 90), com `previsoes.json` e `modelos.json` montadas por `pipeline/energia/gold/modelos.py`. Código de previsão: `pipeline/energia/previsoes/` (calendário, variáveis, modelos, avaliação, arquivo, emissão). Rotina: `.github/workflows/previsao-pld.yml`. Governança: `docs/observatorios/PLD_GOVERNANCA_PREVISAO.md`. Situação descrita em 01/10/2026, fase de dados (páginas ainda não reescritas), depois da correção dos defeitos apontados pela verificação adversarial de 01/10/2026 (seção 4.5).

## 1. Painéis e estado honesto

| Painel | Pergunta | Estado nos dados | O que falta |
| --- | --- | --- | --- |
| P013 Previsão atual | Quais os preços possíveis nos próximos períodos? | **Parcial.** Grade 4 × 7 com números reais da referência experimental B0 (rodada de 30/09/2026), identificada como tal, sem faixa (nenhum segmento calibrado). PLD já publicado para as horas depois do corte mostrado à parte, como dado. Cada número publicado tem evidência ("Comprove este número": `evidencias.b0_semanal_SE` a `b0_mensal_N` e `pld_no_corte_SE` a `pld_no_corte_N`) e proveniência própria (`previsao_atual.proveniencia`, natureza PREVISTO; `ja_publicado_no_corte.proveniencia`, OBSERVADO). Previsão principal sem número: nenhum modelo em PRODUÇÃO. | Modelo aprovado (revisão independente e promoção pelo responsável); faixa calibrada; página. |
| P014 Registro de modelos | Como cada previsão foi calculada? | **Concluído com limitação declarada.** Fichas de B0, S0, C2-P e C2-H com entradas, transformações, configuração (sha256), coeficientes do último ajuste por segmento, corte, versão, hipóteses, aprovação e limitações; reexecução do arquivo confere (28 de 28, tolerância R$ 0,005/MWh). C1: pesos não publicáveis (configuração fora do repositório). | Página; configuração do C1, se a pesquisa a publicar. |
| P015 Arquivo de emissões | O que foi previsto antes do resultado? | **Concluído nos dados, com prospectivo ainda curto.** Arquivo particionado por mês, encadeado por hash, com emissão, entrega, versão, atraso, falha e motivo; revisão entre rodadas para a mesma entrega; apuração automática quando a entrega termina. Duas rodadas registradas (27/09 transcrita da pesquisa, sem número; 30/09 do observatório, 28 números, manual e atrasada). A partição publicada é uma projeção do arquivo versionado: sob retenção, omite a cobertura do teste retrospectivo que a rodada de 30/09 gravou (seção 3.4). | Rodadas agendadas reais; entregas maturadas (a primeira entrega a terminar é W2026-10-03, em 10/10/2026; a primeira mensal, M2026-10, em 01/11/2026); página. |
| P016 Desempenho e calibração | O modelo supera referências simples? | **Bloqueado por decisão pendente do responsável (sem números no portal).** O cálculo está pronto e validado a cada execução: teste retrospectivo fora da amostra (1.734 origens diárias, 48.552 células por modelo), MAE, viés, RMSE, perda quantílica, cobertura e largura por horizonte e submercado, ganho pareado sobre o B0 com IC por bootstrap de blocos, regimes, extremos, sensibilidade LAT1D/LAT2D/LAT3D, separação desenvolvimento e teste. A regra do registro de modelos só admite números de desempenho no portal depois da liberação formal pelo responsável pela plataforma, ainda não registrada: a gold traz `publicacao_desempenho.estado = RETIDA`, `desempenho.publicado = false`, `selecao`, `regimes`, `sensibilidade_latencia` e `g23_r1` nulos, nenhuma evidência de MAE e nenhum CSV do teste retrospectivo; os resultados ficam em `data/energia/previsoes/validacao_interna/` (fora do portal, seção 4.2). Prospectivo sem entrega apurada. | Decisão do responsável em `validacao_observatorio.decisao_publicacao` (estado LIBERADA, nome, data e escopo); depois, amostra prospectiva, calibração com n ≥ 100 entregas e página. |

Nenhum dos quatro painéis está declarado concluído integralmente: P013 depende de aprovação que a governança reserva a revisor e responsável externos, P016 depende da decisão de publicação do responsável, e a rotina diária só será comprovada por execuções agendadas reais.

## 2. Fontes verificadas (30/09 e 01/10/2026)

| Órgão e conjunto | Recurso | Acesso e licença | Período e grão | Situação |
| --- | --- | --- | --- | --- |
| CCEE, PLD_HORARIO | `pld_horario_2021` a `pld_horario_2026` (CSV anual; `MES_REFERENCIA;SUBMERCADO;PERIODO_COMERCIALIZACAO;DIA;HORA;PLD_HORA`, hora local 0 a 23) | CC-BY-4.0 (`package_show` de 01/10/2026: `license_id` CC-BY-4.0, `metadata_modified` 2026-09-30T22:19:53). O bloqueio depende do cliente, não do ambiente: em 30/09/2026 às 23h05 UTC e em 01/10/2026 às 06h59 UTC o `curl` recebeu HTTP 403 ("Acesso bloqueado") de `dadosabertos.ccee.org.br` e `pda-download.ccee.org.br`; em 01/10/2026 às 06h59 UTC o cliente padrão do pipeline (`pipeline.common.http_get`, urllib, User-Agent do projeto, o mesmo do workflow noturno, sem nenhuma alteração) recebeu HTTP 200 do mesmo `package_show`. A coleta direta do PLD pela rotina funciona por esse cliente (as capturas de 29/09 e 30/09 vieram dele); nada foi alterado para contornar o bloqueio. | 01/01/2021 00h a 30/09/2026 23h, horário, 4 submercados, 50.376 horas cada, sem hora faltante. | Lido do silver principal (só leitura): seed versionado capturado em 27/09/2026 15h44 UTC e duas capturas diretas do workflow noturno (29/09 02h43 UTC e 30/09 02h20 UTC). Nenhuma revisão entre as 8 vintages. `last_modified` do recurso não acompanha o conteúdo (achado A09): a data de publicação de cada hora é desconhecida. |
| ONS, EAR diário por subsistema | `EAR_DIARIO_SUBSISTEMA_AAAA.csv`, campos `ear_data`, `ear_verif_subsistema_percentual` | `package_show` em 30/09/2026: licença "Creative Commons Atribuição", `metadata_modified` 2026-09-30T22:01:37Z. Dicionário PDF (versão 1.1, 13/09/2022), sha256 `60f945f9…`, guardado no bronze pela coleta do módulo. | Na fonte: 2000 a 29/09/2026 (arquivo baixado em 30/09 às 22h UTC para o recorte dos testes). Na gold: integrado até 28/09/2026 (silver principal, captura de 30/09/2026 02h19 UTC; `dados.ultimo_dia_ear`); o dia 29/09 entra na próxima coleta noturna. Diário, 4 subsistemas; às 19h de Brasília o arquivo chega até o dia anterior. | Silver principal (só leitura). 22 observações de EAR (%) revisadas entre capturas, maior revisão 0,14 p.p. |
| ONS, ENA diário por subsistema | `ENA_DIARIO_SUBSISTEMA_AAAA.csv`, campos `ena_data`, `ena_bruta_regiao_percentualmlt` | Mesma licença; dicionário PDF sha256 `8ac66872…` (o campo em % da MLT admite valor negativo). | Na fonte: até 29/09/2026. Na gold: integrado até 28/09/2026 (captura de 30/09/2026 02h19 UTC; `dados.ultimo_dia_ena`). | Silver principal. 90 observações de ENA bruta (% da MLT) revisadas, maior revisão 3,06 p.p.: risco de olhar o futuro no teste do C2-H, declarado. |
| ANEEL, limites do PLD | Atos anuais (REH e despachos), via `pipeline.energia.regulatorio.limites_pld()` (módulo Regulação) | Documentos oficiais citados pelo módulo Regulação. | 2021 a 2026 (piso, teto horário, teto estrutural, com data de publicação). 2027 ainda sem ato. | Usados para restringir previsões à faixa conhecida na origem e para conferir o realizado. |

Coleta própria (família `previsoes`, `data/energia/silver/previsoes.db`): os dois dicionários do ONS (PDF) com sha256 e vintage, e a conferência de que os campos usados pelo C2-H continuam definidos (`dados.dicionarios_ons` na gold). O PLD, a EAR e a ENA não são recoletados aqui: vêm do silver principal, mantido pelo pipeline noturno, e a rodada diária tenta a CCEE e o ONS de novo antes do corte quando falta dado.

## 3. Método

### 3.1 Alvo, realizado e calendário (`pipeline/energia/previsoes/calendario.py`)

* Alvo: PLD médio temporal da entrega, por submercado, em R$/MWh nominais = média aritmética simples de todas as horas do PLD horário da CCEE na entrega. Não é média ponderada pela carga.
* Semana: sábado 00h (incluído) ao sábado seguinte 00h (excluído), hora de Brasília, 168 horas (semana operativa da CCEE e do ONS). W1 é a primeira semana que começa depois do dia de origem: origem na sexta, W1 começa no sábado seguinte; origem no sábado, a semana em curso não conta e W1 começa no outro sábado. W2 a W4 seguem.
* Mês: mês civil, do dia 1º 00h ao 1º do mês seguinte 00h (excluído). M1 é o primeiro mês que começa depois do dia de origem (no dia 1º, às 07h, o mês já começou e M1 é o seguinte).
* Realizado: só com todas as horas da entrega; entrega incompleta não tem realizado nem média parcial.
* Corte: 07h00 de Brasília do dia de origem (10h00 UTC); prazo de emissão 08h00. A emissão usa `como_estava_em(corte)`.
* Conhecido versus desconhecido: a CCEE publica o PLD de cada dia na véspera; às 07h o PLD das horas restantes do próprio dia já é conhecido e vai para `previsao_atual.ja_publicado_no_corte` como dado observado (na rodada de 30/09: 17 horas, de 07h a 23h, nos quatro submercados). Nenhuma entrega começa antes do dia seguinte à origem, então a fração conhecida de cada entrega no corte é zero; a emissão confere pela captura (`fracao_conhecida`) e, se um dia houver horas publicadas, prevê só o desconhecido e combina as duas partes de forma explícita (testado com captura simulada).
* Elegibilidade LATkD: período [início, fim) é informação quando fim ≤ corte − k dias; como os períodos terminam à meia-noite e o corte é às 07h, equivale a fim ≤ origem − k. LAT1D é a regra dos modelos, tanto no teste retrospectivo quanto na rodada real.

### 3.2 Variáveis (`variaveis.py`) e modelos (`modelos_pld.py`)

* `b0`: média das horas do último período completo elegível da mesma frequência (semana ou mês).
* `mm`: média das horas dos últimos 4 períodos semanais (W) ou 3 mensais (M) elegíveis, incluído o do `b0`.
* `saz`: média das horas do mesmo período um ano antes da entrega (semana que começa 364 dias antes; mesmo mês do ano anterior).
* `d7`: média das horas dos 7 últimos dias elegíveis.
* `ear28`: EAR (% da capacidade) no último dia elegível menos a do 28º dia anterior, em p.p.; `ena7`: média da ENA bruta (% da MLT) nos 7 últimos dias elegíveis.
* B0 = `b0`; S0 = `saz` (referência sazonal); C2 = B0 + Σ_j (x_j ÷ escala_j) · β_j, sem intercepto, coeficiente de B0 fixo em 1, escala RMS do treino, β por mínimos quadrados com penalização λ·n·Σβ² sobre y − B0. C2-P usa `mm − b0`, `saz − b0`, `d7 − b0`; C2-H soma `ear28` e `ena7 − 100`. Um modelo por horizonte × submercado.
* Ajuste semanal (domingo), treino só com entregas terminadas até o domingo menos k dias; mínimo de 52 entregas semanais ou 24 meses. λ na grade ZERO, 3, 1, 0,3, 0,1, 0,03, 0,01, 0,001, escolhido por validação interna no próprio passado (últimas 25% das entregas do treino, mínimo 4; treino interno termina antes da primeira origem de validação menos k dias; erro quadrático; empate fica com a penalização maior). Treino insuficiente deixa a célula sem previsão (nunca vira B0).
* Quantis 5, 10, 25, 50, 75, 90 e 95%: previsão + quantil empírico dos resíduos do próprio modelo no segmento, de entregas já encerradas no corte, nas últimas 52 semanas ou 24 meses; exigem 24 entregas distintas.
* Restrição de preço: previsão e quantis dentro de [piso médio, teto estrutural médio] diários da entrega, pelos atos publicados até o dia anterior à origem; sem ato do ano da entrega, vale o vigente na origem (faixa provisória, sinalizada). A restrição é monótona: quantis não cruzam (conferido em todas as células).
* C1 não foi reimplementado: a composição (referências e pesos) está num arquivo de configuração da pesquisa fora do repositório.
* Configuração congelada: sha256 `cf421e3e43c1df68f553f375e7fde983a5eec702ec68f2df3293dc5cee93d8e0`, registrado em `registro_modelos.json` e conferido por teste.

### 3.3 Avaliação (`avaliacao.py`)

* Origens diárias de 01/01/2022 a 30/09/2026 (1.734), 28 células por origem e modelo; realizado com o PLD vigente.
* Desenvolvimento (seleção) = entregas que terminam até 01/01/2025; teste final = entregas que começam em 01/01/2025 ou depois; entregas na virada ficam fora dos dois. Regra de seleção fixada antes do teste: candidato cujo ganho de MAE sobre o B0 (horizontes e submercados juntos) tem IC de 90% inteiro acima de zero no desenvolvimento. O desenvolvimento é exploratório (a pesquisa examinou 2023 e 2024 antes de definir os candidatos); a separação é de procedimento, o mesmo autor escreveu o código e viu resultados ao depurar.
* Métricas: MAE, viés (previsão − realizado), RMSE; ganho pareado sobre o B0 nas mesmas células com IC de 90% por bootstrap de blocos de calendário das origens (28 dias no semanal, 91 no mensal, 1.000 réplicas, semente fixa), que mantém juntas as células das mesmas origens e dos horizontes sobrepostos; perda quantílica média nos sete níveis (não é CRPS); cobertura P10 a P90 e P5 a P95; largura média; tamanho efetivo em entregas distintas.
* Calibração: CALIBRADO com cobertura P10 a P90 entre 75% e 85% e n ≥ 100 entregas distintas (regra proposta da governança; n em entregas, não em origens).
* Regimes com limiares fixados no desenvolvimento: preço no piso (B0 a até R$ 1/MWh do piso), intermediário e alto (B0 acima do percentil 75); armazenamento baixo, médio e alto (EAR nos tercis); extremo (realizado acima do percentil 90). Grupos com menos de 10 entregas marcados.
* Sensibilidade a atrasos: teste refeito sob LAT2D e LAT3D.

### 3.4 Arquivo e rotina (`arquivo.py`, `emissao.py`, workflow)

* Registros novos em `pipeline/energia/previsoes/emissoes/AAAA-MM.jsonl` (mês de inclusão), encadeados por `anterior`; o legado `arquivo.jsonl` (rodada de 27/09, transcrita da pesquisa em 28/09, `registrado_no_portal_em` = 2026-09-28) fica congelado. A gold `previsoes.json` leva só o índice; cada mês é publicado em `public/energia/series/previsoes_emissoes_AAAA-MM.json`.
* Números de desempenho retidos (regra do registro de modelos, `emissao.publicacao_desempenho`): sem a decisão do responsável registrada com nome e data, a rodada grava em `calibracao` só o estado (CALIBRADO, AMOSTRA_INSUFICIENTE...), as entregas e `cobertura_retida`, nunca a cobertura do teste retrospectivo. A rodada de 30/09/2026 foi gravada antes desta regra e traz `calibracao.cobertura_p10_p90` (com a comparação estrita, seção 4.2); o registro é imutável e não é reescrito. A publicação de cada partição em `public/energia/series` é uma projeção (`emissao.projecao_publica`): omite o campo, marca `omitido_na_publicacao` em cada registro e declara a omissão em `projecao`; o `sha256` e o encadeamento continuam os do registro completo versionado, e a comparação com a publicação anterior segue por `forecast_id` e `sha256`.
* Rodada: gatilhos às 05h47, 06h17, 06h43, 07h13 e 07h37 de Brasília (cron em UTC). O primeiro que roda restaura o silver, confere se o dado elegível já foi capturado (`emissao verificar`), tenta a CCEE e o ONS de novo antes do corte se faltar, espera as 07h00, emite com `como_estava_em(corte)` e commita o arquivo (e a gold, se os testes passarem). Os seguintes veem a rodada registrada e saem. Falha vira registro sem número com motivo; atraso fica em `atraso_min` e no alerta `ATRASADO_APOS_08H`.
* Rotina comprovada só com pelo menos sete rodadas agendadas no prazo e nenhum dia faltante desde a primeira (bloco `rotina` da gold). Hoje: nenhuma execução agendada.

## 4. Evidências de aceite

### 4.1 Números conferidos contra a fonte (outro programa sobre o arquivo original)

Médias calculadas por awk sobre as linhas originais do seed da CCEE (`pipeline/tests/dados/energia_previsoes/`, recorte sem alteração) e comparadas com o construtor de variáveis, com a rodada arquivada e com a gold. Tolerância: 0,0001 R$/MWh contra o awk (6 casas no awk; o PLD tem 2 casas) e R$ 0,005/MWh na reexecução do arquivo (valor gravado com 4 casas).

| Entidade | Período | Gold ou arquivo | Fonte (awk) | Diferença |
| --- | --- | --- | --- | --- |
| B0 semanal SE (W1 da rodada de 30/09) | 19 a 25/09/2026 (168 h) | 124,0911 | 124,091131 | < 0,0001 |
| B0 semanal S | idem | 120,8636 | 120,863571 | < 0,0001 |
| B0 semanal NE | idem | 124,0886 | 124,088571 | < 0,0001 |
| B0 semanal N | idem | 124,0934 | 124,093393 | < 0,0001 |
| B0 mensal SE (M1 a M3 de 30/09) | agosto/2026 (744 h) | 128,1175 | 128,117500 | 0 |
| B0 mensal N | agosto/2026 | 126,7024 | 126,702352 | < 0,0001 |
| B0 mensal SE na origem 30/11/2024 (extremo, formato com aspas) | outubro/2024 | 480,78 (resultado retido: `g23_r1.origem_2024_11_30_mensal` em `previsoes_desempenho_interno.json`, fora do portal) | 480,784503 | < 0,005 |
| Sazonal W1 SE (semana de 04/10/2025) | 04 a 10/10/2025 | teste | 258,330179 | < 0,00001 |
| Média móvel 4 semanas SE | 29/08 a 25/09/2026 | teste | 134,455833 | < 0,00001 |
| ENA bruta 7 dias SE (% MLT) | 19 a 25/09/2026 | teste | 183,289529 | < 0,00001 |

Evidência dos números publicados de P013 (gold de 01/10/2026 06h58 UTC): para cada B0 da grade, `evidencias.b0_<semanal|mensal>_<SM>` traz o período usado, as horas, a chave `pld.<SM>`, a consulta com o corte, os arquivos de cada captura até o corte com sha256, numerador (Σ PLD_h) e denominador (horas), e três testes: média refeita hora a hora com o dado como estava no corte (ex.: SE semanal, Σ = 20.847,31 em 168 h, refeita 124,091131, arquivada 124,0911, diferença 0,000031), captura até o corte e reexecução das células. Para o PLD já publicado, `evidencias.pld_no_corte_<SM>` (ex.: NE, Σ = 2.391,02 em 17 h, média 140,648235, conferida também pela verificação). O teste `EvidenciaP013` confere essas evidências contra as médias por awk sobre o arquivo original.

Controles da gold (bloco `validacoes`, todos aprovados em 01/10/2026): 28 células por origem nas 1.734 origens; 9.424 ajustes do C2 com treino só em entregas encerradas até o domingo menos 1 dia (0 violações); nenhuma previsão fora da faixa de preço, não finita ou com quantil cruzado; realizado de 1.208 entregas × submercado dentro de [piso, teto estrutural] vigentes; 13.872 valores de B0 refeitos hora a hora por outro caminho (maior diferença 3,7e-10 R$/MWh); 28 previsões arquivadas refeitas com o dado como estava no corte (0 divergências).

### 4.2 Resultados calculados e retidos (fora do portal)

Não publicados: a regra do registro de modelos só admite números de desempenho no portal depois da liberação formal pelo responsável (seção 1, P016). Ficam em `data/energia/previsoes/validacao_interna/` (não versionado nem servido): `previsoes_desempenho_interno.json` (desempenho, seleção, regimes, sensibilidade, G23-R1 e evidências), `previsoes_desempenho.csv` (métricas por célula, horizonte e frequência) e os dois CSV do teste retrospectivo. Reprodução: `python3 pipeline/energia/executar_modulo.py previsoes --sem-coleta`. Números desta seção: execução de 01/10/2026 06h58 UTC com o PLD até 30/09/2026 (`dados.ultimo_dia_pld`); teste final com entregas de 01/01/2025 a 30/09/2026. Cobertura pela regra corrigida (faixa inclusiva com tolerância de 1e-6 R$/MWh, seção 4.5).

| Horizonte | B0 MAE | C2-P MAE | Ganho do C2-P sobre B0 (IC 90%) | C2-H MAE | S0 MAE | Cobertura P10 a P90 do B0 |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | 47,79 | 45,47 | 2,32 (0,74 a 4,26) | 45,83 | 125,47 | 78,2% |
| W2 | 56,38 | 53,38 | 3,00 (1,06 a 5,29) | 53,79 | 125,47 | 80,0% |
| W3 | 61,96 | 60,79 | 1,17 (−0,55 a 3,01) | 61,60 | 125,47 | 80,9% |
| W4 | 67,13 | 65,55 | 1,57 (−0,68 a 3,88) | 66,64 | 125,47 | 78,5% |
| M1 | 65,84 | 67,78 | −1,94 (−14,32 a 8,48) | 70,39 | 121,11 | 70,0% |
| M2 | 89,46 | 72,12 | 17,34 (−7,06 a 50,67) | 72,59 | 121,74 | 59,5% |
| M3 | 114,76 | 103,48 | 11,28 (−8,39 a 36,46) | 105,82 | 121,68 | 48,9% |

R$/MWh; 90 entregas semanais e 21 mensais distintas; os quatro submercados juntos. Origem dos valores: `previsoes_desempenho.csv` (linhas `recorte = horizonte`, `periodo = teste`; colunas `mae`, `ganho_vs_b0`, `ganho_ic90_inf`, `ganho_ic90_sup`, `cobertura_p10_p90`). Leitura: no semanal o C2-P erra um pouco menos que a persistência em W1 e W2 (cerca de 5%), sem diferença clara em W3 e W4; no mensal a amostra (21 meses) não permite conclusão. A sazonal S0 é muito pior em todos os horizontes. Pela regra fixada antes do teste, **nenhum candidato foi selecionado** no desenvolvimento (C2-P semanal: ganho −0,31, IC −2,75 a 1,32; mensal com apenas 10 entregas e sem IC), então o ganho no teste é relatado, não usado para escolher vencedor. Calibração: nenhum segmento CALIBRADO (90 entregas semanais e 21 mensais ficam abaixo de n = 100). Sensibilidade: com o dado 2 ou 3 dias mais tarde (LAT2D, LAT3D), o MAE do B0 em W1 sobe de 47,79 para 49,09 e 50,39.

Cobertura P10 a P90 do B0 no desenvolvimento (regra corrigida): de 58,9% a 66,7% no semanal (W1 66,7%, W2 64,2%, W3 62,4%, W4 58,9%) e de 0% a 39,7% no mensal (M1 39,7%, M2 27,6%, M3 0%). A versão anterior deste documento trazia valores da comparação estrita (teste: 74,3%, 76,1%, 77,7% e 76,3% em W1 a W4; desenvolvimento: 44% a 51% no semanal e 0% a 15% no mensal) e atribuía a cobertura baixa no desenvolvimento a um efeito da mudança de nível de preço, sem teste: a atribuição foi retirada. Decomposição medida (mesma execução, só o B0, células com quantis; script de conferência que refaz a cobertura pelas duas regras):

| Período e horizonte | Células com quantis | Comparação estrita | Regra corrigida | Diferença (p.p.) | Células que mudam (realizado no piso que limitou o P10) |
| --- | --- | --- | --- | --- | --- |
| Desenvolvimento W1 | 3.636 | 50,6% | 66,7% | 16,1 | 584 |
| Desenvolvimento W2 | 3.580 | 48,7% | 64,2% | 15,5 | 556 |
| Desenvolvimento W3 | 3.524 | 47,4% | 62,4% | 15,0 | 528 |
| Desenvolvimento W4 | 3.468 | 43,7% | 58,9% | 15,2 | 528 |
| Desenvolvimento M1 | 1.212 | 10,3% | 39,7% | 29,4 | 356 |
| Desenvolvimento M2 | 976 | 15,3% | 27,6% | 12,3 | 120 |
| Desenvolvimento M3 | 728 | 0% | 0% | 0 | 0 |
| Teste W1 | 2.520 | 74,3% | 78,2% | 3,9 | 98 |
| Teste W2 | 2.520 | 76,1% | 80,0% | 3,9 | 98 |
| Teste W3 | 2.520 | 77,7% | 80,9% | 3,3 | 82 |
| Teste W4 | 2.520 | 76,3% | 78,5% | 2,1 | 54 |
| Teste M1 a M3 | 2.556, 2.552, 2.552 | 70,0%, 59,5%, 48,9% | iguais | 0 | 0 |

Toda a diferença entre as duas regras vem de células com o realizado no piso e o P10 limitado ao piso, separados só por ruído de ponto flutuante (ex.: 58,59999999997672 contra 58,60000000000001). O que resta abaixo de 80% depois da correção (desenvolvimento semanal e mensal) não tem causa testada aqui; nenhuma explicação é afirmada.

### 4.3 Achados históricos

* **A08 (rodada de 27/09 com 28 células sem número e fora do horário).** Reproduzido: `como_estava_em(2026-09-27T10:00:00Z)` não devolve nenhuma hora do PLD, porque a primeira captura do sistema é das 15h44 UTC daquele dia; a rodada foi emitida às 19h10 UTC. Corrigido no código (verificação e retentativa antes do corte, espera até o corte, emissão com o dado do corte, registro de atraso e falha, workflow agendado; teste `test_a08_sem_captura_ate_o_corte_nao_ha_numero`). A rodada de 30/09 teve dado elegível capturado antes do corte e 28 números, mas foi emitida manualmente às 23h31 UTC (atraso de 751 minutos, registrado). **Não fechado**: falta uma rodada agendada real no prazo.
* **A09 (publicação histórica do PLD).** Distinção mantida: `publicado_pela_fonte_em` continua nulo; a primeira captura não é publicação. O teste retrospectivo é reconstrução sob LAT1D, separado do prospectivo, com sensibilidade LAT2D e LAT3D publicada. Nas capturas diretas observadas o PLD de cada dia chegou antes de o dia começar (detalhe em `pld_detalhe.json`), compatível com LAT1D conservadora para o PLD; para EAR e ENA, LAT1D coincide com a disponibilidade observada (às 19h o ONS publica até o dia anterior).

### 4.4 Pendências da governança

* **G4**: não concluível no repositório (código e arquivos da pesquisa fora dele). A validação reproduzível do observatório está publicada; cabe ao responsável decidir se ela substitui a G4.
* **G23-R1**: documentado com evidência na reimplementação. O coeficiente da variável `d7 − b0` passou de 1 em 1.357 de 9.424 ajustes (14,4%; coeficientes por origem publicados em `previsoes_ajustes_c2.csv`, configuração dos modelos). As contagens de previsões brutas fora da faixa são resultados retidos: estão em `data/energia/previsoes/validacao_interna/previsoes_desempenho_interno.json`, campo `g23_r1.fora_da_faixa_antes_da_restricao` (execução de 01/10/2026 com o PLD até 30/09/2026). Antes da restrição de preço, previsões brutas abaixo do piso: C2-P 1.761 de 21.624 no semanal (nenhuma acima do teto, nenhuma negativa) e 847 de 11.276 no mensal (100 acima do teto, 489 negativas); C2-H 3.331 de 21.624 no semanal (2 acima do teto, nenhuma negativa) e 1.417 de 11.276 no mensal (74 acima do teto, 362 negativas). A versão anterior deste documento trazia 1.796, 931, 3.380 e 1.834, que não correspondem ao código atual (conferido também por reimplementação independente na verificação: C2-P mensal 847, 100 e 489 de 11.276). Na origem 30/11/2024, M1 a M3 dos quatro submercados saíram negativas antes da restrição (de −164 a −1.013 R$/MWh; B0 de 450 a 483, realizado de 59 a 94; campo `g23_r1.origem_2024_11_30_mensal`), o mesmo padrão relatado pela pesquisa. A restrição impede número publicado negativo, mas não corrige a amplificação. Decisão revisável: aceitar a restrição como tratamento ou limitar o coeficiente a [0, 1].
* **Decisão revisável** (bloco `governanca.decisao_revisavel`): B0 como referência experimental (atendido); faixas publicáveis (não atendido); Gate V dos candidatos (falta revisão independente); liberação de número em rodada interna dos C2 para iniciar o prospectivo (responsável); publicação dos números de desempenho do teste retrospectivo do observatório (decisão pendente do responsável); G4; G23-R1; Gate P (não aplicável ainda); rotina comprovada (não).

### 4.5 Verificação adversarial de 01/10/2026: defeitos e correções

Todos os defeitos foram reproduzidos antes da correção; nenhum foi refutado. Cada um tem teste em `pipeline/tests/test_energia_previsoes.py` (ou em `src/tests/energia-previsoes.test.ts`) que falhava antes e passa depois.

| Defeito | Reprodução | Correção | Teste que o pega |
| --- | --- | --- | --- |
| Coberturas retidas publicadas na partição (28 registros, 16 com a regra estrita) | `public/energia/series/previsoes_emissoes_2026-09.json` com `calibracao.cobertura_p10_p90` em 28 registros (W1 NE 0,6889; refeita 0,7444) | Rodada retida grava só o estado (`emissao.calibracao_para_registro`); publicação projeta a partição sem o campo (`emissao.projecao_publica`, `gold/modelos.py`), sem reescrever o registro; `modelos.json` regenerado (ainda trazia `publicar = true`) | `Retencao`, `GoldRetida.test_particoes_publicadas_sem_numero_de_desempenho`, `energia-previsoes.test.ts` |
| Suíte com 2 erros, gold diária travada | `Ran 39 tests ... FAILED (errors=2)`: CSV retirado do portal e `_rotina` com `date` | Teste do CSV lê os resultados internos quando retido; `_rotina` com instante com fuso, mais um teste do dia ainda no prazo; asserções do estado retido (nenhum número em gold, partições, `previsoes.json` e `modelos.json`; CSV fora do portal) | `Gold.test_csv_de_desempenho_confere_com_a_gold`, `Rotina`, `GoldRetida` |
| P016 declarado concluído e publicado | Documento e governança diziam "Concluído" e "publicado"; gold RETIDA | P016 reclassificado como bloqueado; seção 4.2 como resultados retidos; governança, texto de bandas, proveniência de topo e métricas retidas corrigidos (`publicacao.estado = RETIDA`, `gold = previsoes_desempenho_interno.json`) | `Documento.test_estado_de_p016_segue_a_publicacao`, `GoldRetida.test_retida_sem_numero_de_desempenho_na_gold`, `Governanca.test_metrica_retida_nao_aponta_para_a_gold_publicada` |
| Coberturas do B0 da regra estrita e explicação causal sem teste | Tabela com 74,3% a 76,3%; código dá 78,2% a 80,9% | Números da regra corrigida, decomposição medida (seção 4.2), explicação causal retirada | `Documento.test_cobertura_do_b0_no_documento_e_a_da_regra_corrigida` |
| Contagens do G23-R1 desatualizadas | 1.796, 931, 3.380, 1.834 no documento; código 1.761, 847, 3.331, 1.417 | Números regenerados, com arquivo e campo de origem | `Documento.test_contagens_do_g23_no_documento_sao_as_do_codigo` |
| Validação da regra inclusiva no piso sem teste | Nenhum teste de `avaliacao.dentro` | Teste com a semana real de 04/01/2025 (168 h a 58,60 nos quatro submercados; recorte do seed); a métrica cita o teste | `CoberturaNoPiso` |
| CCEE dada como bloqueada ao ambiente | `curl` 403 e `http_get` 200 em 01/10/2026 06h59 UTC | Linha de fontes corrigida (seção 2) | sem teste automático (depende de rede); evidência acima |
| P013 sem evidência e com proveniência de indicadores retidos | `evidencias = {}`; proveniência de topo com fórmula do MAE | Evidência por número (grade B0 e PLD no corte), proveniências PREVISTO e OBSERVADO, proveniência de topo do que a gold publica | `EvidenciaP013`, `GoldRetida.test_numeros_de_p013_com_evidencia_e_proveniencia` |
| Tipos TS sem campos da gold | `publicacao_desempenho`, `desempenho.calculado`, `calibracao_recalculada`, `calibracao_regra_antiga`, `ultimo_dia_ear/ena` ausentes | Tipos atualizados (também `atraso_origem`, `evidencia`, `proveniencia`, `projecao`) | `energia-previsoes.test.ts` (mapa de chaves conferido pelo compilador e pela gold) |
| CSV de emissões diverge da gold na rodada de 27/09 | `atraso_min` vazio e modo "manual" no CSV; 490,2 e "manual (registro transcrito...)" na gold | CSV usa atraso e modo de `_rodadas`, com a coluna `atraso_origem` | `EmissoesCsv`, `GoldRetida.test_csv_de_emissoes_confere_com_as_rodadas_da_gold` |
| Primeira entrega a maturar | Documento dizia M2026-10 | W2026-10-03 (10/10/2026) | `Documento.test_primeira_entrega_a_terminar` |
| Período de EAR e ENA | Documento dizia até 29/09 | Fonte até 29/09; integrado até 28/09 (captura de 30/09 02h19 UTC) | `Documento.test_periodo_integrado_de_ear_e_ena` |

Os testes da classe `Documento` comparam o texto com a execução descrita (PLD até 30/09/2026 e rodada `prosp_2026-09-30_20260930T233117Z`); com dado mais novo, saem como pulados com o motivo, para não travar a publicação diária da gold por um texto datado.

## 5. Limitações materiais e o que não se pode concluir

* O teste retrospectivo é reconstrução sob hipótese: não houve captura nas origens antigas e a CCEE não informa quando publicou cada hora. Não é desempenho em operação.
* Prospectivo sem entrega apurada: nada se conclui sobre a operação real. A primeira entrega a terminar é W2026-10-03 (W1 da rodada de 30/09, de 03/10 a 10/10/2026); a primeira mensal, M2026-10, termina em 01/11/2026.
* Origens diárias vizinhas preveem a mesma entrega: o tamanho efetivo é de 90 semanas e 21 meses no teste. O mensal não sustenta conclusão sobre vencedor.
* O ganho semanal do C2-P no teste (2 R$/MWh) é pequeno e não passou na regra de seleção do desenvolvimento; não autoriza aprovação.
* EAR e ENA revisadas pelo ONS entram com o valor revisado no teste do C2-H (maior revisão observada de ENA: 3,06 p.p.).
* Faixas não calibradas não são publicadas na previsão atual; a cobertura do teste retrospectivo varia entre períodos (seção 4.2) e está retida fora do portal.
* Os números de desempenho do teste retrospectivo (P016) não estão no portal até a decisão do responsável; a gold não permite, hoje, comparar modelos.
* A restrição de preço usa atos publicados até a véspera da origem; para entregas do ano seguinte antes do ato anual, a faixa é provisória (vigente na origem).
* Rotina agendada não comprovada; o agendador do GitHub pode atrasar execuções, e a rodada fica registrada como atrasada quando isso acontecer.
* Corrida de estado entre workflows: se a rodada coletar dado antes do corte e o workflow noturno salvar o cache depois a partir de um estado anterior, as vintages coletadas de manhã podem não seguir no cache (o valor usado e o `capturado_em` continuam no registro arquivado).

## 6. Pedidos ao integrador

1. `src/lib/energia/gold.ts`: acrescentar `previsoesDesempenho: () => ler<PrevisoesDesempenhoGold>("previsoes_desempenho.json")` (tipo em `src/lib/energia/tipos-previsoes.ts`).
2. `pipeline/energia/catalogo.py` (`INTEGRADOS`): em CCEE `pld_horario` e ONS `ear-diario-por-subsistema` e `ena-diario-por-subsistema`, acrescentar `previsoes_desempenho.json` às golds e `S0` aos modelos de `pld_horario`.
3. `src/tests/energia-governanca.test.ts`: estender a conferência Python para os registros particionados (`pipeline.energia.previsoes.arquivo.le_tudo()`, `valida_particoes()`), aceitar o tipo `REFERENCIA_EXPERIMENTAL` fora do bloco principal e incluir a lista fixa `pipeline/tests/dados/energia_previsoes/emissoes_publicadas.json`. A versão atual continua passando (lê só o arquivo legado).
4. `src/app/sitemap.ts`: a rota `/setor-eletrico/pld/modelos/s0` passa a existir (S0 entrou no registro de modelos).
5. Arquivo de emissões: `pipeline/energia/previsoes/emissoes/2026-09.jsonl` (rodada de 30/09/2026) já entrou no ponto de controle `3e7ff0a36`; ele é o registro original e nunca deve ser regravado, reordenado nem apagado (correção só por registro novo com `substitui`). O workflow `previsao-pld.yml` precisa de permissão de escrita em `main` para commitar as rodadas seguintes.
6. Execução: em 30/09/2026 uma execução de `executar_modulo.py` falhou por um instante porque o módulo `carga_detalhe` (outro agente) estava sem `construir` durante a edição; a execução seguinte, `python3 pipeline/energia/executar_modulo.py previsoes` com coleta, gerou a gold íntegra. Na execução de 01/10/2026 06h58 UTC (`--sem-coleta`), com os números de desempenho retidos e as evidências de P013: gold de 179.948 bytes, 60 s, pico de 244 MB de memória. A descoberta automática derruba todos os módulos quando um deles está incompleto; vale considerar isolar a falha por módulo em `modulos.descobrir()`.
7. Workflows: considerar um mesmo grupo de concorrência ou fusão de cache entre `atualizar-energia.yml` e `previsao-pld.yml` para eliminar a corrida de estado descrita na seção 5.
