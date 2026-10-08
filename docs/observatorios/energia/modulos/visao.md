# Módulo Visão geral (P004 a P007)

Documento de método do módulo `visao` (rota `/setor-eletrico/visao-geral`, família de silver `sintese`, ordem 98, gold `sintese.json`). Estado em 01/10/2026 (Brasília), fim da fase de dados com as correções da verificação adversarial de 01/10/2026 (seção 4.5): módulo, gold, métricas, tipos TypeScript e testes prontos. Interface publicada em 06/10/2026: `src/app/setor-eletrico/visao-geral/page.tsx` lê os blocos novos da gold (fichas de prova, detalhes das regras e tabelas de auditoria lidos da gold sob demanda no navegador); estado em `CONTINUIDADE.md`.

A Visão geral não coleta fonte própria. Ela lê as golds que os outros módulos acabaram de construir (`ctx["golds"]`), a série de origem no silver principal (`data/energia/silver/energia.db`, só leitura) e três CSV publicados por outros módulos (`pld_limites_diario.csv`, do PLD; `geracao_restricao_diaria.csv`, da Geração; `carga_diaria.csv`, do builder de `carga.json`). Por isso virou módulo de ordem 98: precisa das golds dos módulos temáticos, que só existem depois do laço de módulos. A construção antiga de `sintese.json` saiu do `run.py` (trecho autorizado; ver seção 6).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Motor de frases e regras (funções puras) | `pipeline/energia/gold/sintese.py` |
| Módulo (REGISTRO, leitura das golds e do silver, P005, P006, avaliação de P007, evidências, registro das publicações, CSV, validação) | `pipeline/energia/modulos/visao.py` |
| Métricas (19 medidas) | `pipeline/energia/metricas/visao.py` |
| Testes Python (67, sem rede) | `pipeline/tests/test_energia_visao.py`, amostras reais em `pipeline/tests/dados/energia_visao/` (cerca de 360 KB; o maior é a série diária do SIN de 2000 a 2026, 140 KB comprimidos, que reproduz 25 anos de distribuição) |
| Gold | `public/energia/gold/sintese.json` (cerca de 330 KB) |
| Downloads | `public/energia/series/sintese_regras_diario.csv` (1,2 MB), `sintese_episodios.csv`, `sintese_multiplos.csv`, `sintese_revisoes.csv` (450 KB) |
| Tipos | `src/lib/energia/tipos-visao.ts` (`SinteseVisaoGold`, compatível com `SinteseGold` de `tipos.ts`) |
| Silver | `data/energia/silver/sintese.db`, conjunto interno `_visao_alertas` (estado de cada regra em cada publicação aceita) |

Execução: `python3 pipeline/energia/executar_modulo.py visao` (não há coleta; `--sem-coleta` dá o mesmo resultado). Cerca de 15 s e 155 MB de memória residente: o tempo vai na reavaliação diária das regras desde 2021 (com as variantes rejeitadas) e nas séries de EAR e ENA desde 2000 lidas do silver principal.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P004 O sistema em 60 segundos | Seis frases (reservatórios, afluências, carga, térmicas, PLD, rede), cada uma saída de um modelo fixo (`MODELOS[id]`) aplicado a valores lidos da gold de origem, com o caminho de cada valor, a regra publicada na gold de origem, as versões (gold, `gerado_em`, `versao_codigo`, dataset, snapshot e sha256), a evidência "Comprove este número" com o valor antes do arredondamento, numerador e denominador refeitos do silver principal, e a qualidade do dado por frase: natureza e componentes que não são medição (PREVISTO e ESTIMADO, lidos da proveniência de origem), defasagem até a data de processamento em Brasília, situação de atualidade pela frequência declarada (publicacao.json) e revisões entre capturas restritas às séries que a frase usa. Caixa de destaques: regras de sistema em alerta confirmadas há menos de 14 dias, da mais rara para a mais frequente no histórico, no máximo três, cada uma com a evidência do número avaliado, o histórico avaliável próprio da regra, condição de retorno e hipóteses fixas rotuladas como hipótese; a frequência conjunta da caixa é publicada e cumpre o critério de materialidade (seção 3.5) | Dados concluídos; página publicada em 06/10/2026 |
| P005 Preço, água, geração, carga e rede | Cinco painéis alinhados pelo calendário dos últimos 90 dias (tabela `dados` no formato do componente `PequenosMultiplos`, chave `d`), com os valores copiados das golds de origem sem recálculo (990 células conferidas uma a uma a cada publicação), a data de referência própria de cada painel, a defasagem, a referência de comparação (faixa histórica, quartis, mesmo dia da semana do ano anterior no mesmo regime, zero), a métrica do catálogo, a proveniência de origem e um aviso pronto sobre as datas diferentes. A rede mostra fluxo verificado e diz que fluxo alto não indica congestionamento | Dados concluídos; página publicada em 06/10/2026 |
| P006 Energia e sociedade | Tarifa B1 residencial mediana vigente (conta.json), DEC e FEC do Brasil no último ano completo (qualidade.json), perdas totais na distribuição no último ano completo (perdas.json) e unidades consumidoras com Tarifa Social no mês de referência do SCS (inclusao.json), cada um com período próprio (vigência, ano, mês), defasagem, cobertura e universo, atualidade do conjunto, aviso de que não é situação do dia, evidência do módulo de origem e link para o módulo | Dados concluídos com limitação declarada: a Tarifa Social tem referência mai/2025 e o conjunto SCS está ATRASADO (367 dias além do prazo mensal) no painel de saúde dos dados; a defasagem aparece no item. Página publicada em 06/10/2026 |
| P007 O que observar | Doze regras e um evento: EAR e ENA do SIN em nível extremo para a data, participação térmica extrema, carga entre as mais altas do ano, preços separados entre submercados, PLD no piso o dia inteiro, PLD no teto horário ou estrutural, restrição eólica e fotovoltaica entre as maiores do último ano, revisão material de dado já publicado, PLD sem atualização e fonte atrasada, mais a publicação semanal do CMO. Cada regra tem condição, limiar, duração mínima, regra de retorno, materialidade, o que não permite concluir, hipóteses fixas, estado do dia, valor avaliado com limiares, evidência do número, episódio em curso, linha de estado dos últimos 365 dias, o histórico desde 2021 com o primeiro dia avaliável (frequência de disparo, acionamentos curtos descartados, episódios, duração, sensibilidade a durações de 1, 3, 7 e 14 dias) e as variantes rejeitadas com a frequência delas. O registro das publicações aceitas no silver mede alertas que deixam de se confirmar quando a fonte revisa | Dados concluídos com limitação declarada: o registro das publicações começou em 01/10/2026 (quatro publicações aceitas registradas, três delas com as regras recalibradas), e a regra de revisões tem 4 dias avaliáveis (capturas versionadas desde 27/09/2026). Página publicada em 06/10/2026 |

Interface publicada em 06/10/2026 com os quatro painéis; revisão adversarial da interface pendente (ver `FASE_1.md`).

## 2. Fontes verificadas (consulta em 01/10/2026)

A Visão geral reutiliza conjuntos já integrados pelos módulos de origem; os recursos exatos, licenças e dicionários estão nos documentos desses módulos. O que este módulo lê diretamente:

| Fonte | O que é lido | Onde | Período e grão |
| --- | --- | --- | --- |
| Golds de operação | `pld.json` (diário, cartões, amplitude, coleta direta), `hidrologia.json` (subsistemas, série e faixas da EAR), `carga.json` (série, regimes, comparação de 7 dias, natureza por regime), `geracao.json` (série diária do SIN, participação térmica), `rede.json` (fronteiras e fluxos), `cmo.json` (última semana) | `public/energia/gold/` (no `run.py`, as golds desta execução) | PLD até 30/09/2026; ONS até 28/09/2026; CMO semana de 02/10/2026 |
| Golds de módulos | `conta.json`, `qualidade.json`, `perdas.json`, `inclusao.json`, `regulacao.json` (limites vigentes do PLD), `pld_detalhe.json` (bloqueios registrados da CCEE), `publicacao.json` (atualidade e revisões por conjunto) | idem | vigência 30/09/2026; anos 2025; mai/2025 |
| Silver principal (só leitura) | EAR em %, verificada e máxima em MWmês por subsistema (`ear_subsistema_di`), ENA bruta em MWmed e % da MLT (`ena_subsistema_di`), carga diária por subsistema, balanço horário do SIN, intercâmbio horário e PLD horário (para refazer o número de cada frase), e as vintages e observações dos 7 conjuntos de operação para as revisões | `data/energia/silver/energia.db` | EAR e ENA desde 01/01/2000; capturas versionadas de 27/09 a 30/09/2026 |
| CSV do módulo PLD | `pld_limites_diario.csv` (horas no piso, no teto horário e média no teto estrutural por dia e submercado, com os limites e atos) | `public/energia/series/` | 01/01/2021 a 30/09/2026, diário |
| CSV do módulo Geração | `geracao_restricao_diaria.csv`, linhas `TOTAL` por fonte e região (energia não gerada e geração verificada) | `public/energia/series/` | eólica desde 01/10/2021, fotovoltaica desde 01/04/2024, até 29/09/2026 |
| CSV da Carga | `carga_diaria.csv`, coluna `SIN_calculado` (mesmo builder de `carga.json`, dias em quarentena vazios, sem arredondar), base da regra de carga extrema | `public/energia/series/` | 01/01/2000 a 28/09/2026, diário |
| ONS, restrições (S4) | conferido em 01/10/2026 pelo `package_show`: `restricao_coff_eolica_usi` (182 recursos, último 2026-09, modificado em 30/09/2026 22:09) e `restricao_coff_fotovoltaica` (92 recursos), licença Creative Commons Atribuição, atualização declarada "Diariamente, às 12h e 19h" | https://dados.ons.org.br/dataset/restricao_coff_eolica_usi | universo de usinas da fonte, meia hora |
| CCEE, InfoPLD de 09/04/2026 (S20) | não usado: o endereço do Anexo B respondeu HTTP 403 (text/html) em 01/10/2026; não houve tentativa de contornar. Os limites do PLD vêm dos atos da ANEEL (módulo Regulação), conferidos com o CSV do módulo PLD | https://www.ccee.org.br/documents/80415/31116705/InfoPLD_Diario09042026.pdf/... | |

## 3. Método

### 3.1 Frases (P004)

`valores_frase(id, golds)` lê os números da gold de origem e devolve `None` quando falta dado (a frase não é emitida e o id vai para `frases_ausentes`). `MODELOS[id](valores)` monta os trechos; o par (modelo, valores) é publicado, e a frase é refeita a cada publicação para conferência (falha vira stub). A frase térmica fala em "geração do balanço do ONS" e diz que a solar desse total inclui a MMGD estimada; ela não chama o total de geração verificada. Qualidade por frase:

* natureza da série e `componentes_natureza`: os componentes que não são medição, como a gold de origem os declara (Carga: `natureza_por_regime`, com previsão de usinas não despachadas desde 01/03/2021, PREVISTO, e MMGD estimada desde 29/04/2023, ESTIMADO; Geração: MMGD estimada na solar do balanço, ESTIMADO, lida das limitações da proveniência). Sem declaração na origem, a lista fica vazia;
* defasagem = data de processamento (civil de Brasília) − data de referência; negativa quando a CCEE publica o PLD do dia seguinte na véspera ("1 dia depois da data de processamento"), nunca "0 dias antes";
* atualidade: situação, cadência, tolerância e atraso do conjunto em `publicacao.json` (o esquema do módulo Dados traz o conjunto em `dataset_silver` ou no `id` "família/dataset"; os dois são lidos);
* revisões: só as séries que a frase usa (`SERIES_FRASE`: EAR verificada e máxima dos quatro subsistemas; ENA bruta em MWmed e em % da MLT; carga diária dos subsistemas; hidráulica, térmica, eólica e solar da linha SIN do balanço; PLD dos quatro submercados; fluxo das quatro fronteiras) e só as referências dentro da janela da frase. Publica-se o número de referências distintas (dias ou horas), o número de pares (série, referência) e a maior variação relativa com a série e a referência que a produziram; a carga usa duas janelas (7 dias e os mesmos dias do ano anterior).

Evidência de cada frase ("Comprove este número"): `calculo_frase` refaz o número no silver principal, por um caminho que não passa pela gold de origem (somas explícitas das observações vigentes), e publica o valor antes do arredondamento, o numerador e o denominador (Σ MWmês verificada e máxima; Σ ENA bruta e Σ MLT implícita em 30 dias; médias de 7 dias da carga deste ano e do ano anterior; Σ térmica e Σ das quatro fontes do balanço) e a reconciliação com o valor exibido, com tolerância de meia unidade da casa exibida. A fonte lista os arquivos usados (na frase de reservatórios, os 26 arquivos anuais de 2001 a 2026, porque o desvio usa a mediana da data). Testes da evidência, todos derivados de uma comparação: a frase refeita do modelo, e cada valor relido na gold de origem pelo caminho publicado com um leitor escrito à parte de `valores_frase` (os caminhos anotados têm conferência própria: valor absoluto, sentido pelo sinal da média, início da janela pela data de referência). Sem o arquivo no silver a evidência não é emitida e a falta vira ressalva na validação.

### 3.2 Determinantes (P005)

Janela comum = 90 dias terminados na maior data de referência entre os cinco painéis. Cada coluna é copiada da gold de origem pela data (`pld.json#diario`, `hidrologia.json#serie_ear` e `#bandas_ear`, `geracao.json#serie_termica_7d`, `carga.json#serie`, `rede.json#serie_fluxos`); data sem valor na origem fica vazia (nunca zero nem repetida). A referência da carga é o mesmo dia da semana do ano anterior (364 dias antes), só quando os dois dias estão no mesmo regime metodológico do ONS: a mesma data do calendário cairia em outro dia da semana (28/09/2025 foi domingo, 65.828 MWmed, contra a segunda 28/09/2026, 88.896 MWmed; a referência certa é a segunda 29/09/2025, 77.549 MWmed). `confere_multiplos` compara cada célula com a origem; divergência vira stub.

### 3.3 Energia e sociedade (P006)

Cada item copia valor, valor exibido e evidência do módulo de origem (sem recálculo) e acrescenta período tipado (`vigencia`, `anual`, `mensal`), defasagem (dias ou meses até o processamento), cobertura (universo e cobertura da evidência de origem) e atualidade do conjunto. O DEC ganha o equivalente em horas e minutos (9,334 h = 9 h 20 min; centésimos de hora não são minutos). Indicador sem gold ou sem valor fica em `ausentes` com o motivo.

### 3.4 Regras (P007)

Condição diária (True, False ou sem dado) avaliada por funções puras em `gold/sintese.py`; a mesma função roda no dia e em todos os dias desde 01/01/2021. As regras de distribuição usam o extremo, do 5º ao 95º percentil (`Q_EXTREMO`); a faixa usual das páginas de origem, do 10º ao 90º (`Q_USUAL`), fica como contexto no texto e como variante rejeitada (seção 3.5):

| Regra | Condição | Duração mínima / retorno | Dados |
| --- | --- | --- | --- |
| `ear_faixa` | EAR do SIN < P5 ou > P95 do mesmo dia nos anos 2001 ao anterior | 7 / 7 dias | silver principal (EAR do SIN = Σ MWmês ÷ Σ máxima) |
| `ena_faixa` | ENA do SIN em 30 dias (% da MLT) < P5 ou > P95 da mesma janela nos anos 2001 ao anterior | 7 / 7 | silver principal (Σ ENA ÷ Σ MLT implícita, só janelas com os 30 dias) |
| `termica` | participação térmica de 7 dias < P5 ou > P95 das 365 janelas terminadas 7 a 371 dias antes, no regime de 29/04/2023 | 7 / 7 | `geracao.json#serie_sin` |
| `carga_extrema` | carga do SIN > quantil 0,95 dos 364 dias anteriores no mesmo regime, com ≥ 330 dias | 2 / 3 | `carga_diaria.csv` (na falta dele, `carga.json#serie`) |
| `descolamento` | max − min dos PLD médios diários ≥ max(R$ 5; 10% da média dos quatro) | 3 / 3 | `pld.json#diario` |
| `pld_piso` | algum submercado com as horas do dia (24) no piso | 3 / 3 | `pld_limites_diario.csv` |
| `pld_teto` | alguma hora no teto horário ou média no teto estrutural | 1 / 7 | `pld_limites_diario.csv` |
| `restricao_eolica`, `restricao_solar` | taxa de 7 dias (Σ não gerada ÷ Σ verificada + não gerada) > P95 das 365 janelas anteriores (só o lado de cima) | 7 / 7 | `geracao_restricao_diaria.csv` |
| `revisao_material` | captura nos últimos 7 dias com revisão de série usada pela página (`series_da_pagina`) de \|Δ\| ≥ 1% do anterior e ≥ piso (0,1 p.p.; 10 MWmed ou MWmês; R$ 0,01/MWh) | 1 / 1 (a janela de 7 dias está na condição) | silver principal |
| `pld_defasagem` | último dia de PLD > 2 dias antes do processamento (Brasília) | não se aplica | `pld.json`, com a data da última tentativa de coleta direta e os bloqueios registrados em `pld_detalhe.json` |
| `atualidade_fontes` | algum conjunto usado com situação ATRASADO | não se aplica | `publicacao.json`; conjuntos derivados das frases, dos painéis, de energia e sociedade e das regras publicadas (inclui `ons_coff_eolica`, `ons_coff_fotovoltaica` e `cmo_se`) |

Contagens vazias no CSV do PLD são ausência: o dia fica sem avaliação, nunca "fora do piso" por um zero inventado.

Máquina de estados (`episodios`): o episódio começa no primeiro dia de uma sequência de `duração mínima` dias com a condição e termina no último dia com a condição antes de `retorno` dias seguidos sem ela; dia sem dado interrompe a contagem de entrada e não conta para o retorno. Estados: `ativo`, `em_retorno`, `em_observacao` (condição sem a duração mínima), `normal`, `sem_dado`. `ativo = true` (campo que a página já lê) vale para `ativo` e `em_retorno`.

Valor avaliado: cada regra publica `valor` (número do dia sem arredondar e limiares na unidade da regra) e a mesma tripla vai, dia a dia, no CSV `sintese_regras_diario.csv`: EAR e ENA do SIN com P5 e P95 da data, horas no piso (maior entre os submercados, limiar 24) e no teto horário (limiar 0), revisões materiais da janela; o detalhe traz as horas por submercado.

Frequência de disparo (`resumo_historico`): primeiro e último dia avaliado (cada regra tem o seu: a série começa no início comum, mas a regra só é avaliada quando a base existe), dias avaliados, dias com a condição, acionamentos brutos, acionamentos curtos descartados (sequências mais curtas que a duração mínima fora de qualquer episódio), episódios, episódios por ano (só com ao menos 365 dias avaliados), duração mediana e máxima, dias com alerta exibido (da confirmação até a véspera do retorno) e a sensibilidade a durações de 1, 3, 7 e 14 dias. Não há verdade de referência para chamar um alerta de falso; o que se mede como falso alarme é (a) o ruído filtrado pela duração, (b) a frequência conjunta da caixa de destaques (seção 3.5) e (c), com o registro das publicações, o alerta publicado que a reavaliação com os dados revisados já não confirma (comparação só entre publicações da mesma `versao_regra`).

Evidência de cada regra (`evidencia_numero`): valor antes do arredondamento, unidade, período, numerador e denominador quando a regra é razão (EAR: Σ MWmês verificada e máxima; ENA: Σ ENA bruta e Σ MLT implícita de 30 dias; térmica: Σ térmica e Σ das quatro fontes; restrição: Σ não gerada e Σ verificada mais não gerada), limiares e base em `filtros`, arquivos da fonte (para EAR e ENA, os 26 arquivos anuais da distribuição), reconciliação com a gold de origem quando ela publica o mesmo número (EAR e ENA contra `hidrologia.json`; limites do PLD contra `regulacao.json`) e dois testes derivados do arquivo publicado: a linha do dia relida de `sintese_regras_diario.csv` (condição e valor iguais aos da gold) e o estado refeito a partir da coluna `condicao` do arquivo. Na revisão material há um terceiro teste, a contagem refeita do `sintese_revisoes.csv` publicado. Os CSV são escritos antes das evidências e depois de todas as validações que podem virar stub.

Registro das publicações (`_visao_alertas`): no início de cada execução, a gold que está publicada em `public/energia/gold/sintese.json` (a que a sentinela aceitou) tem o estado de cada regra gravado no silver da família, uma vez por publicação (chave: o `processado_em` dela). Uma gold que vira stub ou que a sentinela rejeita nunca é lida dali e não conta como alerta emitido. A publicação desta execução entra no registro na execução seguinte.

Origens: para cada gold lida, `origens[]` publica de onde veio (contexto da execução igual ao arquivo publicado, contexto diferente do arquivo publicado, ou arquivo publicado lido pela Visão geral), o `gerado_em` do arquivo publicado lido do cabeçalho, a hora da leitura e a idade da gold em horas.

### 3.5 Caixa de destaques e materialidade

Critério de materialidade (seção 9.1, "não alarme o usuário por ruído"): no período em que todas as regras de sistema são avaliáveis, a caixa de destaques fica ocupada em no máximo um terço dos dias; o normal é a caixa vazia. A meta é escolha documentada, não padrão externo; a tabela de sensibilidade publicada mostra o efeito de outros limites.

Na versão anterior, com a faixa usual (10º a 90º percentil) nas regras de distribuição, o 90º percentil nas restrições e nenhum limite de novidade, a caixa ficava ocupada em 396 dos 534 dias de 13/04/2025 a 28/09/2026 (74,2%): 223 dias com uma regra, 135 com duas, 37 com três e 1 com quatro. É o mesmo nível que a própria síntese chamou de ruído ao rejeitar a regra "algum subsistema" (71,8%). Duas mudanças, aplicadas nesta ordem:

1. Limiares extremos: 5º e 95º percentis nas regras de EAR, ENA e térmica, 95º percentil nas restrições. Com a faixa usual, uma regra bilateral marca por construção cerca de um dia em cada cinco. Sozinha, a mudança leva a caixa a 47,2% no período comum.
2. Novidade: a caixa responde "o que mudou", então uma regra entra nela nos primeiros 14 dias depois da confirmação do alerta. Depois disso continua no "o que observar" com a duração do episódio e aparece em `outras_regras_em_alerta` com o motivo.

Resultado publicado em `destaques.frequencia_conjunta`: 145 de 534 dias com destaque no período comum (27,2%; 389 dias sem nenhuma regra, 116 com uma, 17 com duas, 12 com três) e 644 de 2.097 dias desde 01/01/2021 (30,7%). Sensibilidade ao limite de novidade (período comum / desde 2021): 7 dias 18,9% / 19,6%; 14 dias 27,2% / 30,7%; 21 dias 34,3% / 38,1%; 30 dias 37,1% / 43,8%; sem limite 47,2% / 77,1%. O limite de 21 dias já passa da meta no período comum, por isso 14. Contribuição por regra no período comum: descolamento 11,2% dos dias, restrição fotovoltaica 6,7%, eólica 5,4%, piso 3,2%, teto 2,8%, ENA 2,6%, térmica 1,5%, carga 1,3%, EAR 0%. O descolamento entre submercados continua a regra mais frequente: em 34% dos dias desde 13/04/2025 a diferença passou de 10% da média, e em 21% passou de 20%; o limiar não foi mudado porque a novidade já tira da caixa as separações longas, e a regra está documentada com a sensibilidade.

### 3.6 Escolha das regras de água pelo monitoramento

A regra original ("algum dos quatro subsistemas fora da faixa usual") ficaria em alerta em 71,8% dos dias desde 2021 para a EAR e 66,3% para a ENA; a do SIN na faixa usual, em 23,6% (5 episódios) e 26,8% (15 episódios); a adotada, do SIN no extremo, em 15,7% (4 episódios) e 17,3% (7 episódios). As duas variantes rejeitadas são publicadas em `alternativas_avaliadas` com a frequência, os episódios e o primeiro dia avaliado. As restrições têm a variante do 90º percentil (eólica 26,0% e 14 episódios; fotovoltaica 23,4% e 6) e a térmica a da faixa usual (25,5% e 6).

## 4. Evidências de aceite

### 4.1 Reconciliação com a fonte (por outro caminho)

| Número | Gold | Fonte releida | Diferença e tolerância |
| --- | --- | --- | --- |
| EAR do SIN, 28/09/2026 | 61,6% (frase), 61,65 (P005), `valor_calculo` 61,6473 | captura de 30/09/2026 02:19 UTC no silver: 180.052,264 ÷ 292.068,192 MWmês = 61,6473% (teste com o recorte); arquivo EAR_DIARIO_SUBSISTEMA_2026 do ONS republicado em 30/09/2026 22:01 UTC (cópia do módulo Água, sha256 a73378b0...): 180.071,504 ÷ 292.068,192 = 61,6539% | 0 contra a captura usada. O ONS revisou a EAR do Sudeste/Centro-Oeste de 28/09 depois da captura (+19,24 MWmês no SIN): com o arquivo novo a frase passaria de "61,6%" para "61,7%" (seção 5) |
| Faixa da EAR do SIN, 28/09 | P10 25,5, mediana 49,3, P90 67,5 (hidrologia.json); P5 23,78 e P95 70,65 (regra) | 25 anos (2001 a 2025) do recorte: P10 25,53, mediana 49,26, P90 67,51, P5 23,78, P95 70,65 (o verificador releu os 26 arquivos anuais do ONS com código próprio: 25,53, 49,26, 67,51) | igual a duas casas |
| Nordeste fora da faixa usual, 28/09/2026 | 68,9%, acima do P90 de 68,0% | recorte: 68,92% e P90 67,95%; arquivo do ONS: 68,97% | igual a uma casa; é o subsistema que faz a variante "algum subsistema" disparar |
| ENA do SIN em 30 dias até 28/09/2026 | 168,6% (frase), `valor_calculo` 168,6214 | captura de 30/09 02:19 UTC: 1.849.715,012 ÷ 1.096.963,204 MWmed = 168,6214% (teste); arquivo do ONS de 30/09 22:01 UTC: 168,673% (revisão posterior) | 0 contra a captura usada; P10 56,37 e P90 128,54 (hidrologia.json: 56,4 e 128,5), P5 51,24 e P95 143,95 |
| Carga média 22 a 28/09/2025 | 75.784 MWmed | arquivo Carga_Energia 2025 do ONS (sha256 18d5f6ad...): 75.783,77 | 0,23 MWmed (arredondamento ao MWmed) |
| Carga média 22 a 28/09/2026 | 83.771 MWmed (captura de 30/09), variação 10,5397% | arquivo Carga_Energia 2026 capturado em 01/10 00:38 UTC (sha256 45c8cd14...): 83.790,45 | 19,4 MWmed (0,023%), tolerância 0,05%: revisão do ONS nos dias recentes. Com a captura de 01/10 a variação passa de 10,54% para 10,57% e o texto passaria de "10,5%" para "10,6%" (seção 5) |
| P95 da carga do SIN, 28/09/2026 | 89.142,93 MWmed (`carga_diaria.csv`) | ONS Carga_Energia, 364 dias anteriores: 89.142,9 (verificador) | 0,03 MWmed; com `carga.json#serie` (arredondada ao inteiro) daria 89.143,15 |
| Participação térmica de 7 dias, 28/09/2026 | 10,6% (frase), `valor_calculo` 10,6322 do balanço horário no silver | `geracao.json#serie_sin` (MWmed diários arredondados): 10,6321%, P10 9,1657, P90 17,4012, mediana 12,36; arquivos do balanço do ONS (verificador): 10,631%, 9,17, 17,40, 12,359 | 0,001 p.p., tolerância 0,05 p.p. |
| PLD médio do Sudeste/Centro-Oeste, 30/09/2026 | R$ 135,25/MWh, `valor_calculo` 135,2458 | média das 24 horas integradas (arquivo pld_horario_2026 da CCEE, captura de 30/09 02:20 UTC, sha256 b8fc7539...): 135,2458 | arredondamento ao centavo |
| Diferença entre submercados, 30/09/2026 | R$ 10,32/MWh | das 96 horas: 135,2467 (Norte) − 124,9296 (Nordeste) = 10,3171 | arredondamento ao centavo |
| Horas no piso de R$ 57,31, 30/09/2026 | SE 10, S 14, NE 10, N 10 (`valor` 14, limiar 24) | contagem nas horas com \|PLD − 57,31\| ≤ R$ 0,005 | igual |
| Maior fluxo de 30 dias, NE→SE, até 28/09/2026 | 4.842 MWmed, `valor_calculo` 4.841,899 | 720 horas de `fluxo.NE_SE` no silver (verificador, arquivo INTERCAMBIO_NACIONAL_2026: 4.841,90) | 0,1 MWmed, tolerância 0,5 MWmed |
| Restrição eólica, ago/2026 e 7 dias até 29/09 | 26,72% (`geracao_detalhe.json`); 21,3908% (regra) | soma das 124 linhas TOTAL diárias de agosto: 4.022.144,98 ÷ 15.051.420,17 = 26,7227%; parquet do ONS (verificador): 26,7227% e 21,3908% | 0,003 p.p. (arredondamento) |
| Limites vigentes do PLD | 57,31; 1.611,04; 785,27 R$/MWh (CSV do PLD) | `regulacao.json#limites_pld.vigente_hoje` (Despacho ANEEL nº 3.850/2025) | 0, tolerância R$ 0,005/MWh |
| Revisões materiais da captura de 29/09 (Brasília) | 58 em séries usadas pela página | recontagem no CSV publicado: 301 revisões materiais no total, 243 em séries que a página não usa (carga do balanço, 99; linhas de subsistema da eólica, da solar e da térmica no balanço, 138; ENA armazenável, 6) | igual (teste de recontagem na evidência) |

### 4.2 Testes que detectam erro real (`python3 -m unittest pipeline.tests.test_energia_visao`, 67 testes, OK)

Números escritos à mão nos testes, com recortes reais:

* EAR do SIN de 28/09/2026 = 180.052,264 ÷ 292.068,192 = 61,6473% (a média simples dos percentuais daria 70,37%), com P10 25,53, mediana 49,26 e P90 67,51 em 25 anos e P5 23,78 e P95 70,65; a variante "algum subsistema" dispara no dia só pelo Nordeste (68,92% contra P90 de 67,95%);
* ENA do SIN em 30 dias até 28/09/2026 = 168,6214% (a média das razões daria 130,11%), P10 56,37, P90 128,54, P5 51,24, P95 143,95; sem um dia num subsistema não há janela de 30 dias;
* frequência de disparo desde 2021 reavaliada do recorte diário do SIN: EAR 23,6% e 5 episódios na faixa usual, 15,7% e 4 no extremo; ENA 26,8% e 15, 17,3% e 7; ENA em observação desde 23/09/2026 (6 dias);
* térmica: valor 10,6321%, 365 janelas, P10 9,1657, P90 17,4012, P5 8,7882, P95 18,0023, primeiro dia avaliado 10/05/2024, 18,9% e 4 episódios (25,5% e 6 na faixa usual);
* carga extrema: P95 de 89.142,93 com a série longa (89.143,15 com a da gold), condição falsa para 88.896; com o recorte desde o regime de MMGD, primeiro dia avaliado 27/04/2024, 885 dias, 4,5% dos dias com a condição, 5,5% em alerta, 7 episódios; conferência da série longa contra `carga.json`;
* restrições pela chamada do módulo: eólica 21,3908% e P95 31,6025 em 29/09/2026, dias abaixo do 5º percentil nunca disparam, primeiro dia 13/10/2022 com 12,2% e 11 episódios (26,0% e 14 no P90); fotovoltaica desde 13/04/2025 com 10,5% e 3 (23,4% e 6);
* destaques: ordem pela raridade, limite de três, novidade de 14 dias (13 dias entra, 14 não), texto com o histórico avaliável da regra ("desde 13/04/2025 (535 dias)", nunca o início comum), caminho e objeto da evidência; frequência conjunta calculada à mão;
* revisão material vale por 7 dias depois da captura (dia 6 sim, dia 7 não);
* revisões por série: na frase térmica, a revisão de `carga.NE` (20.656,59%) não conta e o máximo é `eolica.SIN` (3.297,18%), uma hora com duas séries conta uma referência e dois pares; na frase de afluências, a ENA armazenável (6,25%) não conta e o máximo é a bruta (6,24%); a regra só conta revisão de série usada; unidades reais (MWmês, MWmed, %, % da MLT, R$/MWh);
* nulo no CSV do PLD fica ausente e o dia não é avaliado; valor e limiares do piso (24 de 24) e do teto (1 hora, limiar 0) com as horas por submercado;
* âncoras: todo link com âncora das frases e das regras aponta para um `id` que existe na página de destino;
* natureza: componentes PREVISTO e ESTIMADO na frase da carga, ESTIMADO na térmica; restrição com natureza ESTIMADO no catálogo;
* defasagem do PLD com a data da tentativa de coleta (30/09/2026 às 02:20 UTC) e o bloqueio registrado;
* construção com silver em memória montado com os recortes e com os pares reais de revisão do Norte em 27/09/2026: evidências de EAR, ENA, piso, teto e revisão (valores, numerador, denominador, testes aprovados e linha do CSV), contagem de revisões (2 usadas, 2 não usadas), evidência das frases com valor antes do arredondamento, evidência ausente (e ressalva) quando o arquivo falta no silver;
* conferências da evidência reprovam quando o valor relido ou o CSV publicado diverge;
* registro só da publicação aceita: nada sem publicação, nada com stub publicado, uma vez por publicação; origens das golds (igual ao arquivo publicado, diferente, só no disco);
* os testes anteriores (máquina de estados com sequências à mão, piso e teto no recorte do CSV do PLD, carga sem comparação através da quebra de 29/04/2023, P005 com 990 células iguais às golds, P006 com período próprio, data de Brasília).

Teste de mutação (cópia em diretório temporário, 23 mutações, cada uma rodando os 67 testes): todas detectadas, inclusive as 12 do verificador (EAR como média simples, ENA como média das razões, janela de 29 dias, quantis trocados nos dois sentidos, janelas de 1 a 365, carga com P95 − 500, destaques em ordem inversa, revisão de 10 dias, restrição nos dois lados, alternativa com 2 subsistemas, defasagem do PLD com 3 dias, dia de Brasília em UTC) e as das correções (revisão sem filtro de série, regra contando série não usada, novidade de 30 dias, ano anterior de 365 dias, contagem vazia virando zero, conferência constante, histórico desde o início comum, registro desligado, unidade trocada, natureza da restrição, nulo do teto virando condição).

### 4.3 Controles de execução (validação da gold)

Publicados em `sintese.json#validacao` a cada execução, todos aprovados em 01/10/2026: P005 com 990 células iguais às golds; medidas citadas no catálogo; frases refeitas; caixa de destaques dentro da meta (27,2%); faixa usual da EAR e da ENA do dia iguais às de `hidrologia.json` para o SIN e os quatro subsistemas (e ENA de 30 dias igual a uma casa); participação térmica e faixa usual reavaliadas de `geracao.json#serie_sin` (tolerância 0,05 p.p.); `carga_diaria.csv` igual a `carga.json#serie` nos 1.096 dias comuns (maior diferença 0,4999 MWmed, arredondamento da gold); amplitude do PLD igual a `pld.json#amplitude_dia`; limites do CSV do PLD iguais aos da Regulação; nenhum alerta publicado e não confirmado após revisão. São controles de execução, não testes: os testes estão na seção 4.2.

### 4.4 Frequência de disparo no histórico (publicação de 01/10/2026)

| Regra | Duração / retorno | Primeiro dia avaliado | Dias avaliados | % dias com a condição | Acionamentos brutos | Curtos descartados | Episódios | Por ano | Duração mediana (máx.) | % dias em alerta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ear_faixa | 7/7 | 01/01/2021 | 2.097 | 15,7 | 4 | 0 | 4 | 0,7 | 62 (191) | 15,7 | normal |
| ena_faixa | 7/7 | 01/01/2021 | 2.097 | 17,6 | 9 | 2 | 7 | 1,2 | 41 (156) | 17,3 | em observação |
| termica | 7/7 | 10/05/2024 | 872 | 19,8 | 10 | 4 | 4 | 1,7 | 22,5 (112) | 18,9 | normal |
| carga_extrema | 2/3 | 01/01/2021 | 1.369 | 6,6 | 31 | 8 | 16 | 4,3 | 3,5 (25) | 8,2 | normal |
| descolamento | 3/3 | 01/01/2021 | 2.099 | 18,7 | 73 | 40 | 13 | 2,3 | 9 (110) | 17,5 | normal |
| pld_piso | 3/3 | 01/01/2021 | 2.099 | 47,6 | 46 | 7 | 14 | 2,4 | 23,5 (388) | 48,6 | normal |
| pld_teto | 1/7 | 01/01/2021 | 2.099 | 4,6 | 5 | 0 | 5 | 0,9 | 2 (91) | 6,1 | normal |
| restricao_eolica | 7/7 | 13/10/2022 | 1.448 | 13,7 | 27 | 11 | 11 | 2,8 | 13 (41) | 12,2 | normal |
| restricao_solar | 7/7 | 13/04/2025 | 535 | 17,9 | 15 | 11 | 3 | 2,0 | 23 (25) | 10,5 | normal |
| revisao_material | 1/1 | 28/09/2026 | 4 | 75,0 | 1 | 0 | 1 | não estimável | 3 (3) | 75,0 | ativo |

Leitura: a duração mínima é o que separa ruído de condição persistente. No descolamento, 40 de 73 acionamentos duravam menos de 3 dias; com duração de 1 dia a regra ficaria em alerta em 24,7% dos dias. O piso passa metade do histórico em alerta porque 2022 e 2023 tiveram o PLD no piso quase o ano inteiro (episódio de 388 dias); é condição real, não ruído, e a novidade tira esse episódio da caixa depois de 14 dias. A carga extrema é avaliada em três trechos (de 01/01 a 28/02/2021, de 28/02/2022 a 28/04/2023 e desde 27/04/2024), os dias com os 364 anteriores no mesmo regime do ONS; só no regime atual são 885 dias, 4,5% com a condição e 7 episódios.

### 4.5 Correções da verificação adversarial de 01/10/2026

| Defeito | Gravidade | O que foi feito |
| --- | --- | --- |
| Testes não detectavam erro nas regras do P007 nem na agregação da EAR e da ENA; a seção 4.2 chamava controles de testes | alto | Corrigido. Recortes reais novos (EAR de 28/09 de 2001 a 2026, ENA das janelas de 30 dias até 28/09, série diária do SIN desde 2000, restrições do SIN, séries das golds de geração e carga, série longa da carga) e 35 testes novos com os números escritos à mão (seção 4.2); seção 4.2 reescrita, e os controles foram separados em 4.3. Teste de mutação com as 12 mutações do verificador e 11 novas: todas detectadas |
| Revisões agregadas por conjunto, misturando séries que a frase não usa | médio | Corrigido. `SERIES_FRASE` lista as séries de cada frase e `SERIES_PAGINA` as da página; a qualidade publica referências, pares, o máximo com série e referência e as séries consideradas; a regra conta só série usada (58 em 29/09, contra 301). O CSV de revisões ganhou `usada_na_pagina` |
| Destaques e regras de EAR, ENA, piso, teto e revisão sem "Comprove este número" | médio | Corrigido. Evidência para as cinco regras (seção 3.4), e cada destaque traz `evidencia` e `evidencia_caminho` |
| Texto do destaque com "No histórico desde 01/01/2021" para regras avaliáveis muito depois; carga e eólica omitidas no documento | médio | Corrigido. `primeiro_dia_avaliado` e `ultimo_dia_avaliado` no histórico, e o texto usa "histórico avaliável desde ... (N dias)". A carga extrema passou a usar a série longa publicada pela Carga (`carga_diaria.csv`), avaliável em três trechos desde 2021 (seção 4.4); eólica desde 13/10/2022 e fotovoltaica desde 13/04/2025 declaradas |
| Frequência conjunta dos destaques não monitorada (74% dos dias) | médio | Corrigido. Critério de materialidade documentado (um terço dos dias), limiares extremos e novidade de 14 dias; frequência conjunta, sensibilidade e calibração anterior publicadas (seção 3.5); validação na gold |
| Testes da evidência marcados "aprovado" sem comparação | médio | Corrigido. Os resultados vêm de comparações: valores relidos na gold de origem por leitor próprio, número refeito do silver, linha do CSV publicado relida, estado refeito do CSV e contagem refeita das revisões; divergência reprova, falta de conferência vira ressalva |
| Registro das emissões gravado antes das validações | médio | Corrigido. O registro é feito a partir da gold publicada (aceita pela sentinela), na execução seguinte, uma vez por publicação; o texto passou a citar o silver sintese, conjunto `_visao_alertas`. O registro existente (06:40:11 UTC) é o da publicação vigente naquele momento e foi mantido |
| Natureza da fonte da restrição | baixo | Corrigido. `_regra` aceita `natureza_fonte`; restrição com ESTIMADO; carga e térmica com `componentes_natureza` e limitação |
| Frases de carga e térmica sem os componentes estimados | baixo | Corrigido. `componentes_natureza` na qualidade; texto térmico fala em "geração do balanço do ONS" com a MMGD estimada |
| Fórmula de `visao_revisoes_janela_frase` diferente do código | baixo | Corrigido. Definição alinhada (referências distintas, mais pares e máximo) |
| Valor de cálculo arredondado, sem numerador e denominador | baixo | Corrigido. `calculo_frase` refaz do silver o valor sem arredondar, com numerador e denominador, e a fonte da frase de reservatórios lista os 26 arquivos da mediana |
| "Última coleta direta na CCEE foi bem-sucedida" sem data | baixo | Corrigido. Data e hora da tentativa e o bloqueio registrado em `pld_detalhe.json`, sem afirmar o estado atual da CCEE |
| Unidade "MW" no CSV de revisões | baixo | Corrigido. Unidade real da série |
| CSV das regras sem valor e limiares de EAR, ENA, piso e teto | baixo | Corrigido (seção 3.4) e descrição do REGISTRO atualizada |
| Contagem vazia do CSV do PLD virava zero | baixo | Corrigido. Vazio é `None` e o dia não é avaliado |
| Âncoras inexistentes | baixo | Corrigido. Links para âncoras que existem hoje (`carga#nivel`, `pld/limites#limites`, `pld/diferencas-regionais`, `pld/historico`, `pld/cmo-e-formacao`, `agua-e-clima/afluencia#ena`), com teste que lê as páginas |
| Mesma data do ano anterior compara dias da semana diferentes | baixo | Corrigido. 364 dias antes, no mesmo regime, com rótulo explícito |
| `origens[].lida_do_disco` falso para tudo | baixo | Corrigido. Origem real, igualdade com o arquivo publicado, hora de leitura e idade |
| Atualidade sem as restrições e o CMO | baixo | Corrigido. Conjuntos derivados do que a página publica (13 conjuntos, inclusive `ons_coff_eolica`, `ons_coff_fotovoltaica` e `cmo_se`) |

Nenhum defeito foi refutado.

## 5. Limitações e o que não se pode concluir

* Alerta descreve condição medida e não implica causa; as hipóteses dos destaques são listas fixas, não testadas nesta página.
* O histórico das regras é a reavaliação com os dados de hoje, já revisados; não reproduz o que o leitor via em cada data. O registro das publicações começou em 01/10/2026 (publicações de 06:40, 07:41, 07:44 e 07:45 UTC; a primeira com as regras anteriores, que não se comparam com as atuais por `versao_regra`); a contagem de alertas não confirmados após revisão só ganha conteúdo com o tempo.
* A regra de revisões depende das capturas versionadas do silver principal, que começam em 27/09/2026: 4 dias avaliáveis, frequência anual não estimável.
* O silver principal estava com as capturas de 30/09 02:19 UTC; o ONS republicou EAR, ENA e carga às 22:01 UTC com revisões dos dias recentes. Com os arquivos novos, a frase de reservatórios passaria de "61,6%" para "61,7%" (61,6539%), a de afluências passaria de "168,6%" para "168,7%" (168,673%) e a da carga passaria de "10,5%" para "10,6%"; as frases usam a captura do silver principal até a próxima execução completa do `run.py`, e a qualidade de cada frase mostra a captura usada.
* O critério de materialidade da caixa (um terço dos dias) e o limite de novidade (14 dias) são escolhas documentadas, não padrão externo; com os limiares extremos, uma condição extrema mas longa sai da caixa depois de 14 dias e continua na lista completa.
* A térmica, a restrição eólica e a fotovoltaica têm histórico avaliável mais curto (desde 10/05/2024, 13/10/2022 e 13/04/2025): exigem 365 janelas anteriores no mesmo regime ou universo. A carga extrema é avaliada em três trechos por causa dos regimes do ONS.
* A frequência conjunta desde 2021 subestima a de hoje nos anos em que algumas regras não eram avaliáveis; a medida de referência é a do período comum.
* Taxa de restrição usa a geração possível estimada pelo ONS e o universo de usinas dos arquivos de restrição (muda com usinas novas); não inclui MMGD.
* Energia e sociedade: períodos diferentes (vigência de 30/09/2026, anos de 2025, mai/2025); a Tarifa Social tem 17 meses de defasagem porque o SCS da ANEEL não publicou competência posterior a jun/2025.
* A tarifa de referência é a mediana simples entre distribuidoras com vigência na data, sem tributos e sem bandeira; não é a conta de luz nem uma média ponderada por consumidores.
* P005 alinha calendários, não publicações: valores da mesma data vêm de fontes publicadas em momentos diferentes.
* As páginas de PLD e Água estão sendo divididas em subpáginas pelos módulos de origem; os links da Visão geral apontam para as âncoras que existem em 01/10/2026 e o teste de âncoras acusa qualquer mudança.

## 6. Pedidos ao integrador

1. `run.py`: retirei a construção de `sintese.json` do bloco das golds de operação (import de `sintese` e as três linhas do `publicar`), como autorizado; a gold agora sai do laço de módulos (ordem 98) e entra em `meta.json#golds` pelo mesmo caminho dos demais módulos.
2. Catálogo (`catalogo.py`, `INTEGRADOS`): `sintese.json` passou a usar também conjuntos de outros módulos por meio das golds deles (`aneel_tarifas_aplicacao`, `aneel_continuidade`, `aneel_samp_balanco`, `aneel_scs`, `ons_coff_eolica`, `ons_coff_fotovoltaica`). O REGISTRO do módulo declara `datasets: []` de propósito (declarar de novo sobrescreveria família e dataset do silver em `datasets_integrados`); pedido: acrescentar `sintese.json` às golds desses conjuntos no catálogo, ou derivar isso dos módulos.
3. Tipos: `gold.sintese()` em `src/lib/energia/gold.ts` devolve `SinteseGold` (campos antigos). Na fase de interface, trocar por `SinteseVisaoGold` de `tipos-visao.ts` ou fazer `SinteseGold` estender esse tipo.
4. Registro das publicações: o módulo registra a gold publicada na execução seguinte porque o `run.py` e o `executar_modulo.py` não avisam o módulo depois da sentinela. Pedido: um gancho `apos_publicar(con, gold)` chamado só quando a sentinela aceita, para registrar no mesmo processamento; e `ctx["golds_construidas"]` com os nomes construídos na execução, para `origens[]` dizer isso sem depender da comparação de `gerado_em`.
5. Âncoras: pedir aos módulos PLD e Água que mantenham `id="limites"`, `id="diferencas-regionais"`, `id="historico"`, `id="cmo-e-formacao"` e `id="ena"` nas subpáginas (o teste de âncoras do módulo visao falha se sumirem).
6. Testes TypeScript fora deste módulo que falham hoje e não dependem de `sintese.json`: `energia-reauditoria` ("mudança identificada pela plataforma não aparece como declarada pela fonte"), `energia-gold-contrato` (proveniência de `empresas.json` sem `snapshot.sha256`; revisões de `publicacao.json` do módulo Dados) e `energia-governanca` (vocabulário de causa em `pld/page.tsx`). `npx tsc --noEmit` acusa só `src/tests/energia-pld.test.ts` (iteração de `entries()`), do módulo PLD.
7. O módulo Dados mudou o esquema de `publicacao.json#conjuntos` (o conjunto agora vem em `id` "família/dataset"); a Visão geral lê os dois formatos, mas convém fixar o contrato no tipo do módulo Dados.

## 8. Revisão adversarial (08/10/2026)

Registro completo em `avaliacao/revisao_mercado_geracao_visao.json`. Corrigido nesta rodada:

* **Bastidor fora de Entender**: a evidência da regra de coleta da CCEE passa pelo separador de bastidor (firewall, HTTP 403 e nome de arquivo vão para Analisar), e coleta direta, bloqueios registrados e conjuntos avaliados do detalhe da regra vão para Auditar. Medido no navegador: firewall e pld_detalhe.json#conceito.bloqueios deixam de ser visíveis em Entender. O leitor também listou silver, sintese.json e a versão do código, que já estavam ocultos em Entender (a extração dele incluía texto oculto).
* **Texto**: "dados vigentes hoje" e "dados de hoje" viraram "dados da data de processamento"; "cMO" voltou a CMO; "MMGD, que não é restringida pelo ONS" virou "fica fora do registro de restrições do ONS".
* Legenda de siglas refeita (ONS, ANEEL e CCEE entram).

Aberto: a síntese é o retrato de 01/10/2026 e o módulo Água foi recapturado depois (EAR 61,6% na frase e 61,7% na tabela de 90 dias da mesma página); o refresh consistente de todos os módulos depende da próxima execução completa do pipeline. Também abertos: o identificador aneel_scs e o termo NumCon no texto de Entender; a abertura descreve a página e o primeiro fato vem após cerca de 300 palavras; carga +10,5% (7 dias) e +14,6% (dia) sem base histórica; 58 revisões materiais sem dizer quais fatos afetam; ordem de títulos (axe heading-order, já presente antes desta rodada).

Interface (lente de interface, 08/10/2026): os cartões de determinantes, de sociedade e os da leitura de alterações subiram de h4 para h3, e a regra `heading-order` do axe deixou de apontar a Visão geral (eram três ocorrências, herdadas de antes da rodada). Os controles que ficam recolhidos na tela abrem na impressão, a barra de profundidade, a busca e os botões de página saem do papel e as tabelas cabem na largura do A4. HTML de 540,4 kB em 08/10/2026, abaixo de 600 kB.
