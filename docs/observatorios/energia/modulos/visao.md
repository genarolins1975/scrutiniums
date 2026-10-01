# Módulo Visão geral (P004 a P007)

Documento de método do módulo `visao` (rota `/setor-eletrico/visao-geral`, família de silver `sintese`, ordem 98, gold `sintese.json`). Estado em 01/10/2026 03h40 (Brasília), fim da fase de dados: módulo, gold, métricas, tipos TypeScript e testes prontos; a página existente continua lendo os campos antigos de `sintese.json` (compatíveis) e ainda não mostra os blocos novos (fase de interface).

A Visão geral não coleta fonte própria. Ela lê as golds que os outros módulos acabaram de construir (`ctx["golds"]`), a série de origem no silver principal (`data/energia/silver/energia.db`, só leitura) e dois CSV publicados por outros módulos (`pld_limites_diario.csv`, do PLD, e `geracao_restricao_diaria.csv`, da Geração). Por isso virou módulo de ordem 98: precisa das golds dos módulos temáticos, que só existem depois do laço de módulos. A construção antiga de `sintese.json` saiu do `run.py` (trecho autorizado; ver seção 6).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Motor de frases e regras (funções puras) | `pipeline/energia/gold/sintese.py` |
| Módulo (REGISTRO, leitura das golds e do silver, P005, P006, avaliação de P007, registro das emissões, CSV, validação) | `pipeline/energia/modulos/visao.py` |
| Métricas (18 medidas) | `pipeline/energia/metricas/visao.py` |
| Testes Python (32, sem rede) | `pipeline/tests/test_energia_visao.py`, amostras reais em `pipeline/tests/dados/energia_visao/` (cerca de 79 KB, uma comprimida) |
| Gold | `public/energia/gold/sintese.json` (cerca de 208 KB) |
| Downloads | `public/energia/series/sintese_regras_diario.csv` (772 KB), `sintese_episodios.csv`, `sintese_multiplos.csv`, `sintese_revisoes.csv` (444 KB) |
| Tipos | `src/lib/energia/tipos-visao.ts` (`SinteseVisaoGold`, compatível com `SinteseGold` de `tipos.ts`) |
| Silver | `data/energia/silver/sintese.db`, conjunto interno `_visao_alertas` (estado de cada regra a cada processamento) |

Execução: `python3 pipeline/energia/executar_modulo.py visao` (não há coleta; `--sem-coleta` dá o mesmo resultado). Cerca de 10 s e 145 MB de memória residente: o tempo vai na reavaliação diária das regras desde 2021 e nas séries de EAR e ENA desde 2000 lidas do silver principal.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P004 O sistema em 60 segundos | Seis frases (reservatórios, afluências, carga, térmicas, PLD, rede), cada uma saída de um modelo fixo (`MODELOS[id]`) aplicado a valores lidos da gold de origem, com o caminho de cada valor, a regra publicada na gold de origem, as versões (gold, `gerado_em`, `versao_codigo`, dataset, snapshot e sha256), a evidência "Comprove este número" e a qualidade do dado por frase: natureza, defasagem até a data de processamento em Brasília, situação de atualidade pela frequência declarada (publicacao.json) e revisões entre capturas na janela da frase. Destaques: até três regras em alerta, só as que tratam do sistema, da mais rara para a mais frequente no histórico, com início, duração, condição de retorno, frequência histórica, hipóteses fixas rotuladas como hipótese e o painel onde verificá-las. O defeito da data foi corrigido: o processamento usa `comum.hoje_brasilia()` (via `ctx["hoje"]`), e a referência posterior ao processamento (PLD publicado na véspera) é escrita como tal | Dados concluídos; página pendente (fase de interface) |
| P005 Preço, água, geração, carga e rede | Cinco painéis alinhados pelo calendário dos últimos 90 dias (tabela `dados` no formato do componente `PequenosMultiplos`, chave `d`), com os valores copiados das golds de origem sem recálculo (990 células conferidas uma a uma a cada publicação), a data de referência própria de cada painel, a defasagem, a referência de comparação (faixa histórica, quartis, mesmo dia do ano anterior no mesmo regime, zero), a métrica do catálogo, a proveniência de origem e um aviso pronto sobre as datas diferentes. A rede mostra fluxo verificado e diz que fluxo alto não indica congestionamento | Dados concluídos; página pendente |
| P006 Energia e sociedade | Tarifa B1 residencial mediana vigente (conta.json), DEC e FEC do Brasil no último ano completo (qualidade.json), perdas totais na distribuição no último ano completo (perdas.json) e unidades consumidoras com Tarifa Social no mês de referência do SCS (inclusao.json), cada um com período próprio (vigência, ano, mês), defasagem, cobertura e universo, atualidade do conjunto, aviso de que não é situação do dia, evidência do módulo de origem e link para o módulo | Dados concluídos com limitação declarada: a Tarifa Social tem referência mai/2025 e o conjunto SCS está ATRASADO (367 dias além do prazo mensal) no painel de saúde dos dados; a defasagem aparece no item. Página pendente |
| P007 O que observar | Doze regras e um evento: EAR e ENA do SIN fora da faixa usual, participação térmica incomum, carga entre as mais altas do ano, preços separados entre submercados, PLD no piso o dia inteiro, PLD no teto horário ou estrutural, restrição eólica e restrição fotovoltaica acima do usual, revisão material de dado já publicado, PLD sem atualização e fonte atrasada, mais a publicação semanal do CMO. Cada regra tem condição, limiar, duração mínima, regra de retorno, materialidade, o que não permite concluir, hipóteses fixas, estado do dia, episódio em curso, linha de estado dos últimos 365 dias e o histórico desde 2021 (frequência de disparo, acionamentos curtos descartados, episódios, duração, sensibilidade a durações de 1, 3, 7 e 14 dias). O registro das emissões no silver mede alertas que deixam de se confirmar quando a fonte revisa | Dados concluídos com limitação declarada: o registro das emissões começa nesta versão (um processamento até agora), e a regra de revisões tem só 4 dias avaliáveis (capturas versionadas desde 27/09/2026). Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não lê os blocos novos.

## 2. Fontes verificadas (consulta em 01/10/2026)

A Visão geral reutiliza conjuntos já integrados pelos módulos de origem; os recursos exatos, licenças e dicionários estão nos documentos desses módulos. O que este módulo lê diretamente:

| Fonte | O que é lido | Onde | Período e grão |
| --- | --- | --- | --- |
| Golds de operação | `pld.json` (diário, cartões, amplitude), `hidrologia.json` (subsistemas, série e faixas da EAR), `carga.json` (série, regimes, comparação de 7 dias), `geracao.json` (série diária do SIN, participação térmica), `rede.json` (fronteiras e fluxos), `cmo.json` (última semana) | `public/energia/gold/` (no `run.py`, as golds desta execução) | PLD até 30/09/2026; ONS até 28/09/2026; CMO semana de 02/10/2026 |
| Golds de módulos | `conta.json`, `qualidade.json`, `perdas.json`, `inclusao.json`, `regulacao.json` (limites vigentes do PLD), `publicacao.json` (atualidade e revisões por conjunto) | idem | vigência 30/09/2026; anos 2025; mai/2025 |
| Silver principal (só leitura) | EAR em % e MWmês por subsistema (`ear_subsistema_di`), ENA bruta em MWmed e % da MLT (`ena_subsistema_di`), e as vintages e observações dos 7 conjuntos de operação para as revisões | `data/energia/silver/energia.db` | EAR e ENA desde 01/01/2000; capturas versionadas de 27/09 a 30/09/2026 |
| CSV do módulo PLD | `pld_limites_diario.csv` (horas no piso, no teto horário e média no teto estrutural por dia e submercado, com os limites e atos) | `public/energia/series/` | 01/01/2021 a 30/09/2026, diário |
| CSV do módulo Geração | `geracao_restricao_diaria.csv`, linhas `TOTAL` por fonte e região (energia não gerada e geração verificada) | `public/energia/series/` | eólica desde 01/10/2021, fotovoltaica desde 01/04/2024, até 29/09/2026 |
| ONS, restrições (S4) | conferido em 01/10/2026 pelo `package_show`: `restricao_coff_eolica_usi` (182 recursos, último 2026-09, modificado em 30/09/2026 22:09) e `restricao_coff_fotovoltaica` (92 recursos), licença Creative Commons Atribuição, atualização declarada "Diariamente, às 12h e 19h" | https://dados.ons.org.br/dataset/restricao_coff_eolica_usi | universo de usinas da fonte, meia hora |
| CCEE, InfoPLD de 09/04/2026 (S20) | não usado: o endereço do Anexo B respondeu HTTP 403 (text/html) em 01/10/2026; não houve tentativa de contornar. Os limites do PLD vêm dos atos da ANEEL (módulo Regulação), conferidos com o CSV do módulo PLD | https://www.ccee.org.br/documents/80415/31116705/InfoPLD_Diario09042026.pdf/... | |

## 3. Método

### 3.1 Frases (P004)

`valores_frase(id, golds)` lê os números da gold de origem e devolve `None` quando falta dado (a frase não é emitida e o id vai para `frases_ausentes`). `MODELOS[id](valores)` monta os trechos; o par (modelo, valores) é publicado, e a frase é refeita a cada publicação para conferência (falha vira stub). Qualidade por frase:

* defasagem = data de processamento (civil de Brasília) − data de referência; negativa quando a CCEE publica o PLD do dia seguinte na véspera ("1 dia depois da data de processamento"), nunca "0 dias antes";
* atualidade: situação, cadência, tolerância e atraso do conjunto em `publicacao.json` (o esquema do módulo Dados traz o conjunto em `dataset_silver` ou no `id` "família/dataset"; os dois são lidos);
* revisões: referências (dias ou horas) dentro da janela da frase cujo valor mudou entre capturas consecutivas no silver principal, com a maior variação relativa; a carga usa duas janelas (7 dias e os mesmos dias do ano anterior).

Destaques: regras com `assunto = sistema` em estado `ativo` ou `em_retorno`, ordenadas pela fração de dias em alerta no histórico (crescente), no máximo três. O texto é montado por regra fixa; as hipóteses são uma lista fixa por regra, marcadas `tipo = hipotese`, com o painel onde a verificação seria feita, sem teste aqui.

### 3.2 Determinantes (P005)

Janela comum = 90 dias terminados na maior data de referência entre os cinco painéis. Cada coluna é copiada da gold de origem pela data (`pld.json#diario`, `hidrologia.json#serie_ear` e `#bandas_ear`, `geracao.json#serie_termica_7d`, `carga.json#serie`, `rede.json#serie_fluxos`); data sem valor na origem fica vazia (nunca zero nem repetida). O ano anterior da carga é a mesma data do calendário, só quando as duas estão no mesmo regime metodológico do ONS (29/02 fica vazio). `confere_multiplos` compara cada célula com a origem; divergência vira stub.

### 3.3 Energia e sociedade (P006)

Cada item copia valor, valor exibido e evidência do módulo de origem (sem recálculo) e acrescenta período tipado (`vigencia`, `anual`, `mensal`), defasagem (dias ou meses até o processamento), cobertura (universo e cobertura da evidência de origem) e atualidade do conjunto. O DEC ganha o equivalente em horas e minutos (9,334 h = 9 h 20 min; centésimos de hora não são minutos). Indicador sem gold ou sem valor fica em `ausentes` com o motivo.

### 3.4 Regras (P007)

Condição diária (True, False ou sem dado) avaliada por funções puras em `gold/sintese.py`; a mesma função roda no dia e em todos os dias desde 01/01/2021:

| Regra | Condição | Duração mínima / retorno | Dados |
| --- | --- | --- | --- |
| `ear_faixa` | EAR do SIN < P10 ou > P90 do mesmo dia nos anos 2001 ao anterior | 7 / 7 dias | silver principal (EAR do SIN = Σ MWmês ÷ Σ máxima) |
| `ena_faixa` | ENA do SIN em 30 dias (% da MLT) < P10 ou > P90 da mesma janela nos anos 2001 ao anterior | 7 / 7 | silver principal (Σ ENA ÷ Σ MLT implícita) |
| `termica` | participação térmica de 7 dias < P10 ou > P90 das 365 janelas terminadas 7 a 371 dias antes, no regime de 29/04/2023 | 7 / 7 | `geracao.json#serie_sin` |
| `carga_extrema` | carga do SIN > quantil 0,95 dos 364 dias anteriores no mesmo regime, com ≥ 330 dias | 2 / 3 | `carga.json#serie` |
| `descolamento` | max − min dos PLD médios diários ≥ max(R$ 5; 10% da média dos quatro) | 3 / 3 | `pld.json#diario` |
| `pld_piso` | algum submercado com as 24 horas no piso | 3 / 3 | `pld_limites_diario.csv` |
| `pld_teto` | alguma hora no teto horário ou média no teto estrutural | 1 / 7 | `pld_limites_diario.csv` |
| `restricao_eolica`, `restricao_solar` | taxa de 7 dias (Σ não gerada ÷ Σ verificada + não gerada) > P90 das 365 janelas anteriores | 7 / 7 | `geracao_restricao_diaria.csv` |
| `revisao_material` | captura nos últimos 7 dias com revisão de série da página de \|Δ\| ≥ 1% do anterior e ≥ piso (0,1 p.p.; 10 MWmed ou MWmês; R$ 0,01/MWh) | 1 / 1 (a janela de 7 dias está na condição) | silver principal |
| `pld_defasagem` | último dia de PLD > 2 dias antes do processamento (Brasília) | não se aplica | `pld.json` |
| `atualidade_fontes` | algum conjunto usado com situação ATRASADO | não se aplica | `publicacao.json` |

Máquina de estados (`episodios`): o episódio começa no primeiro dia de uma sequência de `duração mínima` dias com a condição e termina no último dia com a condição antes de `retorno` dias seguidos sem ela; dia sem dado interrompe a contagem de entrada e não conta para o retorno. Estados: `ativo`, `em_retorno`, `em_observacao` (condição sem a duração mínima), `normal`, `sem_dado`. `ativo = true` (campo que a página já lê) vale para `ativo` e `em_retorno`.

Frequência de disparo (`resumo_historico`): dias avaliados, dias com a condição, acionamentos brutos (sequências da condição), acionamentos curtos descartados (sequências mais curtas que a duração mínima fora de qualquer episódio), episódios, episódios por ano (só com ao menos 365 dias avaliados), duração mediana e máxima, dias com alerta exibido (da confirmação até a véspera do retorno) e a sensibilidade a durações de 1, 3, 7 e 14 dias. Não há verdade de referência para chamar um alerta de falso; o que se mede como falso alarme é (a) o ruído filtrado pela duração e (b), com o registro das emissões, o alerta emitido que a reavaliação com os dados revisados já não confirma (comparação só entre emissões da mesma `versao_regra`).

Escolha das regras de água pelo monitoramento: a regra antiga ("algum dos quatro subsistemas fora da faixa") ficaria em alerta em 71,8% dos dias desde 2021 para a EAR e 66,3% para a ENA. Isso é ruído para uma síntese; a regra passou a olhar o SIN (23,6% e 26,8%), e a variante rejeitada é publicada em `alternativas_avaliadas` com a sua frequência.

## 4. Evidências de aceite

### 4.1 Reconciliação com a fonte (por outro caminho)

| Número | Gold | Fonte releida | Diferença e tolerância |
| --- | --- | --- | --- |
| EAR do SIN, 28/09/2026 | 61,6% (frase) e 61,65 (P005) | linhas do arquivo EAR_DIARIO_SUBSISTEMA_2026 do ONS (sha256 a73378b0...): 180.071,504 ÷ 292.068,192 MWmês = 61,654% | 0; exibição com uma casa |
| Nordeste fora da faixa, 28/09/2026 | 68,9%, acima do P90 de 68,0% | arquivo do ONS: 68,97% | igual |
| Carga média 22 a 28/09/2025 | 75.784 MWmed | arquivo Carga_Energia 2025 do ONS (sha256 18d5f6ad...): 75.783,77 | 0,23 MWmed (arredondamento ao MWmed) |
| Carga média 22 a 28/09/2026 | 83.771 MWmed (captura de 30/09) | arquivo Carga_Energia 2026 capturado em 01/10 00:38 UTC (sha256 45c8cd14...): 83.790,45 | 19,4 MWmed (0,023%), tolerância 0,05%: revisão do ONS nos dias recentes. Com a captura de 01/10 a variação passa de 10,54% para 10,57% e o texto passaria de "10,5%" para "10,6%" (seção 5) |
| PLD médio do Sudeste/Centro-Oeste, 30/09/2026 | R$ 135,25/MWh | média das 24 horas integradas (arquivo pld_horario_2026 da CCEE, captura de 30/09 02:20 UTC, sha256 b8fc7539...): 135,2458 | arredondamento ao centavo |
| Diferença entre submercados, 30/09/2026 | R$ 10,32/MWh | das 96 horas: 135,2467 (Norte) − 124,9296 (Nordeste) = 10,3171 | arredondamento ao centavo (com as médias arredondadas, Sudeste/Centro-Oeste e Norte empatam em 135,25, e o texto da regra cita o primeiro) |
| Horas no piso de R$ 57,31, 30/09/2026 | SE 10, S 14, NE 10, N 10 (texto da regra `pld_piso`) | contagem nas horas com \|PLD − 57,31\| ≤ R$ 0,005 | igual |
| Limites vigentes do PLD | 57,31; 1.611,04; 785,27 R$/MWh (CSV do PLD) | `regulacao.json#limites_pld.vigente_hoje` (Despacho ANEEL nº 3.850/2025) | 0, tolerância R$ 0,005/MWh |
| Restrição eólica, ago/2026 | 26,72% (`geracao_detalhe.json`, mensal) | soma das 124 linhas TOTAL diárias de agosto: 4.022.144,98 ÷ (4.022.144,98 + 11.029.275,19) = 26,7227% | 0,003 p.p. (arredondamento), tolerância 0,005 p.p. |
| Faixa do dia, EAR e ENA (SIN e subsistemas) | `hidrologia.json` | reavaliação a partir do silver com as funções da Visão geral | igual nos cinco recortes; ENA de 30 dias igual a uma casa |
| Participação térmica de 7 dias, 28/09/2026 | 10,6% | reavaliada de `geracao.json#serie_sin`: 10,632% | 0,03 p.p., tolerância 0,05 p.p. (MWmed diários arredondados) |

### 4.2 Testes que detectam erro real (`python3 -m unittest pipeline.tests.test_energia_visao`, 32 testes, OK)

* reconciliações acima com números escritos no teste;
* cada frase refeita a partir dos valores publicados e cada caminho de valor resolvido por um leitor independente na gold de origem (20 valores conferidos);
* data de processamento: 30/09/2026 02:20 UTC é 29/09/2026 em Brasília e o PLD de 30/09 sai como "1 dia depois", nunca "0 dias";
* máquina de estados com sequências de resultado calculado à mão (duração, retorno, dia sem dado, estados do último dia, sensibilidade);
* piso e teto no recorte real do CSV do PLD: episódio de piso de 23 a 25/04/2025 (dia isolado 18/04 com NE e N no piso descartado) e de teto em 31/08 e 01/09/2026, normalizado em 08/09/2026;
* carga sem comparação através da quebra de 29/04/2023 (série real de abr/2022 a jun/2023) e sem base incompleta;
* materialidade em pares reais de revisão do silver (−668,879 → 13.984,70 MWmed do NE em 26/09/2026 conta; 0,19% da EAR não conta);
* P005 com 990 células iguais às golds, colunas vazias depois do último dia de cada fonte, e rede sem alegação de congestionamento;
* P006 com período próprio, valores iguais às evidências de origem, DEC em horas e minutos, fonte atrasada na defasagem e indicador ausente declarado;
* construção completa a partir do recorte, com silver em memória e diretórios temporários (stub sem golds de operação; regras sem dado declaradas; registro das emissões sem duplicar estado).

### 4.3 Frequência de disparo no histórico (publicação de 01/10/2026)

| Regra | Duração / retorno | Dias avaliados | % dias com a condição | Acionamentos brutos | Curtos descartados | Episódios | Por ano | Duração mediana (máx.) | % dias em alerta | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ear_faixa | 7/7 | 2.097 | 23,5 | 6 | 0 | 5 | 0,9 | 23 (312) | 23,6 | normal |
| ena_faixa | 7/7 | 2.097 | 27,0 | 18 | 2 | 15 | 2,6 | 26 (169) | 26,8 | ativo |
| termica | 7/7 | 872 | 26,1 | 12 | 3 | 6 | 2,5 | 22,5 (115) | 25,5 | normal |
| carga_extrema | 2/3 | 766 | 5,2 | 14 | 4 | 7 | 3,3 | 3 (25) | 6,4 | normal |
| descolamento | 3/3 | 2.099 | 18,7 | 73 | 40 | 13 | 2,3 | 9 (110) | 17,5 | normal |
| pld_piso | 3/3 | 2.099 | 47,6 | 46 | 7 | 14 | 2,4 | 23,5 (388) | 48,6 | normal |
| pld_teto | 1/7 | 2.099 | 4,6 | 5 | 0 | 5 | 0,9 | 2 (91) | 6,1 | normal |
| restricao_eolica | 7/7 | 1.448 | 26,5 | 38 | 11 | 14 | 3,5 | 15 (86) | 26,0 | normal |
| restricao_solar | 7/7 | 535 | 25,6 | 15 | 6 | 6 | 4,1 | 12 (69) | 23,4 | em retorno |
| revisao_material | 1/1 | 4 | 75,0 | 1 | 0 | 1 | não estimável | 3 (3) | 75,0 | ativo |

Leitura: a duração mínima é o que separa ruído de condição persistente. No descolamento, 40 de 73 acionamentos duravam menos de 3 dias; com duração de 1 dia a regra ficaria em alerta em 24,7% dos dias. O piso passa metade do histórico em alerta porque 2022 e 2023 tiveram o PLD no piso quase o ano inteiro (episódio de 388 dias); é condição real, não ruído, e por isso fica no fim da ordem dos destaques.

## 5. Limitações e o que não se pode concluir

* Alerta descreve condição medida e não implica causa; as hipóteses dos destaques são listas fixas, não testadas nesta página.
* O histórico das regras é a reavaliação com os dados de hoje, já revisados; não reproduz o que o leitor via em cada data. O registro das emissões (`_visao_alertas`) começou nesta versão, com um processamento; a contagem de alertas não confirmados após revisão só ganha conteúdo com o tempo.
* A regra de revisões depende das capturas versionadas do silver principal, que começam em 27/09/2026: 4 dias avaliáveis, frequência anual não estimável.
* O silver principal estava com a captura de 30/09 da carga, enquanto o módulo Carga já tinha o arquivo do ONS de 01/10 com revisão de 0,023% na média de 7 dias; a frase usa a captura do silver principal até a próxima execução completa do `run.py`.
* Termica e restrição fotovoltaica têm histórico avaliável mais curto (desde mai/2024 e abr/2025): a regra exige 365 janelas anteriores no mesmo regime ou universo.
* Taxa de restrição usa a geração possível estimada pelo ONS e o universo de usinas dos arquivos de restrição (muda com usinas novas); não inclui MMGD.
* Energia e sociedade: períodos diferentes (vigência de 30/09/2026, anos de 2025, mai/2025); a Tarifa Social tem 17 meses de defasagem porque o SCS da ANEEL não publicou competência posterior a jun/2025.
* A tarifa de referência é a mediana simples entre distribuidoras com vigência na data, sem tributos e sem bandeira; não é a conta de luz nem uma média ponderada por consumidores.
* P005 alinha calendários, não publicações: valores da mesma data vêm de fontes publicadas em momentos diferentes.

## 6. Pedidos ao integrador

1. `run.py`: retirei a construção de `sintese.json` do bloco das golds de operação (import de `sintese` e as três linhas do `publicar`), como autorizado; a gold agora sai do laço de módulos (ordem 98) e entra em `meta.json#golds` pelo mesmo caminho dos demais módulos.
2. Catálogo (`catalogo.py`, `INTEGRADOS`): `sintese.json` passou a usar também conjuntos de outros módulos por meio das golds deles (`aneel_tarifas_aplicacao`, `aneel_continuidade`, `aneel_samp_balanco`, `aneel_scs`, `ons_coff_eolica`, `ons_coff_fotovoltaica`). O REGISTRO do módulo declara `datasets: []` de propósito (declarar de novo sobrescreveria família e dataset do silver em `datasets_integrados`); pedido: acrescentar `sintese.json` às golds desses conjuntos no catálogo, ou derivar isso dos módulos.
3. Tipos: `gold.sintese()` em `src/lib/energia/gold.ts` devolve `SinteseGold` (campos antigos). Na fase de interface, trocar por `SinteseVisaoGold` de `tipos-visao.ts` ou fazer `SinteseGold` estender esse tipo.
4. Testes TypeScript fora deste módulo que falham hoje e não dependem de `sintese.json`: `energia-reauditoria` ("mudança identificada pela plataforma não aparece como declarada pela fonte": quebra `ccee:consumo_classe_agente` de 2026-02-01 sem origem) e `energia-gold-contrato` (estado `PUBLICADO` não aceito para um conjunto de `DATASETS_INTEGRADOS`). Os três testes que leem `sintese.json` passam.
5. O módulo Dados mudou o esquema de `publicacao.json#conjuntos` (o conjunto agora vem em `id` "família/dataset"); a Visão geral lê os dois formatos, mas convém fixar o contrato no tipo do módulo Dados.
