# Módulo Perdas de energia na distribuição (P055 a P058)

Documento de método do módulo `perdas` (rota `/setor-eletrico/perdas`, família de silver `aneel_distribuicao`, ordem 40). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/perdas.py` |
| Leitura e cálculo (funções puras) | `pipeline/energia/fontes/aneel_perdas.py` |
| Métricas (12 medidas) | `pipeline/energia/metricas/perdas.py` |
| Testes (49, sem rede) | `pipeline/tests/test_energia_perdas.py`, amostras reais em `pipeline/tests/dados/energia_perdas/` |
| Gold | `public/energia/gold/perdas.json` (381 KB) |
| Downloads e leitura sob demanda | `public/energia/series/perdas_*.csv`, `perdas_anual.json`, `perdas_municipios.json`, `perdas_evidencias.json` |
| Tipos | `src/lib/energia/tipos-perdas.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py perdas` (coleta e gold) ou `--sem-coleta` (só gold, a partir do silver). Pico de memória medido: 505 MB no processamento do SAMP (tabela dinâmica agente × mês em memória), abaixo disso nas componentes tarifárias e no cadastro de MMGD (4,66 milhões de linhas), todos lidos do Parquet em lotes a partir de arquivo temporário descomprimido do bronze.

## 1. Painéis e estado

| Painel | Dados | Estado |
| --- | --- | --- |
| P055 Mapa e comparação | Volume, taxa com denominador explícito e série anual de 123 distribuidoras (2003 a 2025, ano aberto de 2026 em acumulado comparável); área desenhada pelos municípios do IBGE ligados à distribuidora pela relação oficial da ANEEL; tabela e comparador alimentados pela mesma gold | Dados concluídos com limitação declarada: não há polígono oficial de concessão acessível (bloqueio na seção 5); a área é o conjunto de municípios inteiros, sem rateio. Página pendente |
| P056 Técnicas e não técnicas | Perdas técnicas (estimativa regulatória publicada no SAMP), não técnicas (total menos técnica), taxas sobre a injetada e não técnica sobre o mercado de baixa tensão medido, resíduo do balanço, reconciliação classificada | Dados concluídos com limitação declarada: a fonte deixou de publicar a separação para cerca de metade das distribuidoras a partir de 2024 (19 de 51 concessionárias em 2025; nenhuma com o acumulado de 2026 completo). Página pendente |
| P057 Realizado e regulatório | Percentual técnico regulatório implícito no SAMP por trecho de vigência (342 trechos, 71 distribuidoras), com a resolução homologatória associada quando o início de vigência cai no mês da troca (78 trechos) | Bloqueado em parte, com evidência: a referência regulatória de perdas não técnicas e a comparação realizado × regulatório não estão em base aberta acessível (seção 5). O que foi entregue não substitui a comparação exigida |
| P058 Custo e contexto social | Custo unitário das perdas na tarifa residencial B1 por processo tarifário (R$/MWh, 3.804 linhas, 115 distribuidoras, vigências de 2012 a 2026) e participação na tarifa; população, área e renda domiciliar per capita do Censo 2022 nos municípios da área; associação descritiva (Spearman) com n | Entregue em parte: custo total reconhecido em reais por processo bloqueado (seção 5); contexto social concluído com limitação declarada. Página pendente |

Nenhum painel está declarado como entrega integral: P057 e o custo total de P058 dependem de acesso que a fonte não oferece a clientes automatizados, e a interface ainda não existe.

## 2. Fontes verificadas (consulta em 30/09/2026)

| Fonte | Recurso usado | URL | Licença | Período e grão | Publicação pela fonte |
| --- | --- | --- | --- | --- | --- |
| ANEEL, SAMP Balanço (S7) | `samp-balanco.parquet` (Parquet oficial; o `samp-balanco.csv` do mesmo pacote foi relido para conferência) | https://dadosabertos.aneel.gov.br/dataset/samp-balanco | ODbL | jan/2003 a ago/2026; agente × mês × linha do balanço, kWh; 549.552 linhas, 156 agentes (123 com balanço de distribuição) | Parquet 15/09/2026 05:01; CSV 15/09/2026 05:01 |
| ANEEL, dicionário do SAMP Balanço | `dm-samp-balanco.pdf`, versão 1.0 de 04/05/2023 | mesmo pacote | ODbL | lista os campos, sem domínio das linhas | 12/06/2026 |
| ANEEL, Componentes Tarifárias (S6, parte aberta) | `componentes-tarifarias-2012.parquet` a `-2026.parquet` e dicionário | https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias | ODbL | vigências de fev/2012 a ago/2026; processo × componente, R$/MWh | 26 e 27/09/2026 |
| ANEEL, Indicadores coletivos de continuidade (limites) | `indicadores-continuidade-coletivos-limite.csv` | https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec | ODbL | conjunto elétrico × ano (usado 2026) | 05/09/2026 |
| ANEEL, IndQual Município | `indqual-municipio.csv` e dicionário | https://dadosabertos.aneel.gov.br/dataset/indqual-municipio | ODbL | conjunto elétrico × município IBGE | 09/09/2026 |
| ANEEL, Relação de empreendimentos de MMGD | `empreendimento-geracao-distribuida.parquet` (só as colunas CNPJ da distribuidora e código do município) | https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida | ODbL | 4,66 milhões de empreendimentos; contagem por distribuidora × município | 29/09/2026 |
| IBGE, Censo 2022 (S23) | API de agregados v3, tabelas 4714 (população, área) e 10295 (moradores em domicílios particulares permanentes ocupados e rendimento nominal médio domiciliar per capita), nível municipal; API de localidades v1 | https://servicodados.ibge.gov.br/api/v3/agregados/4714 e /10295; https://servicodados.ibge.gov.br/api/v1/localidades/municipios | Dados públicos do IBGE, uso livre com citação | 2022, município | a API não informa data de publicação (campo nulo) |
| IBGE, malha municipal | `public/energia/geo/municipios.json` (gerada por `pipeline/energia/geo.py`, revisão 2025) | API de malhas v4 | idem | 5.571 feições | 27/04/2026 (nota de liberação) |
| ANEEL, conceito de perdas (S5) | página | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/perdas-de-energia/perdas-de-energia | página pública | texto | base das definições |

Cada arquivo baixado está no bronze com sha256 (`data/energia/bronze/aneel/...` e `data/energia/bronze/ibge/...`) e vintage no silver `data/energia/silver/aneel_distribuicao.db`. Política de recoleta: SAMP e componentes a cada 7 dias, relação municipal e MMGD a cada 30 dias, IBGE a cada 365 dias; arquivo idêntico não vira vintage nova. O processamento bronze para silver tem versão por conjunto (`VERSAO_PROCESSAMENTO`): quando a leitura muda, a mesma vintage é reprocessada e só valores novos entram. Conferência de 30/09/2026: o silver do SAMP coincide observação a observação (216.919) com um reprocessamento do bronze pelo código atual.

A API do IBGE responde com `Content-Encoding: gzip` e o download grava o corpo como veio; o módulo abre essa camada na leitura (`aneel_perdas.descomprime_camadas`), sem alterar o bronze.

## 3. Método

### 3.1 Linhas do SAMP Balanço usadas

O dicionário não traz o domínio das linhas; os rótulos foram lidos do arquivo e conferidos pela identidade do balanço.

| Grandeza | Linha do SAMP |
| --- | --- |
| Perdas totais medidas | `Perdas na Distribuição (valor medido)` / `Perdas Totais` / `Energia Calculada (kWh)` |
| Perdas técnicas | `Perdas Técnicas` (medido; o faturado só preenche quando o medido falta, e os dois são iguais porque a técnica é estimada) |
| Perdas não técnicas | `Perdas Não-Técnicas` (medido) |
| Perdas totais faturadas | `Perdas na Distribuição (valor faturado)` / `Perdas Totais` (só no CSV, para comparação) |
| Linha antiga | `Perdas` / `Perdas Totais`: base não identificável (CERAL Anitápolis 2009 a 2023, CERR até 2016); fica em coluna própria e nunca entra na série medida |
| Energia injetada | `Energia Injetada Total`: linha TOTAL (leiaute antigo), linha `Total (todos os níveis de tensão)` (leiaute de 2024) ou soma dos níveis |
| Energia fornecida medida | cativo, consumo próprio, suprimento, mercado livre e uso por outras distribuidoras (`Energia Medida`), nas mesmas três representações |
| Cobrança por procedimento irregular | `Energia associada à cobrança por procedimento irregular` (`Energia Faturada`) |
| Mercado de baixa tensão medido | linhas `Energia Medida (kWh) - BT (Menor que 2,3 kV)` de cativo, consumo próprio e mercado livre |

Identidade verificada: perdas medidas = injetada − fornecida medida − outros requisitos antigos − irregular. Exemplo: CEMIG-D, jun/2023, 4.586.352.923 − (2.204.773.465 + 2.207.037 + 1.930.724.152 + 27.499.275) − 15.750.000 = 405.398.994 kWh, exatamente a linha publicada.

Escolha entre representações de uma grandeza: vale a que concorda com a soma dos níveis de tensão do mesmo mês; sem níveis, a linha do leiaute novo tem precedência. Divergência não arbitrada pelos níveis é confirmada quando o balanço do mês fecha com a escolha (a perda que a fonte calculou concorda); a que nenhuma das duas confirma fica aberta e gera o alerta `representacoes_conflitantes` (COCEL, fev/2026: linha de todos os níveis 981.016 kWh contra linha TOTAL 33.132.240 kWh).

### 3.2 Denominadores e fórmulas

* Taxa de perdas totais = 100 × Σ perdas totais medidas ÷ Σ energia injetada de referência.
* Energia injetada de referência: no leiaute antigo, a linha publicada; no leiaute da REN 1.003/2022 (a partir de 2024), a energia implícita no cálculo da própria fonte, fornecida + irregular + perdas totais, porque a linha publicada passou a ser bruta (inclui geração conectada à rede que o cálculo de perdas não usa; CEMIG-D 2025: resíduo de 10,4% da injetada publicada). A origem aparece em cada linha (`publicada`, `requerida`, `mista`).
* Taxa técnica = 100 × Σ técnicas ÷ Σ injetada de referência, só sobre quem publica a técnica nos 12 meses; a cobertura (em % da injetada) vai ao lado.
* Não técnica sobre BT = 100 × Σ não técnicas medidas ÷ Σ mercado BT medido (a base que a ANEEL usa na regulação, medida desde 2025). Não técnica sobre a injetada também é publicada, para que técnica + não técnica = total no mesmo denominador. Nunca se somam percentuais de bases diferentes.
* Agregados (Brasil, concessionárias, permissionárias): 100 × Σ numeradores ÷ Σ denominadores das distribuidoras com os 12 meses e sem alerta; excluídas contadas por motivo.
* Resíduo = injetada publicada − fornecida − outros − irregular − perdas totais; classes `fecha` (até 1 kWh por linha do arquivo), `residuo_pequeno` (até 0,1% da injetada, que não muda a taxa na primeira casa), `residuo_relevante`, `sem_componentes`.
* Ano de referência: último ano civil encerrado com ao menos 90% das distribuidoras completas (2025). Ano aberto (2026): acumulado de janeiro até o último mês publicado sem lacuna por ao menos 90% das distribuidoras válidas no ano de referência (julho), comparado com o mesmo recorte do ano anterior sobre as mesmas distribuidoras (49 concessionárias: 14,77% em 2026 contra 14,74% em 2025).
* Ano com mês faltando: a soma fica sobre os meses publicados, com `meses` e `completo = 0`; não é escalada nem completada, e não entra em agregado nem em comparação.
* Variação anual: pontos percentuais da taxa e variação relativa do volume entre o ano de referência e o anterior, só com os dois anos completos e sem alerta; mudança de escala da injetada acima de 30% é marcada como provável mudança de universo, e troca de leiaute também é marcada.

### 3.3 Referência regulatória e custo

* Percentual técnico regulatório implícito: razão técnica ÷ injetada publicada, arredondada a 0,001 p.p., constante por meses seguidos (mínimo 2). O mês de troca mistura as duas taxas pró-rata dos dias (CEMIG-D, mai/2018: 7,959% = 27 dias a 7,840% e 4 dias a 8,766%, início em 28/05/2018, a vigência da REH 2.396/2018). A REH é associada ao trecho por coincidência de mês; o dia reconstituído fica só no CSV como diagnóstico, porque coincide com o dia da REH apenas nos dois casos da CEMIG-D.
* Custo unitário na tarifa B1: componentes `TUSD_PT`, `TUSD_PNT`, `TUSD_Per_RB_D` e `TE_Per_RB` da tarifa residencial B1 convencional (subclasse residencial, sem detalhe, base econômica e tarifa de aplicação), R$/MWh nominais sem tributos; participação = soma ÷ (TUSD + TE). É o nível reconhecido por MWh, não o custo das perdas reais nem o total em reais; nada é multiplicado por mercado ou tarifa cheia.

### 3.4 Geografia e identidade

* Identidade: CNPJ de 14 dígitos publicado pela própria fonte (`NumCPFCNPJ`); nome e sigla do rótulo mais recente do SAMP. O SAMP rotula meses antigos com o nome atual do CNPJ em alguns casos (o CNPJ da antiga CEEE aparece como CPFL Transmissão de dez/2006 a dez/2016); o nome é o da fonte, a chave é o CNPJ.
* Eventos: mudança de nome, início e fim de série observados no SAMP (RGE termina em mai/2019, quando foi incorporada; o destino não é inferido por nome).
* Área de atuação: municípios ligados à distribuidora por algum conjunto elétrico do ano (limites de continuidade de 2026 dão conjunto → CNPJ; IndQual Município dá conjunto → município IBGE). Cada vínculo é conferido no cadastro de MMGD (há empreendimento da distribuidora no município?). Não confirmado fica marcado, não apagado (192 vínculos; ex.: conjunto Santa Rita da EPB ligado ao código de Santa Rita do Maranhão).
* Municípios da lista do IBGE fora da relação de conjuntos (24): ligados pelo cadastro de MMGD quando a distribuidora tem ao menos 10 empreendimentos e 5% dos do município, com estado próprio (`2`) e fora do contexto social; 23 foram ligados, 1 ficou sem vínculo (Porto Rico do Maranhão, 5 empreendimentos). Código 4314530 da relação não existe no IBGE e fica listado.
* Mapa: `perdas_municipios.json` dá, por código IBGE (o mesmo `id` da malha), o índice da distribuidora e o estado do vínculo (0 relação sem confirmação, 1 confirmada, 2 só MMGD). A cor de cada município é o valor da distribuidora inteira; município compartilhado (440) tem marca própria; nenhum volume ou taxa é distribuído entre municípios.

### 3.5 Contexto social

População, área e renda do Censo 2022 somadas sobre os municípios confirmados (e, ao lado, só os exclusivos, com a cobertura populacional deles). Renda média da área = Σ(renda média per capita × moradores) ÷ Σ moradores, nunca média simples de médias. Associação: Spearman entre essa renda e as taxas de 2022 (ano do Censo) das concessionárias válidas: ρ = −0,452 com a não técnica sobre BT (n = 49) e ρ = −0,644 com a taxa total (n = 51). É descrição entre áreas: não é causa, não descreve cada família e não atribui perdas não técnicas à população.

### 3.6 Evidências ("Comprove este número")

Montadas e validadas por `pipeline/energia/evidencia.py`: taxa nacional, volume nacional, não técnica sobre BT, injetada de 2024 com a reconciliação contra o relatório da ANEEL, acumulado do ano aberto (na gold) e a taxa do ano de referência de cada distribuidora (em `perdas_evidencias.json`, sob demanda). Cada uma traz arquivo do bronze com sha256 e captura, consulta ou chaves de origem, fórmula com numerador e denominador, testes com veredito e comando de reprodução.

## 4. Evidências de aceite (conferências contra a fonte)

| Conferência | Entidade e período | Valor da gold | Valor da fonte (caminho independente) | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| Releitura integral do CSV oficial por código próprio (leitura em fluxo, sem as funções do módulo) | 2.146 agentes-ano com perdas totais em todos os meses publicados | somas da gold | somas do `samp-balanco.csv` | 0 em todos | 1 kWh |
| Idem, perdas técnicas | 1.541 agentes-ano | idem | idem | 0 em todos | 1 kWh |
| Número de linhas | arquivo inteiro | 549.552 no Parquet | 549.552 no CSV | 0 | exata |
| Volume nacional | concessionárias, 2025 (51 de 51) | 90.355.796 MWh; taxa 14,75% | 90.355.796 MWh no CSV | 0 | 1 MWh |
| Perdas totais | CEMIG-D, 2023 | 6.691.132.265 kWh; taxa 11,481% sobre 58.278.685.296 kWh | soma das 12 linhas do CSV | 0 | exata |
| Técnica e não técnica | CEMIG-D, 2023 | 4.843.305.434 e 1.847.826.833 kWh; PNT/BT 8,28% | linhas do CSV; técnica + não técnica = total + 2 kWh | 2 kWh (arredondamento mensal da fonte) | 1 kWh por mês |
| Identidade do balanço | CEMIG-D, jun/2023 | resíduo 0 | 405.398.994 kWh publicado | 0 | 1 kWh por linha |
| Leiaute de 2024 | EMT, jun/2025 | injetada de referência 1.194.798.445 kWh; taxa 15,165% | fornecida + irregular + perdas das linhas do CSV; resíduo 276.490.814 kWh publicado | 0 | exata |
| Representação | Sulgipe, nov/2025 | 55.284.970 kWh | linha de todos os níveis = soma dos níveis; linha TOTAL de 1 kWh descartada | 0 | 1 kWh por nível |
| Injetada nacional | concessionárias, 2024 | 605,2 TWh | intervalo implícito no relatório da ANEEL, edição 2025/2024 (44,6 TWh = 7,4% e 40,2 TWh = 6,6%): [604,5; 606,8] TWh | dentro | arredondamento a 0,1 p.p. |
| Percentual técnico e vigência | CEMIG-D, mai/2018 e mai/2023 | 7,959% e 8,669%; trechos 8,766% e 8,014% | REH 2.396/2018 e 3.202/2023, vigência em 28/05 nas componentes tarifárias | dia 28 reconstituído = dia 28 da REH | 0,3 dia |
| Componentes tarifárias | CEMIG-D, REH 3.459/2025 | TUSD_PT 43,2939; TUSD_PNT 16,7210; perdas 7,70% de 840,18 R$/MWh | TUSD = soma das TUSD_* e TE = soma das TE_* nas linhas originais | < 0,01 R$/MWh | 0,01 R$/MWh |
| Acumulado do ano aberto | EFLJC, jan a jul de 2026 e 2025 | 675.133 kWh ÷ 13.957.308 kWh = 4,84%; 733.862 ÷ 14.990.823 = 4,90% | linhas "Total (todos os níveis)" do CSV somadas por código próprio | 0 | exata |
| Mapa | Brasil | 5.570 municípios da malha com vínculo, 1 sem vínculo listado, 1 código inválido listado | malha IBGE revisão 2025 (5.571 feições) | conjuntos idênticos aos listados | exata |
| Área | Eletropaulo (Enel SP); CEMIG-D | 24 municípios confirmados; 776 confirmados de 800 | relação oficial conferida no cadastro de MMGD | | |

Casos de robustez cobertos nos testes: grande (CEMIG-D), pequena (EFLJC), multiestadual (Neoenergia PE em município da Paraíba; Light, Celesc, Elektro e outras com UFs múltiplas na gold), mudança societária (RGE encerrada em mai/2019), valor extremo (Manaus Energia 2006, perda de 111% da injetada, publicada com alerta e fora de agregados; Âmbar Amazonas 43,19% em 2025), ausência (técnica da CEMIG-D em 2025, mercado BT antes de 2010, ano aberto sem separação técnica), zero distinto de ausência (linha nacional de 2026 com soma ausente, não zero).

Testes: `python3 -m unittest pipeline.tests.test_energia_perdas` (49 testes, todos aprovados em 30/09/2026). `npx tsc --noEmit -p .` sem erros.

## 5. Limitações materiais e bloqueios

* Perdas técnicas são estimativa regulatória (percentual da revisão tarifária aplicado à injetada); a não técnica é a diferença e inclui furto, fraude e erros de medição, leitura e faturamento, que a fonte não separa. Pode ser negativa em distribuidoras pequenas.
* Quebra de 2024: leiaute da REN 1.003/2022, injetada publicada bruta e separação técnica publicada para cerca de metade das distribuidoras. Comparações que atravessam 2024 estão marcadas.
* Base medida, não faturada: a taxa total de 2024 (14,74% sobre a injetada, medida) fica acima dos 14,0% do relatório da ANEEL (faturada), porque o faturado inclui custo de disponibilidade e compensação de MMGD.
* 35 agentes-ano com perda total anual negativa e 16 com perda maior que a injetada (quase todos permissionárias pequenas): publicados com alerta no CSV, fora de agregados e comparações.
* 513 agentes-ano completos têm resíduo relevante (a maior parte em 2024 e 2025, pela injetada bruta); o resíduo é publicado e não é atribuído a causa.
* Área por municípios inteiros: municípios atendidos em parte entram inteiros; a renda média esconde a desigualdade interna; o Censo é de 2022.

Bloqueios (tentativas em 30/09/2026, 21h50 e 22h42 UTC):

1. Perda não técnica regulatória e custo total reconhecido em reais por processo (P057, P058). Tentativas: `git.aneel.gov.br/.../Relatorio_Perdas_Energia.pdf`, `calculostarifarios.aneel.gov.br`, `www2.aneel.gov.br/cedoc`, `biblioteca.aneel.gov.br`: HTTP 403 com `cf-mitigated: challenge` (desafio do Cloudflare); `portalrelatorios.aneel.gov.br/luznatarifa/perdasenergias` e `rap.aneel.gov.br` (relatório PerdasDIT, ligado na página S6): conexão encerrada (curl 35). Busca no CKAN da ANEEL por perdas, perdas regulatórias, processo tarifário, revisão tarifária: só SAMP Balanço, Subsídios Tarifários, BDGD, Componentes e Tarifas de aplicação, nenhum com percentual regulatório. A página S5 remete o histórico de perdas não técnicas à página S6, cujos arquivos estão nesses hosts. Uma cópia de terceiro do relatório da ANEEL (edição 2025/2024, sha256 58d6da5b...) traz os valores regulatórios por distribuidora só em figuras, sem tabela; foi usada apenas para conferir o total de 2024. Não contornamos o bloqueio. Dependência: recurso aberto da ANEEL com os percentuais regulatórios homologados por processo, ou liberação de acesso automatizado.
2. Polígono oficial da área de concessão (P055). SIGEL (`sigel.aneel.gov.br`) com conexão encerrada; EPE WebMap sem camada de áreas de distribuição; BDGD traz a entidade ARAT em File Geodatabase por distribuidora e ano (1.012 arquivos), sem leitor no ambiente (GDAL ausente). Alternativa adotada e registrada: área pelos municípios do IBGE ligados pela relação oficial da ANEEL. O que não se pode concluir: limites internos de municípios compartilhados, nem área em km² da concessão.

O que os dados não permitem concluir: que perdas não técnicas sejam furto; que a renda da área cause perdas; que uma distribuidora esteja acima ou abaixo da meta regulatória de perdas não técnicas; que toda perda técnica possa ser eliminada; custo total em reais das perdas de cada distribuidora.

## 6. Pedidos ao integrador

1. `pipeline/common.py` (`http_download`): decodificar `Content-Encoding: gzip` ou registrar a codificação na vintage; hoje o corpo do IBGE fica gravado comprimido e cada módulo precisa abrir a camada extra.
2. `src/lib/energia/evidencia.ts`: `pipeline/energia/evidencia.py` cita o tipo `Evidencia` nesse arquivo, que ainda não existe. `tipos-perdas.ts` define `EvidenciaPerdas` com os mesmos campos; quando o tipo compartilhado existir, basta trocar a importação.
3. Bronze compartilhado entre famílias: Componentes Tarifárias, limites de continuidade, IndQual Município e o cadastro de MMGD também são baixados por outros módulos (conta, qualidade, transição) nas famílias deles; um bronze comum por recurso evitaria downloads repetidos (o de MMGD tem 106 MB).
4. GDAL (ou `pyogrio`) em `pipeline/energia/requirements.txt`, se o observatório quiser o polígono ARAT da BDGD como geometria oficial da concessão; o módulo passaria a desenhar a área pelo polígono e manteria a relação municipal para o contexto.
5. Verbetes do módulo em `src/lib/energia/conteudo/conceitos-perdas.ts` (fase de interface): perdas técnicas, não técnicas, energia injetada, mercado de baixa tensão, percentual regulatório, resíduo do balanço.
