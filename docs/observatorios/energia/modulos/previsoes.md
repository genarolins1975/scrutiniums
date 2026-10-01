# Módulo Previsões (P013 a P016): previsão do PLD, modelos, arquivo de emissões e desempenho

Gold: `public/energia/gold/previsoes_desempenho.json` (este módulo, `pipeline/energia/modulos/previsoes.py`, família de silver `previsoes`, ordem 90), com `previsoes.json` e `modelos.json` montadas por `pipeline/energia/gold/modelos.py`. Código de previsão: `pipeline/energia/previsoes/` (calendário, variáveis, modelos, avaliação, arquivo, emissão). Rotina: `.github/workflows/previsao-pld.yml`. Governança: `docs/observatorios/PLD_GOVERNANCA_PREVISAO.md`. Situação descrita em 30/09/2026, fase de dados (páginas ainda não reescritas).

## 1. Painéis e estado honesto

| Painel | Pergunta | Estado nos dados | O que falta |
| --- | --- | --- | --- |
| P013 Previsão atual | Quais os preços possíveis nos próximos períodos? | **Parcial.** Grade 4 × 7 com números reais da referência experimental B0 (rodada de 30/09/2026), identificada como tal, sem faixa (nenhum segmento calibrado). PLD já publicado para as horas depois do corte mostrado à parte, como dado. Previsão principal sem número: nenhum modelo em PRODUÇÃO. | Modelo aprovado (revisão independente e promoção pelo responsável); faixa calibrada; página. |
| P014 Registro de modelos | Como cada previsão foi calculada? | **Concluído com limitação declarada.** Fichas de B0, S0, C2-P e C2-H com entradas, transformações, configuração (sha256), coeficientes do último ajuste por segmento, corte, versão, hipóteses, aprovação e limitações; reexecução do arquivo confere (28 de 28, tolerância R$ 0,005/MWh). C1: pesos não publicáveis (configuração fora do repositório). | Página; configuração do C1, se a pesquisa a publicar. |
| P015 Arquivo de emissões | O que foi previsto antes do resultado? | **Concluído nos dados, com prospectivo ainda curto.** Arquivo particionado por mês, encadeado por hash, com emissão, entrega, versão, atraso, falha e motivo; revisão entre rodadas para a mesma entrega; apuração automática quando a entrega termina. Duas rodadas registradas (27/09 transcrita da pesquisa, sem número; 30/09 do observatório, 28 números, manual e atrasada). | Rodadas agendadas reais; entregas maturadas (a primeira, M2026-10, termina em 01/11/2026); página. |
| P016 Desempenho e calibração | O modelo supera referências simples? | **Concluído com limitação declarada.** Teste retrospectivo fora da amostra (1.734 origens diárias, 48.552 células por modelo), MAE, viés, RMSE, perda quantílica, cobertura e largura por horizonte e submercado, ganho pareado sobre o B0 com IC por bootstrap de blocos, regimes, extremos, sensibilidade LAT1D/LAT2D/LAT3D, separação desenvolvimento e teste. Prospectivo sem entrega apurada. | Amostra prospectiva; calibração com n ≥ 100 entregas; página. |

Nenhum dos quatro painéis está declarado concluído integralmente: P013 depende de aprovação que a governança reserva a revisor e responsável externos, e a rotina diária só será comprovada por execuções agendadas reais.

## 2. Fontes verificadas (30/09/2026)

| Órgão e conjunto | Recurso | Acesso e licença | Período e grão | Situação |
| --- | --- | --- | --- | --- |
| CCEE, PLD_HORARIO | `pld_horario_2021` a `pld_horario_2026` (CSV anual; `MES_REFERENCIA;SUBMERCADO;PERIODO_COMERCIALIZACAO;DIA;HORA;PLD_HORA`, hora local 0 a 23) | CC-BY-4.0 (manifesto do seed). Em 30/09/2026 às 23h05 UTC, `dadosabertos.ccee.org.br/api/3/action/package_show?id=pld_horario` e `pda-download.ccee.org.br` responderam HTTP 403 a este ambiente; não houve tentativa de contorno. | 01/01/2021 00h a 30/09/2026 23h, horário, 4 submercados, 50.376 horas cada, sem hora faltante. | Lido do silver principal (só leitura): seed versionado capturado em 27/09/2026 15h44 UTC e duas capturas diretas do workflow noturno (29/09 02h43 UTC e 30/09 02h20 UTC). Nenhuma revisão entre as 8 vintages. `last_modified` do recurso não acompanha o conteúdo (achado A09): a data de publicação de cada hora é desconhecida. |
| ONS, EAR diário por subsistema | `EAR_DIARIO_SUBSISTEMA_AAAA.csv`, campos `ear_data`, `ear_verif_subsistema_percentual` | `package_show` em 30/09/2026: licença "Creative Commons Atribuição", `metadata_modified` 2026-09-30T22:01:37Z. Dicionário PDF (versão 1.1, 13/09/2022), sha256 `60f945f9…`, guardado no bronze pela coleta do módulo. | 2000 a 29/09/2026 (arquivo de 30/09 22h UTC), diário, 4 subsistemas. Às 19h de Brasília o arquivo chega até o dia anterior. | Silver principal (só leitura). 22 observações de EAR (%) revisadas entre capturas, maior revisão 0,14 p.p. |
| ONS, ENA diário por subsistema | `ENA_DIARIO_SUBSISTEMA_AAAA.csv`, campos `ena_data`, `ena_bruta_regiao_percentualmlt` | Mesma licença; dicionário PDF sha256 `8ac66872…` (o campo em % da MLT admite valor negativo). | Idem. | Silver principal. 90 observações de ENA bruta (% da MLT) revisadas, maior revisão 3,06 p.p.: risco de olhar o futuro no teste do C2-H, declarado. |
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
| B0 mensal SE na origem 30/11/2024 (extremo, formato com aspas) | outubro/2024 | 480,78 (G23-R1) | 480,784503 | < 0,005 |
| Sazonal W1 SE (semana de 04/10/2025) | 04 a 10/10/2025 | teste | 258,330179 | < 0,00001 |
| Média móvel 4 semanas SE | 29/08 a 25/09/2026 | teste | 134,455833 | < 0,00001 |
| ENA bruta 7 dias SE (% MLT) | 19 a 25/09/2026 | teste | 183,289529 | < 0,00001 |

Controles da gold (bloco `validacoes`, todos aprovados em 30/09/2026): 28 células por origem nas 1.734 origens; 9.424 ajustes do C2 com treino só em entregas encerradas até o domingo menos 1 dia (0 violações); nenhuma previsão fora da faixa de preço, não finita ou com quantil cruzado; realizado de 1.208 entregas × submercado dentro de [piso, teto estrutural] vigentes; 13.872 valores de B0 refeitos hora a hora por outro caminho (maior diferença 3,7e-10 R$/MWh); 28 previsões arquivadas refeitas com o dado como estava no corte (0 divergências).

### 4.2 Resultados publicados (teste final: entregas de 01/01/2025 a 30/09/2026)

| Horizonte | B0 MAE | C2-P MAE | Ganho do C2-P sobre B0 (IC 90%) | C2-H MAE | S0 MAE | Cobertura P10 a P90 do B0 |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | 47,79 | 45,47 | 2,32 (0,74 a 4,26) | 45,83 | 125,47 | 74,3% |
| W2 | 56,38 | 53,38 | 3,00 (1,06 a 5,29) | 53,79 | 125,47 | 76,1% |
| W3 | 61,96 | 60,79 | 1,17 (−0,55 a 3,01) | 61,60 | 125,47 | 77,7% |
| W4 | 67,13 | 65,55 | 1,57 (−0,68 a 3,88) | 66,64 | 125,47 | 76,3% |
| M1 | 65,84 | 67,78 | −1,94 (−14,32 a 8,48) | 70,39 | 121,11 | 70,0% |
| M2 | 89,46 | 72,12 | 17,34 (−7,06 a 50,67) | 72,59 | 121,74 | 59,5% |
| M3 | 114,76 | 103,48 | 11,28 (−8,39 a 36,46) | 105,82 | 121,68 | 48,9% |

R$/MWh; 90 entregas semanais e 21 mensais distintas; os quatro submercados juntos. Leitura: no semanal o C2-P erra um pouco menos que a persistência em W1 e W2 (cerca de 5%), sem diferença clara em W3 e W4; no mensal a amostra (21 meses) não permite conclusão. A sazonal S0 é muito pior em todos os horizontes. Pela regra fixada antes do teste, **nenhum candidato foi selecionado** no desenvolvimento (C2-P semanal: ganho −0,31, IC −2,75 a 1,32; mensal com apenas 10 entregas e sem IC), então o ganho no teste é relatado, não usado para escolher vencedor. Calibração: nenhum segmento CALIBRADO (90 entregas semanais e 21 mensais ficam abaixo de n = 100; no desenvolvimento a faixa do B0 cobriu só 44% a 51% no semanal e de 0% a 15% no mensal, efeito da mudança de nível de preço). Sensibilidade: com o dado 2 ou 3 dias mais tarde (LAT2D, LAT3D), o MAE do B0 em W1 sobe de 47,79 para 49,09 e 50,39.

### 4.3 Achados históricos

* **A08 (rodada de 27/09 com 28 células sem número e fora do horário).** Reproduzido: `como_estava_em(2026-09-27T10:00:00Z)` não devolve nenhuma hora do PLD, porque a primeira captura do sistema é das 15h44 UTC daquele dia; a rodada foi emitida às 19h10 UTC. Corrigido no código (verificação e retentativa antes do corte, espera até o corte, emissão com o dado do corte, registro de atraso e falha, workflow agendado; teste `test_a08_sem_captura_ate_o_corte_nao_ha_numero`). A rodada de 30/09 teve dado elegível capturado antes do corte e 28 números, mas foi emitida manualmente às 23h31 UTC (atraso de 751 minutos, registrado). **Não fechado**: falta uma rodada agendada real no prazo.
* **A09 (publicação histórica do PLD).** Distinção mantida: `publicado_pela_fonte_em` continua nulo; a primeira captura não é publicação. O teste retrospectivo é reconstrução sob LAT1D, separado do prospectivo, com sensibilidade LAT2D e LAT3D publicada. Nas capturas diretas observadas o PLD de cada dia chegou antes de o dia começar (detalhe em `pld_detalhe.json`), compatível com LAT1D conservadora para o PLD; para EAR e ENA, LAT1D coincide com a disponibilidade observada (às 19h o ONS publica até o dia anterior).

### 4.4 Pendências da governança

* **G4**: não concluível no repositório (código e arquivos da pesquisa fora dele). A validação reproduzível do observatório está publicada; cabe ao responsável decidir se ela substitui a G4.
* **G23-R1**: documentado com evidência na reimplementação. O coeficiente da variável `d7 − b0` passou de 1 em 1.357 de 9.424 ajustes (14,4%). Antes da restrição de preço, previsões brutas abaixo do piso: C2-P 1.796 de 21.624 no semanal e 931 de 11.276 no mensal (489 negativas); C2-H 3.380 e 1.834 (362 negativas). Na origem 30/11/2024, M1 a M3 dos quatro submercados saíram negativas antes da restrição (de −164 a −1.013 R$/MWh; B0 de 450 a 483, realizado de 59 a 94), o mesmo padrão relatado pela pesquisa. A restrição impede número publicado negativo, mas não corrige a amplificação. Decisão revisável: aceitar a restrição como tratamento ou limitar o coeficiente a [0, 1].
* **Decisão revisável** (bloco `governanca.decisao_revisavel`): B0 como referência experimental (atendido); faixas publicáveis (não atendido); Gate V dos candidatos (falta revisão independente); liberação de número em rodada interna dos C2 para iniciar o prospectivo (responsável); G4; G23-R1; Gate P (não aplicável ainda); rotina comprovada (não).

## 5. Limitações materiais e o que não se pode concluir

* O teste retrospectivo é reconstrução sob hipótese: não houve captura nas origens antigas e a CCEE não informa quando publicou cada hora. Não é desempenho em operação.
* Prospectivo sem entrega apurada: nada se conclui sobre a operação real. A primeira entrega prevista pelo observatório termina em 01/11/2026 (M2026-10); a W1 de 30/09 termina em 10/10/2026.
* Origens diárias vizinhas preveem a mesma entrega: o tamanho efetivo é de 90 semanas e 21 meses no teste. O mensal não sustenta conclusão sobre vencedor.
* O ganho semanal do C2-P no teste (2 R$/MWh) é pequeno e não passou na regra de seleção do desenvolvimento; não autoriza aprovação.
* EAR e ENA revisadas pelo ONS entram com o valor revisado no teste do C2-H (maior revisão observada de ENA: 3,06 p.p.).
* Faixas não calibradas não são publicadas na previsão atual; a cobertura no teste depende do nível de preço e é instável entre períodos.
* A restrição de preço usa atos publicados até a véspera da origem; para entregas do ano seguinte antes do ato anual, a faixa é provisória (vigente na origem).
* Rotina agendada não comprovada; o agendador do GitHub pode atrasar execuções, e a rodada fica registrada como atrasada quando isso acontecer.
* Corrida de estado entre workflows: se a rodada coletar dado antes do corte e o workflow noturno salvar o cache depois a partir de um estado anterior, as vintages coletadas de manhã podem não seguir no cache (o valor usado e o `capturado_em` continuam no registro arquivado).

## 6. Pedidos ao integrador

1. `src/lib/energia/gold.ts`: acrescentar `previsoesDesempenho: () => ler<PrevisoesDesempenhoGold>("previsoes_desempenho.json")` (tipo em `src/lib/energia/tipos-previsoes.ts`).
2. `pipeline/energia/catalogo.py` (`INTEGRADOS`): em CCEE `pld_horario` e ONS `ear-diario-por-subsistema` e `ena-diario-por-subsistema`, acrescentar `previsoes_desempenho.json` às golds e `S0` aos modelos de `pld_horario`.
3. `src/tests/energia-governanca.test.ts`: estender a conferência Python para os registros particionados (`pipeline.energia.previsoes.arquivo.le_tudo()`, `valida_particoes()`), aceitar o tipo `REFERENCIA_EXPERIMENTAL` fora do bloco principal e incluir a lista fixa `pipeline/tests/dados/energia_previsoes/emissoes_publicadas.json`. A versão atual continua passando (lê só o arquivo legado).
4. `src/app/sitemap.ts`: a rota `/setor-eletrico/pld/modelos/s0` passa a existir (S0 entrou no registro de modelos).
5. Arquivo de emissões: `pipeline/energia/previsoes/emissoes/2026-09.jsonl` (rodada de 30/09/2026) já entrou no ponto de controle `3e7ff0a36`; ele é o registro original e nunca deve ser regravado, reordenado nem apagado (correção só por registro novo com `substitui`). O workflow `previsao-pld.yml` precisa de permissão de escrita em `main` para commitar as rodadas seguintes.
6. Execução: em 30/09/2026 uma execução de `executar_modulo.py` falhou por um instante porque o módulo `carga_detalhe` (outro agente) estava sem `construir` durante a edição; a execução seguinte, `python3 pipeline/energia/executar_modulo.py previsoes` com coleta, gerou a gold íntegra (283 KB, 46 s, pico de cerca de 220 MB de memória). A descoberta automática derruba todos os módulos quando um deles está incompleto; vale considerar isolar a falha por módulo em `modulos.descobrir()`.
7. Workflows: considerar um mesmo grupo de concorrência ou fusão de cache entre `atualizar-energia.yml` e `previsao-pld.yml` para eliminar a corrida de estado descrita na seção 5.
