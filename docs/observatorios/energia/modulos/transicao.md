# Módulo Transição e ambiente (P063 e P064)

Rota: `/setor-eletrico/transicao`. Família de silver: `aneel_mmgd` (`data/energia/silver/aneel_mmgd.db`). Ordem no `run.py`: 31.

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/transicao.py` |
| Parser da relação de MMGD (ANEEL) | `pipeline/energia/fontes/aneel_transicao.py` |
| Parser da carga verificada (ONS) | `pipeline/energia/fontes/ons_transicao.py` |
| Parser das planilhas e páginas do MCTI | `pipeline/energia/fontes/mcti_transicao.py` |
| Métricas | `pipeline/energia/metricas/transicao.py` (11 medidas) |
| Testes | `pipeline/tests/test_energia_transicao.py` (37 testes), amostras em `pipeline/tests/dados/energia_transicao/` |
| Gold | `public/energia/gold/transicao.json` (cerca de 305 KB) |
| Downloads | `public/energia/series/transicao_*.csv` e `transicao_municipios.json` |
| Tipos TS | `src/lib/energia/tipos-transicao.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py transicao` (coleta e gold) ou `--sem-coleta` (só gold, 2 s). A coleta completa com o cadastro já importado leva cerca de 1 minuto e ficou abaixo de 100 MB de memória; a importação de um cadastro novo da ANEEL (4,66 milhões de linhas, lidas em lotes de 250 mil) levou 129 s.

## 1. Painéis e estado

| Painel | Estado dos dados (esta fase) | Interface |
| --- | --- | --- |
| P063 MMGD e distribuição territorial | Concluído com limitação declarada. Cadastro completo da ANEEL (4.656.839 empreendimentos, 53.965,6 MW em 29/09/2026) agregado por município × ano × fonte, UF × mês × fonte, distribuidora (CNPJ) × UF × ano, classe, modalidade, porte e tipo de consumidor, com população do IBGE para as razões por habitante. Estimativa de MMGD do ONS publicada em bloco separado, com a relação documentada e nunca somada ao cadastro. Limitações: capacidade cadastrada não é energia; os 6 meses mais recentes são provisórios (registro tardio); o controle de revisão entre capturas só mede algo a partir da segunda captura do cadastro (há uma integrada). | Não iniciada (fase 2). |
| P064 Emissões | Concluído com limitação declarada. Fator médio oficial do MCTI mensal (jan/2006 a ago/2026) e anual (2006 a 2025), em tCO2/MWh, só CO2; margens do MDL (operação por despacho, diária e mensal; construção, anual; operação pelo método simples ajustado, anual) em séries separadas; quebra de jan/2025 declarada pela fonte e vista no dado. Nenhuma intensidade municipal ou horária; nenhuma estimativa própria publicada. Limitação: a página do MCTI às vezes responde com desafio de verificação humana, que não é contornado. | Não iniciada (fase 2). |

## 2. Fontes verificadas (consulta em 30/09/2026)

### 2.1 ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída

* Conjunto: https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida (CKAN `package_show` conferido em 30/09/2026; metadados modificados em 29/09/2026 12:12).
* Licença: Licença Aberta para Bases de Dados (ODbL) do Open Data Commons (`odc-odbl`).
* Recurso integrado: `empreendimento-geracao-distribuida.parquet`, https://dadosabertos.aneel.gov.br/dataset/5e0fafd2-21b9-4d5b-b622-40438d40aba2/resource/cd29f6eb-e08d-4db7-b6fb-ed6e3b682d27/download/empreendimento-geracao-distribuida.parquet (106.186.573 bytes; `last_modified` 29/09/2026 12:07; capturado em 30/09/2026 22:22 UTC; sha256 `8d53e3da748a1f44…`; `DatGeracaoConjuntoDados` = 2026-09-29 em todas as linhas). O Parquet é o mesmo conteúdo do CSV oficial do conjunto (ver 4.1) e é lido em lotes de 250 mil linhas, só com as colunas usadas; colunas de dado pessoal (CPF/CNPJ do titular, CEP, nome) não são lidas, salvo o CPF/CNPJ tarjado e o CEP no controle de duplicidade, feito no motor do pyarrow.
* Dicionário: `dm-geracao-distribuida-relacao-de-empreendimentos.pdf`, versão 2.3 de 17/11/2025 (capturado no bronze, sha256 `416dbfe47b428e08…`). Declara frequência "Mensal"; o CKAN declara "Diária" (o arquivo é regerado todo dia). Cobertura declarada: a partir de dezembro de 2008; nacional.
* Recurso de controle: `empreendimento-gd-informacoes-tecnicas-fotovoltaica.parquet` (mesmo conjunto; 110.313.777 bytes; sha256 `c5d9132d41f1f407…`), só para conferir que a data do registro é a data de conexão.
* Grão: um registro por empreendimento (código `CodEmpreendimento`), com município (código IBGE), UF, distribuidora (CNPJ), classe, subgrupo, tipo de consumidor, modalidade, quantidade de UCs que recebem crédito, tipo e fonte de geração, porte, potência instalada (kW) e data.
* Revisões e quebras declaradas pela fonte: atualização suspensa de 23/09/2025 a 13/11/2025 na migração do SISGD para o sistema MMGD, com inserção mais lenta nos meses seguintes (nota do conjunto). O cadastro é o vigente: unidades excluídas somem do histórico.
* Recoleta: a cada 30 dias (o arquivo muda todo dia; baixar 106 MB por dia não muda a análise mensal); recurso técnico a cada 90 dias. Nova captura importada gera revisões medidas por mês de conexão (`mmgd.revisoes`) e zeros explícitos para combinações que saíram do cadastro.

### 2.2 ONS, Carga de Energia Verificada (parcela de MMGD)

* Conjunto: https://dados.ons.org.br/dataset/carga-energia-verificada; dicionário v1.1 (30/10/2023). O CKAN não publica arquivos: aponta para a API `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=&dat_fim=&cod_areacarga=`.
* Licença: Creative Commons Atribuição (CC-BY), conforme o portal do ONS.
* Campos: `val_cargammgd` ("Carga atendida por MMGD em MWmed integralizada no final do intervalo da semi-hora"), `val_cargaglobal`, `val_cargaglobalsmmgd`, por área de carga do tipo submercado (SECO, S, NE, N).
* Coleta mensal por área (a API corta respostas longas): 372 pedidos de jan/2019 a set/2026, capturados em 30/09/2026 entre 22:24 e 22:28 UTC. Meses recentes recolhidos a cada 20 h; meses antigos a cada 30 dias (o ONS revisa o histórico).
* Período com valor: 15/02/2019 a 29/09/2026 (antes de 15/02/2019 o campo vem vazio, `"val_cargammgd": ,`, JSON inválido que o parser lê como ausência). O dia da captura (30/09) vem com as 48 meias horas e carga zero nas horas futuras: é descartado como dia não verificado.
* Natureza: ESTIMADO pela fonte (a MMGD não é supervisionada pelo ONS).

### 2.3 ONS, documentos sobre a incorporação da MMGD (achado A11)

* Página Energia Agora, Balanço de Energia (https://www.ons.org.br/paginas/energia-agora/balanco-de-energia), texto conferido em 30/09/2026: "A partir de 29/04/2023, o valor estimado da micro e minigeração distribuída (MMGD) também passou a incorporar os dados de geração e carga apresentados nesta página."
* Notícia de 28/04/2023 (https://www.ons.org.br/Paginas/Noticias/20230428-Proje%C3%A7%C3%B5es-do-PMO-passam-a-incorporar-a-carga-da-MMGD.aspx): "O boletim do Programa Mensal de Operação (PMO), a partir da semana operativa entre os dias 29 de abril e 05 de maio, passa a incorporar, nas análises de carga, os montantes de geração da Micro e Minigeração Distribuída (MMGD)."
* Balanço de Energia nos Subsistemas, silver principal `energia.db` (dataset `balanco_energia_subsistema_ho`, série `solar.SIN`), só leitura, para ver a quebra no dado.

### 2.4 IBGE, Estimativas de população (SIDRA 6579)

* https://apisidra.ibge.gov.br/values/t/6579/n1/all/n3/all/n6/all/v/9324/p/last%201 (tabela https://sidra.ibge.gov.br/tabela/6579), variável 9324, último ano publicado (2026, data de referência 1º de julho). Capturado em 30/09/2026 22:20 UTC (sha256 `546898d937a10373…`). Uso livre com citação.
* Uso: denominador das razões por habitante e cadastro de 5.571 municípios (código de 7 dígitos, nome, UF). Brasil: 214.211.951.

### 2.5 MCTI, Fatores de emissão de CO2 da geração de energia elétrica no SIN

* Página vigente: https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/sirene/dados-e-ferramentas/fatores-de-emissao. Sem licença declarada; informação pública de órgão federal, citada como fonte.
* Listagem capturada em 30/09/2026 22:48 UTC (HTML no bronze, registro `pagina_atual` em `mcti_fator_emissao_meta`): 23 planilhas em âncoras visíveis e 13 âncoras sem texto, invisíveis ao leitor, apontando para versões antigas (entre elas `Despacho_2021_jan-a-jun.xlsx`, o primeiro semestre de 2021 superado pelo ano completo). Só as visíveis são lidas.
  * Fator médio (inventários): `Inventario_2026_janago.xlsx` ("Inventários Corporativos - 2026"; sha256 `ab369a41bb8d8651…`), com todos os meses de jan/2006 a ago/2026 e o anual de 2006 a 2025.
  * Margem de operação (análise de despacho, mensal, diária e horária) e margem de construção: uma planilha por ano-base, de 2006 a 2026, com o título da linha anotando correções (ex.: "Ano Base 2024 – com correções nos meses de janeiro e março a setembro"). As de 2022 e 2023 se chamam `Margemdeconstruo_<ano>corrigido.xlsx` e têm as duas margens.
  * Método simples ajustado: `FE_simplesajustado_2025_web.xlsx`, anual de 2006 a 2025, com a energia despachada (MWh).
  * Nota técnica `NT_FE_jun25.pdf` (https://www.gov.br/mcti/pt-br/acompanhe-o-mcti/cgcl/paginas/NT_FE_jun25.pdf, sha256 `a6ca97b54a667ee9…`), texto extraído com pdftotext e conferido: a partir de janeiro de 2025 a base de usinas do ONS foi ampliada (termelétricas a biomassa, conjuntos de usinas solares e eólicas, de emissão nula), com a metodologia mantida para MDL e inventários, "o que, consequentemente, pode resultar em uma redução nos valores dos fatores de emissão".
* Site institucional anterior do MCTI (antigo.mctic.gov.br, páginas `emissao_corporativos.html`, `emissao_despacho.html` e `emissao_ajustado.html`): planilhas de 2006 a 2021 e a tabela HTML do método simples ajustado. Recolhido para comparação; só preenche período sem valor na página vigente (nenhum, em 30/09/2026).
* Acesso: a página vigente às vezes responde com desafio de verificação humana ("This question is for testing whether you are a human visitor"). Evidências: amostra `mcti_desafio_waf_recorte.html` (support ID 11080339514068322584, capturada pelo agente anterior) e pedido manual com o cliente curl em 30/09/2026 22:40 UTC (support ID 13061729978711597023). O coletor do pipeline, com a sua própria identificação (`ObservatorioBrasileiroDeCredito/0.1`, sem se passar por navegador), recebeu a página às 22:28, 22:41 e 22:48 UTC. O desafio não é contornado: a tentativa fica em `coletas` e vale a última captura válida.
* Frequência: fator médio e margem de operação mensais; margem de construção e simples ajustado anuais (nota técnica).

### 2.6 Alternativas consideradas e não usadas

* CSV oficial da relação de MMGD (`empreendimento-geracao-distribuida.zip`, 110.911.614 bytes, sha256 `e516f66fd3ae0211…`, com o CSV de 1.530.101.149 bytes): baixado uma vez em 30/09/2026 só para a reconciliação independente (seção 4.1), não integrado, por ser o mesmo conteúdo do Parquet em formato mais pesado.
* Estimativa própria de emissões pela geração térmica do ONS por combustível: não publicada. Exigiria consumo específico e combustível de cada usina, não publicados de forma estruturada; a incerteza seria maior que a diferença entre anos e não substituiria o fator oficial.
* Intensidade de emissão municipal ou horária: não existe fonte oficial; o fator é nacional (SIN) e mensal, e nenhum valor local foi derivado dele.

## 3. Método

### 3.1 MMGD (ANEEL)

* Unidades = número de empreendimentos (códigos distintos; repetição de código derruba a publicação). Potência = soma de `MdaPotenciaInstaladaKW` (capacidade cadastrada em kW, MW nas tabelas); nunca energia.
* Data: `DthAtualizaCadastralEmpreend`. O dicionário a descreve como "data da última atualização cadastral", mas a descrição do conjunto lista a "data da conexão" entre as variáveis e não há outro campo de data. Conferência: nos 4.655.916 empreendimentos solares, a data coincide com `DatConexao` ("Data da conexão da Unidade Geradora") do recurso técnico em 100% dos casos, e a potência também. Datas-sentinela (ano 1900, 46 registros) entram no estoque sem ano de conexão.
* Território: município pelo código IBGE publicado; UF pelos dois primeiros dígitos do código do município. Código de 6 dígitos é completado só quando um único município IBGE tem aquele prefixo (1 caso: 431780 → 4317806, Santo Augusto/RS). Nenhum vínculo por nome.
* Distribuidora: CNPJ de 14 dígitos (`entidades.cnpj`; o Parquet traz o CNPJ como inteiro, sem zeros à esquerda). Sigla e nome são atributos, nunca chave.
* Fonte: `SigTipoGeracao` agrupado em solar (UFV), termelétrica (UTE), hidráulica (CGH, PCH, UHE), eólica (EOL), outra e não informada (157 registros sem tipo).
* Por habitante: W/hab = Σ kW × 1000 ÷ população estimada; unidades por mil habitantes = Σ unidades × 1000 ÷ população. Razão de somas no território; município sem população fica sem razão (nunca zero). Rankings municipais só com população de pelo menos 100 mil.
* Crescimento no ano de referência (último ano completo antes da data do cadastro, 2025): 100 × kW conectados no ano ÷ kW conectados até 31/12 do ano anterior; estoque anterior zero = ausente.
* Provisório: os 6 meses anteriores à data do cadastro (abr a set/2026) ficam marcados; no dado, as conexões mensais caem de 862 MW (abr/2026) para 24 MW (ago/2026), o registro tardio que a ANEEL descreve.
* Duplicidade candidata: grupos com todos os atributos observáveis iguais (distribuidora, município, CEP, data, potência, classe, CPF/CNPJ tarjado, modalidade) e códigos distintos: 46.542 grupos, 49.107 unidades a mais (1,05%), 1.607,5 MW. Medida e publicada, não removida (CPF e CEP de pessoa física vêm tarjados; unidades iguais do mesmo titular podem ser legítimas).
* Silver: agregados no grão publicado em `observacoes` (referência composta `entidade|período|fonte`), controles do arquivo como série `controle.*`, nomes de distribuidora em `registros`. O arquivo original fica no bronze com sha256.

### 3.2 Estimativa de MMGD do ONS e relação com o cadastro

* Energia de cada meia hora = valor × 0,5 h. MWmed do período = Σ MWh ÷ horas cobertas (nunca média de médias). SIN = soma dos quatro submercados nos dias em que os quatro têm as 24 horas. Participação = 100 × Σ MWh de MMGD ÷ Σ MWh da carga global, mesmos intervalos.
* Cadastro e estimativa são grandezas diferentes (capacidade em MW; energia estimada em MWmed; Brasil inteiro no cadastro; só SIN no ONS). Aparecem lado a lado e nunca são somadas. A única relação calculada é a razão rotulada `razao_estimativa_ons_capacidade_pct` = 100 × MWmed estimado (SIN) ÷ capacidade cadastrada média do mês (Brasil), só em mês completo do ONS e não provisório no cadastro. Não é fator de capacidade: herda as limitações das duas fontes e o descasamento de perímetro.
* Achado A11: o ONS declara (seção 2.3) que a estimativa de MMGD passou a compor geração e carga do Balanço de Energia a partir de 29/04/2023. No dado do balanço (silver principal), a solar do SIN vai de 1.991 MWmed em 28/04/2023 para 4.377 MWmed em 29/04/2023 (degrau de 2.386 MWmed); média de 1.924 MWmed nos 7 dias anteriores e 4.817 MWmed de 29/04 a 06/05. A estimativa de MMGD da API de carga verificada, como publicada hoje, é 3.528 MWmed em 29/04/2023. A metodologia está confirmada pela fonte primária; o degrau não é igual à estimativa da API porque são processos diferentes do ONS (programação com previsão meteorológica e dado verificado e revisado), e a comparação mostra ordem de grandeza, não identidade. O detalhe dia a dia está em `ons_mmgd.conferencia_quebra_2023`.

### 3.3 Fatores de emissão (MCTI)

* Valores lidos das planilhas oficiais sem alteração (4 casas na gold e nos CSV). XLSX lido com a biblioteca padrão (zip e XML). O parser procura rótulos e nomes de mês (o leiaute muda por ano); coluna de mês rotulada errada em bloco contíguo é lida pela posição e registrada (2015 e 2016: coluna de julho rotulada "Maio"); dia inexistente no calendário, preenchido com 0 na planilha, é descartado, nunca lido como fator zero (9 casos).
* Séries separadas, que não se substituem: fator médio mensal e anual (inventários); margem de operação por despacho mensal e diária, margem de construção anual e margem de operação pelo método simples ajustado anual (MDL). Só CO2 (tCO2/MWh), como a fonte publica; nada é convertido em CO2e.
* Precedência: página vigente e capturas depositadas por pessoa (a mais recente) antes do site anterior; divergências entre as duas publicações ficam em `divergencias_entre_publicacoes` (4 em 30/09/2026); arquivos da mesma origem com valores diferentes para o mesmo período ficam em `conflitos_entre_arquivos` (nenhum em 30/09/2026).
* Revisões declaradas pela fonte (colunas "Publicação anterior (com erro)" e notas): 11, publicadas com valor anterior e corrigido. Exemplo: julho/2022 da margem de operação publicado antes como 0,0419 e corrigido para 0,4186.
* Quebra de jan/2025 (fonte: nota técnica): marcada em todas as séries; no dado, a energia despachada do método simples ajustado passa de 459.811.225 MWh (2024) para 596.828.023 MWh (2025), +29,8%, sinal da base ampliada.

## 4. Evidências de aceite (conferidas em 30/09/2026)

### 4.1 MMGD contra o CSV oficial (caminho independente)

CSV oficial do mesmo conjunto (seção 2.6) lido em fluxo com o módulo `csv` e somas em `Decimal` com vírgula decimal, sem nenhum código do módulo. Tolerância: zero unidade e 0,001 MW (a gold arredonda MW em 3 casas).

| Entidade | CSV oficial (unidades; kW ou MW) | Gold | Diferença |
| --- | --- | --- | --- |
| Brasil | 4.656.839; 53.965.592,59 kW | 4.656.839; 53.965.592,59 kW | 0 |
| SP | 787.146; 7.610,300 MW | 787.146; 7.610,300 MW | 0 |
| MG | 484.962; 6.469,487 MW | 484.962; 6.469,487 MW | 0 |
| RS | 431.430; 3.989,356 MW | 431.430; 3.989,356 MW | 0 |
| BA | 327.547; 2.975,043 MW | 327.547; 2.975,043 MW | 0 |
| DF | 35.996; 589,889 MW | 35.996; 589,889 MW | 0 |
| RR | 8.897; 121,296 MW | 8.897; 121,296 MW | 0 |
| Conexões em 2025 | 909.965; 9.633,532 MW | 909.965; 9.633,532 MW | 0 |
| Conexões em 2024 | 916.439; 10.671,648 MW | 916.439; 10.671,648 MW | 0 |
| Conexões em 2026 (parcial) | 470.297; 4.432,844 MW | 470.297; 4.432,844 MW | 0 |
| Data sentinela (1900) | 46; 743,18 kW | 46 sem data; 743,18 kW | 0 |
| Solar (UFV) | 4.655.916; 53.650.942,79 kW | 4.655.916; 53.650,943 MW | 0 |
| Termelétrica (UTE) | 594; 202.322,06 kW | 594; 202,322 MW | 0 |

### 4.2 MMGD contra o Parquet lido por outro código

Agregação no motor do pyarrow (`group_by`), sobre o Parquet do bronze, comparada ao CSV municipal e à gold:

| Entidade | Parquet (unidades; kW) | Gold ou CSV | Diferença |
| --- | --- | --- | --- |
| Uberlândia (3170206) | 22.944; 211.725,81 | 22.944; 211.725,81 | 0 |
| Cuiabá (5103403) | 44.800; 503.795,26 | 44.800; 503.795,26 | 0 |
| São Paulo (3550308) | 25.575; 257.930,00 | 25.575; 257.930,00 | 0 |
| Boa Vista (1400100) | 7.773; 108.003,82 | 7.773; 108.003,82 | 0 |
| Porto Alegre (4314902) | 13.745; 132.779,28 | 13.745; 132.779,28 | 0 |
| Teresina (2211001) | 38.239; 367.805,82 | 38.239; 367.805,82 | 0 |
| COPEL-DIS (04368898000106) | 329.727; 6.821,548 MW | 329.727; 6.821,548 MW | 0 |
| CEMIG-D (06981180000116) | 426.729; 5.840,078 MW | 426.729; 5.840,078 MW | 0 |
| EMT (03467321000199) | 239.053; 3.182,399 MW | 239.053; 3.182,399 MW | 0 |
| CODESAM (11810343000138), pequena | 20; 332,07 | 20; 0,332 MW | 0 |

RS pelo prefixo do código no Parquet dá 431.429 unidades, uma a menos que a gold: é o registro com código de 6 dígitos (431780) completado para Santo Augusto/RS, que o prefixo numérico não alcança. A diferença é explicada e esperada.

Recurso técnico fotovoltaico: 4.655.916 de 4.655.916 empreendimentos solares da relação encontrados pelo código, todos com a mesma data de conexão e a mesma potência (tolerância 0,005 kW, o centésimo publicado).

### 4.3 ONS

* Dia 15/08/2026, releitura do JSON bruto do bronze com expressão regular e `Decimal` (sem o parser do módulo): SE 110.784,74445 MWh (CSV diário 110.784,7), S 32.927,0365 (32.927,0), NE 50.117,5161 (50.117,5), N 23.190,1828 (23.190,2); 48 meias horas em cada; SIN 9.042,48 MWmed. Tolerância 0,05 MWh (arredondamento de uma casa no CSV).
* Identidade publicada pelo ONS (carga global = carga sem MMGD + MMGD), dia a dia por submercado: 11.132 de 11.132 dias fecham com tolerância de 0,1 MWh por dia.
* Último mês completo (ago/2026): 8.967,9 MWmed de MMGD estimada no SIN, 10,80% da carga global. Ano de 2025: 7.695 MWmed, 67,41 TWh, 9,45% da carga global. Razão com a capacidade cadastrada: 19,6% (dez/2025), 19,8% (jan/2026), 17,7% (mar/2026); ausente de abr/2026 em diante (cadastro provisório).

### 4.4 MCTI

* Leitura independente do XML da planilha `Inventario_2026_janago.xlsx` por expressão regular: anual de 2025 = 0,0461 (célula O99) e agosto de 2026 = 0,0471 (célula J105), iguais à gold.
* Controle de leitura do anual: anual publicado comparado à média simples dos 12 meses publicados, tolerância 0,0001 tCO2/MWh (arredondamento da quarta casa nos meses e no anual). 19 dos 20 anos ficam dentro; 2007 fica fora por 0,000125 (anual 0,0293; média dos meses 0,029175) e é publicado como ressalva, sem ajuste.
* Valor atípico conferido no original: margem de construção de 2017 = 0,0028 tCO2/MWh (célula G4, gravada como 2.8E-3 na planilha do ano-base 2017), mantida como publicada.
* Divergências entre a página vigente e o site anterior (vale a vigente): fator médio anual de 2021 (0,1263 × 0,1264), fator médio de nov/2021 (0,1474 × 0,1484), margem de operação diária de 31/12/2021 (0,5778 × 0,5500) e simples ajustado de 2019 (0,3896 × 0,386; a nota da fonte registra revisão em agosto de 2020).
* Consistência interna da margem de operação: média simples dos fatores diários × fator mensal publicado, maior diferença 0,0071 tCO2/MWh (fev/2024), em 248 meses; o mensal oficial é ponderado pela geração horária.

### 4.5 Testes automatizados

`python3 -m unittest pipeline.tests.test_energia_transicao`: 37 testes, todos aprovados em 30/09/2026. Cobrem: agregados iguais entre o Parquet e o CSV oficiais (amostra real de 274 linhas); distribuidora pequena (CODESAM, 20 unidades e 332,07 kW) e multiestadual (CERES em MG e RJ) contra somas do CSV completo; identidade pelo CNPJ (Âmbar Amazonas com o CNPJ da antiga Amazonas Energia); data sentinela; código de município de 6 dígitos só com prefixo único; potência ausente distinta de zero; valor extremo de minigeração mantido; duplicidade candidata medida sem remover; energia do ONS contra o texto bruto; campo vazio de 2018 como ausência; dia em curso descartado; razão bloqueada em mês provisório; população de Roraima igual à soma dos municípios; planilhas do MCTI de 2015 (mês rotulado errado), 2020 e 2022 (revisões declaradas), 2021 (29/02 inexistente), inventário 2026 e simples ajustado 2025; âncoras invisíveis e comentários HTML ignorados; listagem nova só quando muda; precedência da página vigente e conflito entre arquivos; evidências válidas pelo contrato de `pipeline/energia/evidencia.py`; revisão quando unidades somem entre capturas; validação crítica vira stub; equivalência entre gold e CSV.

## 5. Limitações materiais e o que não se pode concluir

* Capacidade cadastrada (kW, MW) não é energia gerada. Não há geração de MMGD por município ou por unidade em fonte pública; a estimativa de energia do ONS é por submercado e SIN.
* O cadastro é o vigente: unidades desativadas não aparecem no histórico, e a série por ano de conexão é das unidades que continuam cadastradas. Meses recentes são provisórios.
* O local é o município da unidade com geração; no autoconsumo remoto (1.105.104 unidades, 13.851 MW) o crédito é usado em outras unidades, possivelmente em outro município.
* Potência por habitante relaciona território, não renda: nada permite inferir renda ou perfil de um beneficiário.
* Há unidades de uma distribuidora em UFs fora da sua área usual (ex.: 880 da COELBA fora da Bahia, 913 da Neoenergia PE fora de Pernambuco), além das multiestaduais legítimas (ELEKTRO em SP e MS, EMR em MG e RJ). Podem ser erro de código de município na fonte; o módulo não corrige e publica a distribuição por UF de cada distribuidora.
* A estimativa de MMGD do ONS é modelo, não medição, e o ONS revisa o histórico. A razão com o cadastro compara perímetros diferentes (SIN × Brasil) e não é fator de capacidade.
* Fator médio não é fator marginal: não mede o efeito de consumir ou economizar um MWh. Fatores do MDL servem só a projetos de MDL. Só CO2, emissões da operação das usinas; não é CO2e nem ciclo de vida. Perímetro: geração no SIN; perdas não são tratadas à parte pela fonte.
* Comparações que atravessam jan/2025 misturam bases de usinas diferentes (quebra declarada pelo MCTI).
* Não existe intensidade de emissão municipal nem horária oficial, e nenhuma foi derivada.

## 6. Pedidos ao integrador

1. **Tipo de evidência compartilhado.** `tipos-transicao.ts` define `EvidenciaTransicao` espelhando `pipeline/energia/evidencia.py` (`CAMPOS`), porque `src/lib/energia/evidencia.ts` ainda não existe. Quando existir, trocar por um alias do tipo `Evidencia` compartilhado.
2. **Achado A11 nos módulos de geração e carga.** A metodologia está confirmada pela fonte primária (seção 2.3) e a quebra aparece no dado (degrau de 2.386 MWmed na solar do SIN em 29/04/2023). Os donos de `gold/geracao.py` e `gold/carga.py` devem marcar a quebra em 29/04/2023 nas séries de solar e carga, e não comparar períodos antes e depois sem rótulo. A evidência dia a dia está em `transicao.json`, `ons_mmgd.conferencia_quebra_2023`.
3. **Download duplicado do cadastro de MMGD.** O módulo de perdas baixa o mesmo Parquet da ANEEL para `data/energia/bronze/aneel/aneel_mmgd_municipio` (77 MB repetidos no bronze). Pode ler os agregados por município do silver `aneel_mmgd` (série `qtd.mun_ano_fonte` e `kw.mun_ano_fonte`) ou do CSV `transicao_mmgd_municipio_ano_fonte.csv`.
4. **Navegação e matriz.** Na fase de interface, incluir `/setor-eletrico/transicao` em `navegacao.ts` e atualizar P063 e P064 em `MATRIZ_PAINEIS.md` e `status_paineis.json` com o estado da seção 1.
5. **Workflow de atualização.** A família `aneel_mmgd` precisa entrar na cópia durável dos silvers (o cadastro importado e as capturas do MCTI e do ONS medem revisões entre execuções).
