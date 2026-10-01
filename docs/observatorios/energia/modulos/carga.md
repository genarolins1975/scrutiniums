# Módulo Carga (P025, P026 e P027; achados A07 e A11 na parte de carga)

Rota: `/setor-eletrico/carga`. Família de silver: `ons_carga` (`data/energia/silver/ons_carga.db`). Ordem no `run.py`: 21 (id do módulo: `carga`).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Validação física com quarentena e gold de operação `carga.json` | `pipeline/energia/gold/carga.py` (builder existente, do mesmo dono) |
| Coleta, silver e gold de detalhe | `pipeline/energia/modulos/carga_detalhe.py` |
| Parsers do ONS (curva horária, API de carga verificada, balanço de energia, arquivo atual da carga diária) | `pipeline/energia/fontes/ons_carga.py` |
| Calendário oficial (leis de feriados, Páscoa, classes de dia) | `pipeline/energia/fontes/calendario_carga.py` |
| Temperatura (NASA POWER, IBGE; Open-Meteo coletado e não usado) | `pipeline/energia/fontes/clima_carga.py` |
| Decomposição estatística (mínimos quadrados em Python puro) | `pipeline/energia/fontes/modelo_carga.py` |
| Métricas | `pipeline/energia/metricas/carga.py` (9 medidas) |
| Testes | `pipeline/tests/test_energia_carga.py` (56 testes), amostras reais em `pipeline/tests/dados/energia_carga/` |
| Gold | `public/energia/gold/carga_detalhe.json` (cerca de 426 KB) e `public/energia/gold/carga.json` (validação acrescentada) |
| Downloads | `public/energia/series/carga_*.csv` (11 arquivos novos, todos abaixo de 5 MB) e `carga_diaria.csv` |
| Tipos TS | `src/lib/energia/tipos-carga.ts` (conferido contra a gold publicada com `tsc`, ver 4.9) |

Execução: `python3 pipeline/energia/executar_modulo.py carga` (coleta e gold) ou `--sem-coleta` (só gold de detalhe, cerca de 21 s, pico de 310 MB de memória residente, medido em 01/10/2026). A gold `carga.json` é escrita pelo `run.py` (`gold/carga.py`, cerca de 4 s, 36 MB). A primeira coleta levou cerca de 5 minutos (curva: 27 arquivos em 59 s; API: 372 pedidos mensais em 198 s; NASA: 27 pontos em 22 s); nas execuções seguintes só o mês corrente e o anterior da API, os arquivos com `last_modified` novo e os 27 pontos da NASA são baixados de novo. Toda vintage da curva ainda não lida pela versão atual do parser é reimportada do bronze, sem rede (`importa_pendentes_curva`).

## 1. Painéis e estado

| Painel | Estado dos dados (esta fase) | Interface |
| --- | --- | --- |
| P025 Nível e crescimento | Concluído com limitação declarada. Série diária por subsistema e SIN (2000 a 28/09/2026) com validação física antes da publicação (domínio, faixa, salto, conferência de atípico nos componentes do balanço de energia e registro de cada dia ausente com o estado conferido no arquivo da fonte); comparações de 7 dias, 28 dias, mês corrente, último mês completo e 52 semanas contra as mesmas datas do ano anterior e contra os mesmos dias da semana 364 dias antes, com a composição de dias úteis, sábados e domingos ou feriados das duas janelas; médias anuais com variação só entre anos completos no mesmo regime; acumulado do ano com a composição de calendário das duas janelas; 36 meses com variação e dias úteis; revisões entre capturas. Limitação: o silver principal tem só duas capturas do arquivo de 2026, então o histórico de revisões começa em 29/09/2026. | Não iniciada (fase 2). A página atual lê `carga.json`. |
| P026 MMGD e perfil horário | Concluído com limitação declarada. Curva horária desde 2019 (agregados diários desde 2000), pico diário e hora do pico, distribuição anual da hora do pico, maior carga horária de cada ano, perfil típico por mês e classe de dia; carga global, MMGD estimada e carga líquida de MMGD só da API de carga verificada, com a identidade conferida em 534.336 meias horas e a natureza publicada série a série. Limitação material: a MMGD incluída na carga diária e na curva (declarada para 29/04/2023, observada nos dados em 01/05/2023) não é publicada separada pelo ONS, e a carga global da API é outra grandeza; por isso a decomposição horária é da API, e a curva fica ao lado, nunca subtraída. | Não iniciada (fase 2). |
| P027 Clima e calendário | Concluído com limitação declarada. Decomposição estatística (não causal) da carga diária em calendário, temperatura, sazonalidade e tendência, estimada só com o passado, avaliada em 29 origens mensais fora da amostra (880 dias, 01/05/2024 a 27/09/2026), com intervalos empíricos, resíduos, cobertura efetiva, referência ingênua e seis variantes de sensibilidade. Limitações: temperatura de reanálise e análise de modelo (NASA POWER), não observação de estação (INMET sem resposta, ver 5.2); a sensibilidade ao produto de temperatura (Open-Meteo, ERA5 e IFS) não foi calculada, porque a cota diária do serviço só permitiu coletar 15 das 27 capitais; cobertura dos intervalos abaixo da nominal (SIN: 71,5% no de 80% e 91,6% no de 95%), publicada como ressalva e não corrigida. | Não iniciada (fase 2). |
| A07 Carga, revisão e MMGD | Fechado com evidência (ver 4.3). | |
| A11 Quebra de 29/04/2023 (parte de carga) | Fechado com evidência (ver 4.4): a inclusão da MMGD aparece na carga em 01/05/2023, não em 29/04/2023; tratamento aplicado. A parte de geração é do módulo Geração (pedido em 6). | |

## 2. Fontes verificadas (consulta em 30/09/2026 e 01/10/2026)

### 2.1 ONS, Carga de Energia Diária (silver principal, só leitura)

* Conjunto: https://dados.ons.org.br/dataset/carga-energia (CKAN `package_show` em 30/09/2026; licença "Creative Commons Atribuição"; atualização declarada diária, às 12h e 19h).
* Recursos: `CARGA_ENERGIA_AAAA.csv` (2000 a 2026) no S3 `carga_energia_di`; o silver principal tem 28 capturas de 27 arquivos (a de 2026 em 29/09/2026 02:42:48 UTC, sha256 `de70b50fcf85e2f3…`, e em 30/09/2026 02:19:48 UTC, sha256 `cdb81418d9810b3d…`). O arquivo bruto dessas capturas não está no bronze deste ambiente (o silver foi restaurado da cópia durável sem o bronze); o valor de cada captura está no silver. Ver 2.7 para o arquivo que ainda se obtém.
* Dicionário: `DicionarioDados_Carga_Energia_Diaria.pdf` (página de 01/05/2023, versão 1.2): `val_cargaenergiamwmed` em MWmed, **não admite nulo, zero nem negativo**. É a base da regra F1.
* Notas da fonte (CKAN): até fev/2021, carga atendida por usinas despachadas ou programadas; entre mar/2021 e abr/2023, mais a previsão de usinas não despachadas; a partir de 29/04/2023 (data declarada), mais "o valor estimado da MMGD, com base em dados meteorológicos previstos" (observado nos dados em 01/05/2023, ver 4.4); "processo de consistência recorrente", sujeito a atualização.

### 2.2 ONS, Curva de Carga Horária

* Conjunto: https://dados.ons.org.br/dataset/curva-carga (licença "Creative Commons Atribuição"; metadados modificados em 30/09/2026 22:01; atualização declarada diária, às 12h e 19h).
* Recursos integrados: `CURVA_CARGA_2000.csv` a `CURVA_CARGA_2026.csv` em https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/curva-carga-ho/ (27 arquivos, 7,4 MB comprimidos no bronze; o de 2026 com `last_modified` 30/09/2026 22:01, capturado em 30/09/2026 23:31 UTC). O Parquet do mesmo conjunto guarda o valor como texto (`val_cargaenergiahomwmed: string`, ex. `'5152.56599999'`): usamos o CSV.
* Dicionário: `DicionarioDados_CurvaCarga.pdf`, versão 1.2 de 06/04/2026: `id_subsistema`, `nom_subsistema`, `din_instante` (AAAA-MM-DD HH:MM:SS), `val_cargaenergiahomwmed` (MWmed; não admite nulo nem negativo; admite zero).
* Grão: hora local por subsistema; `din_instante` é o início da hora (a média das 24 horas do dia D reproduz a carga diária do dia D, ver 4.1). Antes de 2019 há horário de verão: no dia de início, a hora das 00h não existe no relógio local. O ONS marca essa hora com célula vazia no SE, no NE e no N e, no Sul em 04/11/2018, com `0E-8` (único valor não positivo nos 27 arquivos, varredura de 01/10/2026). A leitura trata zero e negativo como ausência (a carga de um subsistema inteiro não é zero), registra o valor descartado no controle da vintage e na proveniência, e o dia fica com 23 horas, sem média e sem pico. Com o zero lido como carga, o Sul de 04/11/2018 tinha 24 horas e média de 7.968,2 MWmed; a Carga de Energia Diária do dia é 8.314,64278275 MWmed, igual à soma das 23 horas reais dividida por 23.
* Silver: horas desde 2019 (`carga_ho.<sm>`) e, para todos os anos, média, pico, hora do pico e horas do dia por subsistema e SIN (o SIN horário é a soma dos quatro; o pico do SIN é o máximo da soma). 466.600 observações (versão 2 da leitura, reimportada do bronze em 01/10/2026).

### 2.3 ONS, Carga de Energia Verificada (API)

* Conjunto: https://dados.ons.org.br/dataset/carga-energia-verificada (licença "Creative Commons Attribution"); não tem arquivos: o CKAN aponta a API `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=&dat_fim=&cod_areacarga=` e o dicionário.
* Dicionário: `DicionarioDados_Carga_Verificada.pdf` (versão 1.1, 30/10/2023) e `.json`: carga global (`val_cargaglobal`), global líquida de MMGD (`val_cargaglobalsmmg` no dicionário; a API responde `val_cargaglobalsmmgd`), MMGD (`val_cargammgd`, não admite negativo), global consistida, consistência, supervisionada (geração tipo I, IIA, IIB, IIC e intercâmbios) e não supervisionada (medição da CCEE, geração tipo III). `din_referenciautc` é o fim da meia hora em UTC.
* Natureza por série (seção 11.3), publicada em `proveniencia.api.natureza_por_serie`: MMGD, ESTIMADO (estimativa do ONS, não supervisionada); carga líquida de MMGD, OBSERVADO (supervisão do ONS mais medição da CCEE); carga global, OBSERVADO com componente ESTIMADO (a MMGD).
* Integração: 4 submercados (SECO, S, NE, N) × 93 meses (01/2019 a 09/2026), um pedido por mês e submercado (a API corta respostas longas), 372 arquivos JSON no bronze (21 MB). Recoleta diária do mês corrente e do anterior; meses antigos a cada 30 dias (há registros de 2025 com `din_atualizacao` de 2026).
* Comportamentos observados e tratados: campo vazio emitido como `"campo": ,` (JSON inválido) vira ausência; MMGD vazia até 14/02/2019; o dia em curso vem com zeros nas horas futuras e é descartado; horário de verão até 16/02/2019 (conversão pelo fuso `America/Sao_Paulo`: com UTC−3 fixo, 94 meias horas de janeiro e fevereiro de 2019 cairiam no dia anterior); a parcela não supervisionada é zero até 31/10/2020 e passa a ~3 GW no SE/CO em 01/11/2020 sem degrau na carga global (mudança de repartição, que o módulo não usa).
* Áreas de carga por submercado conferidas pela soma das áreas geoelétricas da própria API em 20/09/2026 (S: RS + PR + SC + PES = 11.025,5 contra 11.025,4 MWmed; SE/CO: SP + MG + RJ + ES + GO + DF + MT + MS + AC + RO + TOCO + PESE = 40.527,6 contra 40.527,5; N: PA + MA + AM + AP + RR + TON + PEN = 9.263,0 contra 9.261,9; NE: BASE + BAOE + PI + PBRN + CE + ALPE + PENE = 13.342,7 contra 13.335,0).
* Silver: por hora cheia local (duas meias horas), `global_ho.<sm>` e `mmgd_ho.<sm>`; a carga líquida é a diferença, publicada pelo ONS e conferida meia hora a meia hora na ingestão. 538.748 observações.

### 2.4 NASA POWER (temperatura)

* API diária por ponto: https://power.larc.nasa.gov/api/temporal/daily/point (documentação https://power.larc.nasa.gov/docs/services/api/temporal/daily/), parâmetros `T2M` e `T2M_MAX`, comunidade `RE`, 01/01/2019 até a véspera. Dados da NASA de acesso livre, com pedido de citação do projeto POWER.
* Natureza: ESTIMADO (reanálise MERRA-2 no histórico; análise GEOS-IT no trecho ainda não coberto pelo MERRA-2). Fonte por mês identificada com um pedido por mês recente: MERRA-2 até 08/2026, GEOS-IT em 09/2026 (registrado em `temperatura.fontes_por_mes`). Valor `-999` é ausência. Defasagem observada: em 30/09/2026, o último dia com valor era 27/09/2026.
* Pontos: centroide do município da capital de cada UF (IBGE, API de malhas v3, metadados; nome e UF conferidos na API de localidades v1).
* Pesos: população residente estimada por UF (IBGE, SIDRA 6579, variável 9324, ano 2026), normalizada dentro de cada subsistema; dia publicado com pelo menos 95% do peso.

### 2.5 Senado Federal (leis dos feriados)

* `https://legis.senado.leg.br/dadosabertos/legislacao/lista.json?tipo=LEI&numero=&ano=` para as Leis nº 662/1949, 10.607/2002, 6.802/1980, 14.759/2023 e 9.093/1995: as cinco conferidas pela norma e pela ementa em 30/09/2026 (`conferida_ementa = true`). O texto de nenhuma delas foi relido (`conferida_texto = false`, com o motivo em `texto_situacao`): o Planalto respondeu "Empty reply from server" (30/09/2026 e 01/10/2026 06:03 UTC) e os PDFs de publicação do Senado vieram com 0 byte (HTTP 200, `application/pdf`) em 01/10/2026 06:04 UTC, tanto o da Lei nº 9.093/1995 (`https://legis.senado.leg.br/norma/550969/publicacao/14260517`) quanto o da Lei nº 10.607/2002 (`https://legis.senado.leg.br/norma/552483/publicacao/14353189`).
* Feriados nacionais: 1º/1, 21/4, 1º/5, 7/9, 2/11, 15/11 e 25/12 (Lei nº 662/1949 com a redação da Lei nº 10.607/2002), 12/10 (Lei nº 6.802/1980), 20/11 a partir de 2024 (Lei nº 14.759/2023). A Sexta-feira da Paixão (Lei nº 9.093/1995, cuja ementa é só "Dispõe sobre feriados.") e os pontos facultativos federais (Carnaval, Cinzas, Corpus Christi, portaria anual) ficam em categorias próprias; a categoria da Paixão diz que o texto não foi relido.

### 2.6 ONS, Balanço de Energia nos Subsistemas (conferência de valor atípico)

* Conjunto: https://dados.ons.org.br/dataset/balanco-energia-subsistema; recursos `BALANCO_ENERGIA_SUBSISTEMA_AAAA.csv` (2000 a 2026), capturados em 01/10/2026 00:36 a 00:37 UTC (27 arquivos; o de 2018 com sha256 `adc1fe1520a8…`). Licença do ONS.
* Uso: só validação (estado "UTILIZADO EM VALIDAÇÃO"). Guardamos a média diária de cada componente por subsistema (hidráulica, térmica, eólica, solar, carga, intercâmbio; célula vazia é ausência). A carga do balanço é a mesma da carga diária; os componentes de geração são a informação independente que denuncia lacuna de dado (regra C1, 3.1).

### 2.7 ONS, Carga de Energia Diária, arquivo atual da fonte (conferência de ausência e evidência)

* Os mesmos `CARGA_ENERGIA_AAAA.csv` do 2.1, baixados para a família `ons_carga` em 01/10/2026 00:37 a 00:38 UTC. Uso: estado de cada dia ausente (célula vazia, linha ausente ou valor presente que o silver principal não tem; regra A1) e arquivo que ainda se obtém para a evidência. O de 2025 tem o mesmo sha256 da captura usada no A07 (`18d5f6ad9a86…`); o de 2026 já é outro (`45c8cd14bce4…`), porque o ONS revisou o arquivo depois da captura de 30/09/2026 02:19 UTC.

### 2.8 Open-Meteo (coletado, não utilizado)

* API de arquivo histórico (https://open-meteo.com/en/docs/historical-weather-api), modelos ERA5 e ECMWF IFS, nos mesmos 27 centroides, desde 25/04/2023; licença CC BY 4.0.
* Estado: "COLETADO, NÃO UTILIZADO". A API tem cota diária de pedidos por endereço e o endereço do ambiente é compartilhado: em 30/09/2026 respondeu HTTP 429 "Daily API request limit exceeded"; em 01/10/2026, das 00:38 às 00:56 UTC (depois da virada da cota), respondeu 200 para 15 capitais; às 05:5x UTC voltou a responder 429 (teste do verificador). As 15 capitais coletadas (AC, BA, DF, ES, MG, MS, PB, PI, PR, RJ, RN, RO, RS, SC, SP) cobrem 100% do peso populacional do Sul, 89,5% do SE/CO, 51,5% do NE, nada do N e 72,4% do SIN: só o Sul passaria da cobertura mínima de 95% do peso, e nenhum número publicado usa este conjunto. A sensibilidade da decomposição ao produto de temperatura fica para quando as 27 capitais estiverem coletadas.

## 3. Método

### 3.1 Validação física com quarentena (`pipeline/energia/gold/carga.py`)

Antes de publicar, cada valor diário passa por F1 (positivo, domínio do dicionário: violação é sempre quarentena, sem conferência), F2 (entre 50% do menor e 150% do maior valor aceito do subsistema nos 1.095 dias anteriores, com pelo menos 365 dias) e F3 (até 40% de desvio sobre a mediana dos 7 dias anteriores aceitos).

Valor que viola F2 ou F3 passa pela conferência C1 no Balanço de Energia nos Subsistemas (2.6), outro conjunto do ONS: confirmado só se (a) o balanço tem o dia e pelo menos um dia vizinho, (b) nenhum componente de geração (hidráulica, térmica, eólica, solar) tem lacuna no dia (média abaixo de 25% do menor valor dos vizinhos, quando esse valor é material: pelo menos 100 MWmed e 5% da carga dos vizinhos) e (c) a carga do balanço é igual ao valor diário (até 0,5% ou 5 MWmed). Confirmado, é publicado como atípico conferido; sem confirmação (lacuna, balanço divergente ou sem balanço), fica em quarentena (ausência, nunca zero nem repetição). A média das 24 horas da curva horária aparece no registro, mas não confere nada: é o mesmo produto em outro grão e repete qualquer erro do valor diário. Dia em quarentena num subsistema deixa o SIN do dia sem valor.

Registros esperados (A1): todo dia do calendário entre o primeiro e o último dia publicado é esperado em cada subsistema; cada dia ausente é registrado com o estado conferido no arquivo atual da fonte (2.7) e publicado como célula vazia em `carga_diaria.csv`.

Calibração no histórico inteiro (2000 a 28/09/2026, 9.768 dias esperados por subsistema): quatro dias violam F2 ou F3. Os três do Sul (06, 07 e 08/01/2015, volta ao nível normal depois do fim de ano) são confirmados pelo balanço: componentes contínuos e geração menos intercâmbio igual ao valor (12.307,8 MWmed em 06/01/2015). O Nordeste em 25/08/2018 (3.969,8 MWmed, F2 e F3) fica em quarentena: a eólica do balanço vai de 6.686,7 MWmed (24/08) a 219,7 (25/08) e volta a 6.305,7 (26/08), e a solar de 238,8 a 11,9 e 238,0; é lacuna de dado de geração, não carga real. Ausentes na fonte: 2013-12-01, 2014-02-01 e 2015-04-09 nos quatro subsistemas (12 valores), todos com célula vazia no arquivo atual. A gold registra as regras, a quarentena, os atípicos conferidos, os registros esperados, as ausências e todo valor fora do domínio em qualquer captura, com a revisão da fonte.

### 3.2 Comparações equivalentes (P025)

Variação = 100 × (média da janela ÷ média da janela de comparação − 1), só com todos os dias presentes e no mesmo regime. Dois tipos lado a lado: mesmas datas do ano anterior (o que a gold de operação publica) e equivalente (364 dias antes, mesmos dias da semana). Para cada janela, e também para o acumulado do ano, a gold publica a composição de dias (útil; sábado; domingo, feriado nacional, Paixão e Carnaval), os eventos do calendário e os feriados em dia útil das duas janelas, e marca se o calendário é equivalente. No acumulado de 01/01 a 28/09/2026 contra 02/01 a 29/09/2025, o calendário não é equivalente (186 contra 188 dias úteis; 01/01, 21/04 e 07/09/2026 em dia útil; 07/09/2025 num domingo), e isso sai publicado ao lado da variação de +1,24%. Os dias entre a data declarada e a data observada da inclusão da MMGD (29 e 30/04/2023, ver 4.4) formam um regime próprio: nenhuma comparação que os toca vira variação, e a coluna `regime` dos CSVs os marca como `transicao`.

### 3.3 Curva, pico e perfil (P026)

Perfil típico = média, hora a hora, dos dias completos de cada classe no mês, separadamente para a carga da curva e para a carga global, a MMGD e a carga líquida da API (dias completos próprios de cada produto, com a contagem publicada). Pico = maior valor horário do dia, hora local de início (empate: a primeira). Dia sem as 24 horas não tem média nem pico; no CSV de pico ele aparece com as células vazias e a contagem de horas. MMGD mensal = 100 × Σ MMGD ÷ Σ carga global nas mesmas horas (razão de somas).

### 3.4 Decomposição estatística (P027)

`ln(carga diária)` por subsistema e SIN, mínimos quadrados: constante e tendência linear; seis variáveis de dia da semana (quarta como base); feriado nacional ou Paixão em dia útil; feriado no sábado; segunda e terça de Carnaval; Cinzas; Corpus Christi; ponte; fim de ano (24 a 31/12 e 2/1); dois harmônicos anuais; temperatura média ponderada com dobras nos tercis da primeira janela de treino; temperatura do dia anterior. Treino desde 01/05/2023 (início observado do regime; data declarada 29/04/2023, ver 4.4). Origens no primeiro dia de cada mês desde 01/05/2024: o modelo é estimado só com os dias anteriores e prevê o mês com temperatura e calendário realizados (decomposição ex post, não previsão). Intervalos de 80% e 95% pelos quantis dos erros fora da amostra de origens anteriores (com pelo menos 60 dias deles; antes, dos resíduos do treino). Contribuição de um grupo = Σ β × (x − média do treino); diferença entre duas janelas = Σ β × (x̄_A − x̄_B), resíduo = diferença real − diferença prevista, em log × 100. Sensibilidade: sem temperatura, temperatura só linear, temperatura máxima, só feriados por lei, treino desde 01/03/2021 com degrau no regime. Nada é chamado de efeito ou de percentual explicado. O período avaliado publicado é o do primeiro ao último dia efetivamente previsto (`p027.periodo_avaliacao`).

## 4. Evidências de aceite

### 4.1 Curva horária contra a carga diária

A média das 24 horas da curva reproduz a Carga de Energia Diária em 38.942 de 38.984 pares dia × subsistema (tolerância 0,01 MWmed). Os 42 restantes: SE e S em dias de out/2017 a abr/2018 (até −654,8 MWmed no SE em 07/10/2017) e os dias de 21 a 28/09/2026, que o ONS revisou depois da captura diária (NE em 25/09/2026: 15.114,4 na diária capturada às 02:19 UTC de 30/09; 15.176,7 na curva capturada às 23:31 UTC). O Sul em 04/11/2018 deixou de ser comparado: com o zero da hora inexistente tratado como ausência, a curva não tem média nesse dia (ver 2.2). Como a curva e a carga diária são o mesmo produto, esta conferência prova a agregação, não o valor. No teste: SE em 20/09/2026, média da curva 39.166,81475 MWmed, idêntica ao valor do arquivo diário; Sul em 04/11/2018, soma das 23 horas ÷ 23 = 8.314,64278 MWmed, igual ao `CARGA_ENERGIA_2018.csv`.

### 4.2 Carga verificada contra o módulo Transição

Mesma API, código independente (`fontes/ons_transicao.py`): energia diária de MMGD e carga global por submercado em 11.132 pares dia × submercado, diferença máxima de 0,05 MWh (o arquivo do módulo Transição tem uma casa decimal). No teste: SE em 20/09/2026, 972.659,453 MWh de carga global e 113.618,515 MWh de MMGD contra 972.659,5 e 113.618,5 em `transicao_ons_mmgd_diario.csv`. Identidade carga global = líquida + MMGD: 534.336 de 534.336 meias horas (0,01 MWmed). No teste do perfil e da série recente de 20/09/2026, a carga líquida publicada pela gold é comparada com a `val_cargaglobalsmmgd` publicada pelo ONS (não com a subtração feita aqui), e a carga com a curva bruta: diferença de no máximo 1 MWmed (arredondamento) nas 24 horas.

### 4.3 Achado A07 (+10,5% em sete dias)

* Origem: `carga.json` do commit `d95d8f8b4` (gerada em 2026-09-30T02:20:27Z) publicava +10,5% para o SIN e para o NE nos 7 dias de 22 a 28/09/2026 contra 22 a 28/09/2025.
* Reprodução com o silver como estava naquele instante (capturas de 2025 em 29/09 02:42 e de 2026 em 30/09 02:19): média de 83.771,1 MWmed contra 75.783,8 MWmed, +10,54% (arredondado, 10,5: confere). O verificador refez a conta com o `CARGA_ENERGIA_2026.csv` baixado em 01/10/2026 05:45 UTC: 83.790,4 contra 75.783,8, +10,57% (revisões posteriores da fonte).
* Versão: a captura anterior (29/09/2026 02:42 UTC) não tinha 27 e 28/09 e trazia o NE de 26/09 em −668,879 MWmed (SIN do dia: 63.184,9 MWmed); com ela, a janela não existe. Entre as duas capturas, 33 valores foram revisados; nos 32 com valor anterior positivo, mediana de 0,0191% e máximo de 4,07% (a correção do valor negativo fica à parte).
* Calendário: as duas janelas têm sete dias seguidos (um de cada dia da semana), nenhum feriado nacional nem ponto facultativo, e estão no mesmo regime. Com os mesmos dias da semana (23 a 29/09/2025): +11,45%.
* MMGD (API, outro produto): carga global do SIN +8,28%, MMGD +14,03%, carga líquida +7,56%; o aumento da MMGD equivale a 1,57 ponto percentual da carga global da semana de 2025 (identidade contábil, não causa). A curva e a carga diária incluem uma estimativa de MMGD que o ONS não separa, então a parcela de MMGD na própria variação de +10,5% não é identificável.
* Clima e calendário (decomposição estatística): como a temperatura de 28/09/2026 ainda não estava publicada, a comparação decomposta é outra: 6 dias, 22 a 27/09/2026 contra 23 a 28/09/2025 (364 dias antes), com variação de +11,06%, que não é o +10,54% dos 7 dias do achado e a gold diz isso no texto. Em log × 100, a diferença de 10,5 = calendário 0,0 + temperatura 2,5 + sazonalidade 0,0 + nível e tendência 2,6 + resíduo 5,3. Temperatura média ponderada do SIN: 23,1 °C em 2026 (GEOS-IT) e 21,7 °C nos mesmos dias da semana de 2025 (MERRA-2).
* Fora da amostra, cada janela com as próprias datas e contagens: de 22 a 27/09/2026 (6 dias previstos), +2,8% acima do previsto, 5 dias acima do intervalo de 80%; de 22 a 28/09/2025 (7 dias previstos), −4,5%, 6 dias abaixo do intervalo (Sul −9,0%, SE −4,7%). A gold publica esses números sem leitura interpretativa: o modelo não reproduz cerca de 5 pontos de log da diferença, e nada é atribuído à atividade econômica.

### 4.4 Achado A11, parte de carga (inclusão da MMGD)

Regra: dia de maior degrau (média dos 3 dias a partir do dia menos a média dos 3 anteriores) num raio de 10 dias em torno de 29/04/2023, em três séries. Resultado: carga diária − carga global da API sobe +1.813 MWmed em **01/05/2023**; curva − carga global às 12h sobe +9.775 MWmed em **01/05/2023** (a MMGD da API às 12h teve média de 11.689 MWmed na janela); a geração solar do balanço de energia sobe +2.541 MWmed em **29/04/2023**. Às 12h de 29 e 30/04/2023 a curva ainda fica 10.944 e 11.388 MWmed abaixo da carga global (o tamanho da MMGD); em 01/05/2023, 1.542 abaixo. Tratamento: 29 e 30/04/2023 ficam fora de comparações e do treino do modelo, que começa em 01/05/2023, e saem como `transicao` na coluna `regime` de `carga_horaria.csv` e `carga_pico_diario.csv`; todo texto publicado usa "declarada para 29/04/2023, observada nos dados em 01/05/2023".

### 4.5 Valor negativo de 26/09/2026 (validação física)

Com a captura de 29/09/2026 02:42 UTC, o NE de 26/09/2026 (−668,879 MWmed) cai em F1 e fica em quarentena sem conferência; o SIN do dia fica ausente; a gold registra a ocorrência e a revisão para 13.984,69575 MWmed na captura de 30/09/2026 02:19 UTC. Teste com os valores reais das duas capturas.

### 4.6 Decomposição estatística (P027)

Fora da amostra (29 origens, 880 dias, 01/05/2024 a 27/09/2026, último dia previsto): MAPE do SIN 2,08% (referência de 364 dias: 4,80%); SE 2,31% (5,90%); S 3,91% (7,68%); NE 2,51% (5,06%); N 2,42% (6,92%). Viés do SIN −0,89%. Cobertura do intervalo de 80%: SIN 71,5%, N 59,2%; de 95%: SIN 91,6%, N 82,6%. Abaixo da nominal, a evidência marca as duas coberturas como "ressalva" (aprovado só quando a cobertura alcança a nominal): os intervalos são mais estreitos que a incerteza real. Sem temperatura, o MAPE do SIN sobe para 3,04%; no N, temperatura quase não muda o erro (2,46% sem, 2,42% com). Teste de "sem olhar o futuro": triplicar a carga a partir de junho/2024 não altera nenhuma previsão de maio/2024.

### 4.7 Compatibilidade entre os produtos (P026)

Carga global da API contra a curva, mesmas horas, SIN: +5,26% (2019), +6,04% (2020), +2,67% (2021), +3,45% (2022), +2,32% (2023), +1,02% (2024), +2,32% (2025), +3,76% (2026 até 29/09); nos últimos 365 dias, +2,5% à meia-noite e +7,5% ao meio-dia. Por isso carga, MMGD e carga líquida só são decompostas na API.

### 4.8 Testes

`python3 -m unittest pipeline.tests.test_energia_carga`: 56 testes, todos aprovados em 01/10/2026 (06:2x UTC), com o código e a gold desta versão. Cobrem: reconciliação da curva com a carga diária publicada e da API com o arquivo do módulo Transição; zero da hora inexistente do horário de verão (linhas reais de 04/11/2018) tratado como ausência; reprodução do A07 com as duas capturas reais; quarentena do valor negativo sem conferência e registro da revisão; conferência C1 com recortes reais do balanço (Sul em 06 a 08/01/2015 confirmado com geração menos intercâmbio de 12.307,8; Nordeste em 25/08/2018 em quarentena pela lacuna da eólica, mesmo com a curva e a carga do balanço repetindo o valor; sem balanço, quarentena); registros esperados e estado de cada ausência com o recorte real do `CARGA_ENERGIA_2013.csv`; perfil típico e série recente de 20/09/2026 comparados com a curva bruta e com a carga líquida publicada pelo ONS (nenhuma soma ou subtração da MMGD na curva); mediana das revisões com número par de valores; composição de calendário do acumulado do ano; regime de transição nos CSVs; Open-Meteo não declarado como utilizado; zero não é carga; hora ausente não vira média; campo vazio da API; horário de verão da API; dia em curso; calendário (Páscoa de 2024 a 2026, 20/11 só desde 2024, 7/9/2026 numa segunda, Cinzas útil, antes de 2003 sem classe); Senado; pesos populacionais e UF sem população; dia sem cobertura mínima; modelo (sistema linear conhecido, sem olhar o futuro, contribuições que fecham, decomposição que fecha com o real, dia sem dado não vira zero); contrato da gold publicada (quarentena do NE em 2018 e variações de 2018 e 2019 nulas, ausências visíveis em `carga_diaria.csv`, variação só no mesmo regime, natureza por série, leis com ementa conferida e texto não, período e cobertura do backtest, arquivos das evidências existentes ou declarados indisponíveis, textos sem "desde 29/04/2023", textos do A07 que não confundem as janelas, evidências válidas, "não causal").

### 4.9 Tipos

`src/lib/energia/tipos-carga.ts` conferido contra `carga_detalhe.json` e contra `carga.json` (`validacao`) publicados, com `tsc` num arquivo de conferência fora do projeto (literais alargados; dois controles negativos, um campo inexistente e o campo antigo `conferida` das leis, reprovados como esperado). `npx tsc --noEmit -p /home/user/scrutiniums` sem erros em 01/10/2026.

### 4.10 Defeitos da verificação adversarial (01/10/2026) e o que foi feito

| Defeito | Situação | Evidência |
| --- | --- | --- |
| NE em 25/08/2018 publicado como atípico conferido pela curva | Corrigido | Gold `carga.json` e `carga_detalhe.json` geradas de novo com a conferência C1: o dia está em quarentena (F2 e F3, lacuna da eólica), `carga_diaria.csv` tem NE e SIN vazios em 25/08/2018, a média do NE em 08/2018 passou de 9.977 para 10.177 MWmed (30 dias), a de 2018 de 10.330,2 para 10.347,7, 2018 deixou de ser ano completo e as variações anuais de 2018 e 2019 são nulas. |
| Código, gold, testes e documento divergentes; 2 de 37 testes falhando | Corrigido | Os dois testes reescritos para a regra C1 com recortes reais do balanço; `_VALIDACAO` (métricas), 3.1 e 4.8 reescritos; `tipos-carga.ts` com `registros_esperados`, `ausentes`, `balanco`, `A1`; 56 de 56 aprovados depois de gerar a gold de novo. |
| Open-Meteo declarado "UTILIZADO EM MODELO" sem uso | Corrigido | REGISTRO com "COLETADO, NÃO UTILIZADO" e sem download; proveniência e 2.8 dizem que é cota diária, não bloqueio, e quantas capitais foram coletadas; teste que reprova o estado "UTILIZADO" e a leitura do conjunto em `construir`. O balanço é "UTILIZADO EM VALIDAÇÃO" e a gold publicada agora o usa. |
| `0E-8` da hora inexistente lido como carga zero | Corrigido | `le_curva` trata zero e negativo como ausência e registra o descarte; as 27 vintages da curva foram reimportadas do bronze (versão 2 da leitura); o Sul em 04/11/2018 tem 23 horas, sem média e sem pico; `carga_pico_diario.csv` publica a linha com células vazias e `horas = 23`; teste com as linhas reais. |
| Acumulado do ano sem composição de calendário | Corrigido | `acumulado_ano` publica classes, eventos, feriados em dia útil e `calendario_equivalente` (falso: 186 contra 188 dias úteis). |
| "Mediana" que era o elemento superior | Corrigido | `statistics.median` sobre os valores sem arredondar: 0,0191% (32 revisões); campo `revisoes_com_percentual`; teste com número par de revisões. |
| 29 e 30/04/2023 no regime 3 nos CSVs | Corrigido | Coluna `regime` com `transicao` nesses dias em `carga_horaria.csv` e `carga_pico_diario.csv`; descrição no REGISTRO. |
| Evidências com caminhos de bronze inexistentes | Corrigido | Caminho trocado pela recaptura com o mesmo sha256 quando existe (2023, 2024 e 2025: `ons_carga_diaria_conferencia`, mesmo arquivo); para a captura de 2026 usada (`cdb81418…`), caminho vazio, nota em `filtros` de que o arquivo está indisponível e o atual da fonte é outro (`45c8cd14…`), e `reproducao` dizendo que a conta parte do silver principal. |
| Período do backtest e rótulo da cobertura | Corrigido | Fim do período = último dia previsto (27/09/2026), também em `p027.periodo_avaliacao`; cobertura abaixo da nominal rotulada "ressalva". |
| Teste que repetia a fórmula; reconciliação chamada de independente; faltavam testes | Corrigido | Teste substituído pela comparação com a curva bruta e com a carga líquida publicada pelo ONS; docstring corrigida (a carga diária é o mesmo produto em outro grão); testes de C1, A1 e do horário de verão com arquivos reais. |
| Textos com 29/04/2023 como início da MMGD na carga | Corrigido | Todos os textos e métricas usam "declarada para 29/04/2023, observada nos dados em 01/05/2023"; a limitação do modelo usa o início de treino usado; teste que reprova "desde 29/04/2023" em qualquer texto da gold. |
| "Leitura publicada" interpretativa e "10,5 pontos de log" confundíveis | Corrigido | A frase saiu do documento (a gold nunca a publicou); o texto da decomposição dá a variação da comparação decomposta (+11,06% em 6 dias) e diz que não é a do achado; o texto dos resíduos dá datas e contagem de cada janela. |
| Lei nº 9.093/1995 com `conferida = true` e documento contraditório | Corrigido | `conferida_ementa` e `conferida_texto` separados (texto não conferido em todas, com o motivo); 2.5 e 5.2 corrigidos com os dois PDFs de 0 byte testados em 01/10/2026 06:04 UTC (9.093 e 10.607). |
| Dias sem valor na fonte ausentes do CSV | Corrigido | `carga_diaria.csv` gerado de novo: 2013-12-01, 2014-02-01 e 2015-04-09 com as cinco células vazias; teste no CSV publicado. |
| Natureza ESTIMADO única para a API | Corrigido | `proveniencia.api.natureza = OBSERVADO` com `natureza_por_serie` (MMGD ESTIMADO; líquida OBSERVADO; global OBSERVADO com componente ESTIMADO). |

Nenhum defeito foi refutado.

## 5. Limitações e bloqueios

### 5.1 O que não se pode concluir

* A variação da carga não é atribuída à atividade econômica, nem a contribuição de temperatura é efeito causal ou "parcela explicada".
* A parcela de MMGD dentro da carga diária e da curva não é publicada pelo ONS; a API publica uma MMGD com outro denominador (carga global). Não há como dizer quanto da variação da carga diária vem da MMGD.
* Comparações que atravessam 01/03/2021 ou a inclusão da MMGD (29/04 a 01/05/2023) não são variações.
* O pico da curva desde a inclusão da MMGD (observada em 01/05/2023) inclui MMGD estimada; o pico da carga líquida está na API.
* O acumulado do ano de 2026 compara janelas com composição de calendário diferente (186 contra 188 dias úteis): a variação sai com a marca `calendario_equivalente = false`.

### 5.2 Bloqueios com evidência

* INMET (observação de estação): `https://portal.inmet.gov.br/`, `https://apitempo.inmet.gov.br/estacoes/T`, `https://bdmep.inmet.gov.br/` e `https://portal.inmet.gov.br/uploads/dadoshistoricos/2025.zip` responderam "Empty reply from server" em 30/09/2026 23:0x UTC.
* Open-Meteo (ERA5 e IFS): não é bloqueio, é cota diária de pedidos por endereço, num endereço compartilhado por vários agentes. Respondeu HTTP 429 "Daily API request limit exceeded. Please try again tomorrow." em 30/09/2026 e às 05:5x UTC de 01/10/2026; entre 00:38 e 00:56 UTC de 01/10/2026 respondeu 200 para 15 capitais. Coletado e não utilizado (2.8).
* NOAA GSOD: a lista de estações (`isd-history.csv`) termina em 24/08/2025 e o diretório de 2026 não existe.
* Texto das leis: o Planalto respondeu "Empty reply from server" (30/09/2026 e 01/10/2026 06:03 UTC); os PDFs de publicação do Senado das Leis nº 9.093/1995 e nº 10.607/2002 vieram com 0 byte (HTTP 200, 01/10/2026 06:04 UTC). Os metadados abertos do Senado (norma, ementa, alterações) foram usados, e a gold diz que o texto não foi conferido.
* Bronze das capturas da carga diária de 29 e 30/09/2026 ausente neste ambiente: a conferência "no arquivo original" do valor −668,879 usa o valor gravado no silver e o sha256 da captura, não a releitura do arquivo. Os arquivos de 2023, 2024 e 2025 usados ainda se obtêm idênticos (mesmo sha256) e estão no bronze da família; o de 2026 usado não (a fonte já publicou outro).
* CCEE (403 do WAF): não usada neste módulo.

Alternativa adotada para a temperatura: NASA POWER (reanálise, natureza ESTIMADO) com a regra de 2.4. O módulo Água e clima deve publicar `clima_diario.csv`; quando existir com observação de estação ou ERA5, a temperatura da decomposição deve ser harmonizada (pedido em 6).

## 6. Pedidos ao integrador

1. `src/lib/energia/tipos.ts` (`CargaGold`): acrescentar `validacao?: ValidacaoFisica` (tipo exportado por `tipos-carga.ts`, agora com `registros_esperados`, `ausentes` e a conferência `balanco` de cada ocorrência), campo novo de `carga.json`.
2. `src/lib/energia/gold.ts`: leitor `cargaDetalhe()` para `carga_detalhe.json` (ou uso direto de `lerGold<CargaDetalheGold>("carga_detalhe.json")` na fase de interface).
3. `pipeline/energia/validacoes.py`: incluir `carga_detalhe.json` no horizonte de publicação (`dia_referencia` contra `carga_energia_di`, folga 0; `p026.ultimo_dia` contra a curva).
4. `pipeline/energia/gold/sintese.py` (visão geral): a frase da carga usa a variação nas mesmas datas; sugerir a comparação equivalente de `carga_detalhe.json` e a ressalva do A07 (base de 2025 abaixo do modelo).
5. Módulo Água e clima: combinar a fonte de temperatura. Este módulo usa NASA POWER nas capitais ponderadas pela população; se `clima_diario.csv` trouxer outra fonte, trocar aqui (função `temperaturas` em `carga_detalhe.py`) e refazer o backtest.
6. Módulos Geração e Rede (A11 e A05): na base do ONS, a geração solar do balanço inclui a MMGD desde 29/04/2023, mas a carga (igual à do balanço) só desde 01/05/2023 (ver 4.4); 29 e 30/04/2023 têm geração com MMGD e carga sem ela. Na conferência C1, o balanço de 25/08/2018 do NE mostra lacuna de geração eólica (219,7 MWmed contra cerca de 6.500 nos vizinhos): o módulo Geração deve tratar esse dia como lacuna, não como geração real.
7. Silver da família `ons_carga`: cerca de 590 MB (curva, API, balanço de todos os anos, arquivo atual da carga diária, temperatura). Entra no `energia-silver-familias.tar.gz` do workflow automaticamente; vale conferir o tamanho total do pacote.
8. Catálogo: os conjuntos NASA POWER, IBGE SIDRA 6579 (peso), Senado (leis de feriados), balanço de energia (validação) e Open-Meteo (coletado, não utilizado) entram pelo REGISTRO com `tema` declarado.
9. `src/tests/energia-gold-contrato.test.ts` ("cada dataset integrado na interface existe no catálogo com o mesmo slug e estado de uso") falha em 01/10/2026 porque o catálogo novo publica os cinco estados de evidência ("PUBLICADO" etc.) e o teste ainda espera "UTILIZADO EM INDICADOR" ou "UTILIZADO EM MODELO". Não envolve os conjuntos deste módulo; é ajuste do teste compartilhado ao catálogo novo.
