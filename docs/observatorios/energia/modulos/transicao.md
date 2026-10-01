# Módulo Transição e ambiente (P063 e P064)

Rota: `/setor-eletrico/transicao`. Família de silver: `aneel_mmgd` (`data/energia/silver/aneel_mmgd.db`). Ordem no `run.py`: 31.

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/transicao.py` |
| Parser da relação de MMGD e dos conjuntos elétricos (ANEEL) | `pipeline/energia/fontes/aneel_transicao.py` |
| Parser da carga verificada (ONS) | `pipeline/energia/fontes/ons_transicao.py` |
| Parser das planilhas e páginas do MCTI | `pipeline/energia/fontes/mcti_transicao.py` |
| Métricas | `pipeline/energia/metricas/transicao.py` (11 medidas) |
| Testes | `pipeline/tests/test_energia_transicao.py` (60 testes), amostras em `pipeline/tests/dados/energia_transicao/` |
| Gold | `public/energia/gold/transicao.json` (cerca de 386 KB) |
| Downloads | `public/energia/series/transicao_*.csv` e `transicao_municipios.json` |
| Tipos TS | `src/lib/energia/tipos-transicao.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py transicao` (coleta e gold) ou `--sem-coleta` (só gold, 2 s, pico de 127 MB). A coleta com o cadastro já importado leva cerca de 1 minuto, com pico de 94 MB de memória residente. A importação de um cadastro da ANEEL (4,66 milhões de linhas lidas em lotes de 50 mil; controles de tabela inteira feitos por partes) levou 94 s com pico de 1,06 GB, medido em 30/09/2026; antes da divisão em partes, o pico era 2,59 GB. A reimportação da mesma vintage pela versão 2 da importação (agregado distribuidora × município e datas de conexão), com a coleta dos conjuntos elétricos e a releitura das planilhas do MCTI, levou 128 s com pico de 1,14 GB em 01/10/2026.

## 1. Painéis e estado

| Painel | Estado dos dados (esta fase) | Interface |
| --- | --- | --- |
| P063 MMGD e distribuição territorial | Concluído com limitação declarada. Cadastro completo da ANEEL (4.656.839 empreendimentos, 53.965,6 MW em 29/09/2026) agregado por município × ano × fonte, UF × mês × fonte, distribuidora (CNPJ) × UF × ano, classe, modalidade, porte e tipo de consumidor, com população do IBGE para as razões por habitante. Estimativa de MMGD do ONS publicada em bloco separado, com a relação documentada e nunca somada ao cadastro. Limitações: capacidade cadastrada não é energia; os 6 meses mais recentes são provisórios (conexões ainda podem entrar; a queda dos meses finais não tem causa atribuída); 4.497 unidades (62,9 MW) em 677 municípios estão em UF onde a distribuidora (CNPJ) não tem conjunto elétrico, sinalizadas e não corrigidas; o controle de revisão entre capturas só mede algo a partir da segunda captura do cadastro (há uma integrada). | Não iniciada (fase 2). |
| P064 Emissões | Concluído com limitação declarada. Fator médio oficial do MCTI mensal (jan/2006 a ago/2026) e anual (2006 a 2025), em tCO2/MWh, só CO2; margens do MDL (operação por despacho, diária e mensal; construção, anual; operação pelo método simples ajustado, anual) em séries separadas; quebra de jan/2025 declarada pela fonte e vista no dado; natureza ESTIMADO (estimado pela fonte, publicado sem alteração). Nenhuma intensidade municipal ou horária; nenhuma estimativa própria publicada. Limitação: a página do MCTI às vezes responde com desafio de verificação humana, que não é contornado. | Não iniciada (fase 2). |

## 2. Fontes verificadas (consulta em 30/09/2026)

### 2.1 ANEEL, Relação de empreendimentos de Mini e Micro Geração Distribuída

* Conjunto: https://dadosabertos.aneel.gov.br/dataset/relacao-de-empreendimentos-de-geracao-distribuida (CKAN `package_show` conferido em 30/09/2026; metadados modificados em 29/09/2026 12:12).
* Licença: Licença Aberta para Bases de Dados (ODbL) do Open Data Commons (`odc-odbl`).
* Recurso integrado: `empreendimento-geracao-distribuida.parquet`, https://dadosabertos.aneel.gov.br/dataset/5e0fafd2-21b9-4d5b-b622-40438d40aba2/resource/cd29f6eb-e08d-4db7-b6fb-ed6e3b682d27/download/empreendimento-geracao-distribuida.parquet (106.186.573 bytes; `last_modified` 29/09/2026 12:07; capturado em 30/09/2026 22:22 UTC; sha256 `8d53e3da748a1f44…`; `DatGeracaoConjuntoDados` = 2026-09-29 em todas as linhas). O Parquet é o mesmo conteúdo do CSV oficial do conjunto (ver 4.1) e é lido em lotes de 50 mil linhas (`aneel_transicao.linhas_parquet`), só com as colunas usadas; colunas de dado pessoal (CPF/CNPJ do titular, CEP, nome) não são lidas, salvo o CPF/CNPJ tarjado e o CEP no controle de duplicidade, feito no motor do pyarrow.
* Dicionário: `dm-geracao-distribuida-relacao-de-empreendimentos.pdf`, versão 2.3 de 17/11/2025 (capturado no bronze, sha256 `416dbfe47b428e08…`). Declara frequência "Mensal"; o CKAN declara "Diária" (o arquivo é regerado todo dia). Cobertura declarada: a partir de dezembro de 2008; nacional.
* Recurso de controle: `empreendimento-gd-informacoes-tecnicas-fotovoltaica.parquet` (mesmo conjunto; 110.313.777 bytes; sha256 `c5d9132d41f1f407…`), só para conferir que a data do registro é a data de conexão.
* Período do arquivo: `AnmPeriodoReferencia` = "09/2026" em todas as linhas; datas de conexão válidas de 26/06/2004 a 31/08/2026 (nenhuma conexão em setembro de 2026 no arquivo de 29/09/2026), mais 46 datas sentinela (1900). Lidas pelo pipeline e publicadas em `mmgd.controles.data_conexao_minima`, `data_conexao_maxima` e `periodo_referencia_publicado`.
* Grão: um registro por empreendimento (código `CodEmpreendimento`), com município (código IBGE), UF, distribuidora (CNPJ), classe, subgrupo, tipo de consumidor, modalidade, quantidade de UCs que recebem crédito, tipo e fonte de geração, porte, potência instalada (kW) e data.
* Revisões e quebras declaradas pela fonte: atualização suspensa de 23/09/2025 a 13/11/2025 na migração do SISGD para o sistema MMGD, com inserção mais lenta nos meses seguintes (nota do conjunto). O cadastro é o vigente: unidades excluídas somem do histórico.
* Recoleta: a cada 30 dias (o arquivo muda todo dia; baixar 106 MB por dia não muda a análise mensal); recurso técnico a cada 90 dias. Nova captura importada gera revisões medidas por mês de conexão (`mmgd.revisoes`) e zeros explícitos para combinações que saíram do cadastro.

### 2.1.1 ANEEL, conjuntos elétricos (área de atuação de cada distribuidora, só para sinalizar)

* Limites de continuidade: https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec, recurso `indicadores-continuidade-coletivos-limite` (CSV; `last_modified` 05/09/2026; capturado em 01/10/2026 00:18 UTC; sha256 `3c2738be016fc1c5…`). Campos usados: `NumCNPJ`, `IdeConjUndConsumidoras`, `AnoLimiteQualidade`. 16.311 conjuntos com CNPJ, anos de 1990 a 2032.
* Municípios por conjunto: https://dadosabertos.aneel.gov.br/dataset/indqual-municipio, recurso `indqual-municipio` (CSV; `last_modified` 09/09/2026; capturado em 01/10/2026 00:18 UTC; sha256 `4063c5ba8ddaaabf…`). Campos usados: `IdeConjUnidConsumidoras`, `CodMunicipio`, `SigUF`. 15.162 conjuntos com município.
* Licença: ODbL (portal de dados abertos da ANEEL). Recoleta a cada 90 dias. Silver: `registros` nos datasets `aneel_mmgd_ref_conjuntos_limite` e `aneel_mmgd_ref_conjuntos_municipio` (nomes próprios: o módulo de perdas baixa os mesmos arquivos para outro fim, e o bronze não é dividido).
* Uso: UFs atendidas por cada CNPJ (ver 3.1). Os 103 CNPJs da relação de MMGD têm conjunto na base.

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
* Balanço de Energia nos Subsistemas, silver principal `energia.db` (dataset `balanco_energia_subsistema_ho`, séries `solar.SIN` e `carga.SIN`), só leitura, para ver a quebra no dado. Conferência independente: `BALANCO_ENERGIA_SUBSISTEMA_2023.csv` do bucket público do ONS (https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/balanco_energia_subsistema_ho/BALANCO_ENERGIA_SUBSISTEMA_2023.csv, baixado em 01/10/2026, 4.530.043 bytes), lido com Decimal: solar do SIN 1.991,3 MWmed em 28/04 e 4.376,6 em 29/04/2023; carga 72.888,8 e 68.158,5. As linhas do SIN de 15/04 a 06/05/2023 estão no recorte `ons_balanco_sin_20230415_20230506.csv.gz` dos testes.

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
* Acesso: a página vigente às vezes responde com desafio de verificação humana ("This question is for testing whether you are a human visitor"). Evidências guardadas no repositório: `pipeline/tests/dados/energia_transicao/mcti_desafio_waf_recorte.html` (resposta a um pedido de `Inventario_2026_janjun.xlsx` em 30/09/2026, support ID 11080339514068322584) e `mcti_desafio_waf_pagina_20261001.html` (resposta à própria página a um pedido manual com o cliente curl em 01/10/2026 00:06:34 UTC, HTTP 200, 46.454 bytes, sha256 `07a399f2d9b3146b…`, support ID 11080339521002698785; recorte sem scripts e imagem, com o sha256 da resposta inteira no cabeçalho). O coletor do pipeline, com a sua própria identificação (`ObservatorioBrasileiroDeCredito/0.1`, sem se passar por navegador), recebeu a página em 30/09/2026 22:48:13 UTC e em 01/10/2026 00:18:26 UTC (os dois registros de `pagina_atual` na tabela `coletas` de `aneel_mmgd.db`). O desafio não é contornado: a tentativa fica em `coletas` e, a partir de 01/10/2026, o HTML do desafio vai para o bronze (`mcti_fator_emissao_meta/pagina_atual_desafio`) com o sha256 no detalhe da coleta; vale a última captura válida.
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
* Provisório: os 6 meses anteriores à data do cadastro (abr a set/2026) ficam marcados; no dado, as conexões mensais caem de 862 MW (abr/2026) para 24 MW (ago/2026), e não há conexão em set/2026 (última data de conexão: 31/08/2026). A queda é tratada como provisória, sem causa atribuída: a nota da ANEEL trata da migração de sistema de 23/09 a 13/11/2025, não destes meses, e a magnitude do atraso só será medida comparando capturas (`mmgd.revisoes`).
* Séries com zero explícito: `mmgd.anual` traz todos os anos de 2004 a 2026 (2005 a 2008 com zero conexão), `mmgd.mensal` todos os 268 meses de jun/2004 a set/2026, e `mmgd.uf_anual` todos os anos de cada UF, da primeira conexão ao ano do cadastro. Sem conexão no cadastro completo é zero real, e um gráfico não pode ligar pontos por cima dele.
* Identidade de estoque (validação executada a cada publicação, `mmgd.controles.identidade_estoque`): estoque acumulado com data (série anual e série mensal) + unidades sem data = total do cadastro. Em 29/09/2026: 4.656.793 + 46 = 4.656.839 unidades; 53.964.849,41 + 743,18 = 53.965.592,59 kW (diferença 0; tolerância 0,01 kW, o centésimo publicado). Diferença derruba a publicação (stub).
* Participações: duas casas; abaixo de 0,01% (e diferente de zero), dois algarismos significativos (iluminação pública: 232 unidades = 0,005%; consumo próprio: 45 = 0,00097%).
* Unidades fora da área da distribuidora: a UF de cada unidade (pelo código IBGE do município publicado) é comparada com as UFs dos conjuntos elétricos do CNPJ da distribuidora (2.1.1), em qualquer ano da base, só por CNPJ e código IBGE. UF sem nenhum conjunto daquele CNPJ = unidade sinalizada (provável código de município errado na origem, como em municípios homônimos). Nada é corrigido nem removido: cada município publica `unidades_distribuidora_fora_da_uf` e `potencia_kw_distribuidora_fora_da_uf` (mapa e CSV), cada distribuidora publica as UFs fora da área, e o CSV por distribuidora marca `uf_na_area_da_distribuidora`. CNPJ sem conjunto na base fica sem referência (não sinalizado). Usar todos os anos só reduz sinalizações (ex.: a base liga à Neoenergia PE conjuntos com municípios da PB, do PI e da BA, então unidades dela nessas UFs não são sinalizadas).
* Duplicidade candidata: grupos com todos os atributos observáveis iguais (distribuidora, município, CEP, data, potência, classe, CPF/CNPJ tarjado, modalidade) e códigos distintos: 46.542 grupos, 49.107 unidades a mais (1,05%), 1.607,5 MW. Medida e publicada, não removida (CPF e CEP de pessoa física vêm tarjados; unidades iguais do mesmo titular podem ser legítimas).
* Controles de tabela inteira (código único, duplicidade candidata, concordância com o recurso técnico) rodam por partes exatas: pelo último caractere do código (códigos repetidos caem na mesma parte) e por grupos de distribuidoras inteiras (a chave da duplicidade inclui a distribuidora). A soma das partes é conferida contra o total de linhas.
* Silver: agregados no grão publicado em `observacoes` (referência composta `entidade|período|fonte`), controles do arquivo como série `controle.*`, nomes de distribuidora em `registros`. O arquivo original fica no bronze com sha256.

### 3.2 Estimativa de MMGD do ONS e relação com o cadastro

* Energia de cada meia hora = valor × 0,5 h. MWmed do período = Σ MWh ÷ horas cobertas (nunca média de médias). SIN = soma dos quatro submercados nos dias em que os quatro têm as 24 horas. Participação = 100 × Σ MWh de MMGD ÷ Σ MWh da carga global, mesmos intervalos.
* Cadastro e estimativa são grandezas diferentes (capacidade em MW; energia estimada em MWmed; Brasil inteiro no cadastro; só SIN no ONS). Aparecem lado a lado e nunca são somadas. A única relação calculada é a razão rotulada `razao_estimativa_ons_capacidade_pct` = 100 × MWmed estimado (SIN) ÷ capacidade cadastrada média do mês (Brasil), só em mês completo do ONS e não provisório no cadastro. Não é fator de capacidade: herda as limitações das duas fontes e o descasamento de perímetro.
* Achado A11: o ONS declara (seção 2.3) que a estimativa de MMGD passou a compor geração e carga do Balanço de Energia a partir de 29/04/2023. No dado do balanço (silver principal), a solar do SIN vai de 1.991 MWmed em 28/04/2023 para 4.377 MWmed em 29/04/2023 (degrau de 2.386 MWmed); média de 1.924 MWmed nos 7 dias anteriores e 4.817 MWmed de 29/04 a 06/05. A estimativa de MMGD da API de carga verificada, como publicada hoje, é 3.528 MWmed em 29/04/2023, 1.142 MWmed acima do degrau; a fonte não publica explicação para essa diferença, e nenhuma é dada aqui. A carga do SIN no mesmo balanço não mostra degrau do tamanho da MMGD: comparando cada dia de 29/04 a 06/05 com o mesmo dia da semana 14 dias antes (6 pares; 01/05 e o par com 21/04 ficam fora por serem feriados nacionais), a mediana das diferenças é 2.840 MWmed na solar e 559 MWmed na carga, para 3.478 MWmed de MMGD estimada nos mesmos dias (ex.: sábado 15/04 68.169 e sábado 29/04 68.158 MWmed; domingo 16/04 61.866 e domingo 30/04 62.116). A declaração do ONS fala de geração e carga; no dado do balanço, o degrau só aparece na solar. O detalhe dia a dia e os pares estão em `ons_mmgd.conferencia_quebra_2023`; o texto `leitura` é gerado por regra fixa (a carga "mostra degrau" quando a mediana dela chega à metade da mediana da MMGD).

### 3.3 Fatores de emissão (MCTI)

* Valores lidos das planilhas oficiais sem alteração (4 casas na gold e nos CSV). XLSX lido com a biblioteca padrão (zip e XML). O parser procura rótulos e nomes de mês (o leiaute muda por ano); coluna de mês rotulada errada em bloco contíguo é lida pela posição e registrada (2015 e 2016: coluna de julho rotulada "Maio"); dia inexistente no calendário, preenchido com 0 na planilha, é descartado, nunca lido como fator zero (9 casos).
* Séries separadas, que não se substituem: fator médio mensal e anual (inventários); margem de operação por despacho mensal e diária, margem de construção anual e margem de operação pelo método simples ajustado anual (MDL). Só CO2 (tCO2/MWh), como a fonte publica; nada é convertido em CO2e.
* Precedência: página vigente e capturas depositadas por pessoa (a mais recente) antes do site anterior; divergências entre as duas publicações ficam em `divergencias_entre_publicacoes` (4 em 30/09/2026); arquivos da mesma origem com valores diferentes para o mesmo período ficam em `conflitos_entre_arquivos` (nenhum em 30/09/2026).
* Natureza: ESTIMADO pela fonte (seção 11.3). Os fatores não são medidos: o MCTI calcula as emissões a partir do consumo de combustível e de fatores metodológicos (ferramenta do Conselho Executivo do MDL) e as divide pela geração do ONS. É o mesmo critério da MMGD do ONS. A plataforma publica o valor oficial sem alteração (`notas_fonte` da proveniência; nas métricas, natureza da fonte e da transformação ESTIMADO, como no IASC do módulo de qualidade).
* Revisões declaradas pela fonte (colunas à direita de cada bloco quando a planilha declara uma publicação anterior): 92, publicadas com valor anterior e corrigido: 81 na margem de operação diária (43 na planilha de 2024, ex.: 02/09/2024 anterior 0,5062 e atual 0,5068; 35 na de 2020, ex.: 01/12/2020 anterior 0,5409 e atual 0,5472; 3 na de 2023), 9 na margem de operação mensal (ex.: julho/2022 publicado antes como 0,0419 e corrigido para 0,4186) e 2 na margem de construção.
* Rótulos contraditórios: na planilha de 2020, a célula P1 diz "Publicação anterior (com erros)" e a P14, acima do bloco diário da direita, "Publicação atual (com correção)". O bloco é lido como publicação anterior porque trocar os diários principais pelos da direita move a média de cada mês no sentido em que o mensal anterior difere do corrigido (setembro −0,00018 na média diária e −0,0002 no mensal; outubro −0,00025 e −0,0003; dezembro −0,00270 e −0,0028); a escolha e o motivo ficam em `problemas_de_leitura`. Na de 2022, o bloco da direita sob "Publicação atual com correção" tem um único valor (01/07: 0,4186, o mensal corrigido de julho) e não acompanha a correção do mensal: não é lido como revisão nem como fator diário (registrado em `problemas_de_leitura`). Na de 2023, 4 valores da publicação anterior caem em dias inexistentes (31/04, 31/06, 31/09 e 31/11) e vão para `descartes`.
* Releitura: as anotações de leitura de cada planilha levam a versão do leitor (`VERSAO_LEITURA_MCTI`); versão nova relê do bronze as planilhas já capturadas e refaz só as anotações (42 relidas em 01/10/2026, nenhum valor diferente do gravado).
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
| CEMIG-D (06981180000116) | 426.729; 5.840.077,77 kW | 426.729; 5.840,078 MW | 0 |
| EMT (03467321000199) | 239.053; 3.182,399 MW | 239.053; 3.182,399 MW | 0 |
| CODESAM (11810343000138), pequena | 20; 332,07 | 20; 0,332 MW | 0 |

RS no Parquet: pelo prefixo textual do código do município ("43") são 431.430 unidades, igual à gold; por `SigUF` são 431.429, porque o registro com código de 6 dígitos (431780, completado para Santo Augusto/RS) vem com `SigUF` nulo (1 registro nulo no arquivo, conferido com pyarrow em 01/10/2026).

Recurso técnico fotovoltaico: 4.655.916 de 4.655.916 empreendimentos solares da relação encontrados pelo código, todos com a mesma data de conexão e a mesma potência (tolerância 0,005 kW, o centésimo publicado).

### 4.3 ONS

* Dia 15/08/2026, releitura do JSON bruto do bronze com expressão regular e `Decimal` (sem o parser do módulo): SE 110.784,74445 MWh (CSV diário 110.784,7), S 32.927,0365 (32.927,0), NE 50.117,5161 (50.117,5), N 23.190,1828 (23.190,2); 48 meias horas em cada; SIN 9.042,48 MWmed. Tolerância 0,05 MWh (arredondamento de uma casa no CSV).
* Identidade publicada pelo ONS (carga global = carga sem MMGD + MMGD), dia a dia por submercado: 11.132 de 11.132 dias fecham com tolerância de 0,1 MWh por dia.
* Último mês completo (ago/2026): 8.967,9 MWmed de MMGD estimada no SIN (valor de cálculo 8.967,9269; o valor exibido da evidência tem a mesma casa decimal do KPI), 10,80% da carga global. Ano de 2025: 7.695 MWmed, 67,41 TWh, 9,45% da carga global. Razão com a capacidade cadastrada: 19,6% (dez/2025), 19,8% (jan/2026), 17,7% (mar/2026); ausente de abr/2026 em diante (cadastro provisório).

### 4.4 MCTI

* Leitura independente do XML da planilha `Inventario_2026_janago.xlsx` por expressão regular: anual de 2025 = 0,0461 (célula O99) e agosto de 2026 = 0,0471 (célula J105), iguais à gold.
* Controle de leitura do anual: anual publicado comparado à média simples dos 12 meses publicados, tolerância 0,0001 tCO2/MWh (arredondamento da quarta casa nos meses e no anual). 19 dos 20 anos ficam dentro; 2007 fica fora por 0,000125 (anual 0,0293; média dos meses 0,029175) e é publicado como ressalva, sem ajuste.
* Valor atípico conferido no original: margem de construção de 2017 = 0,0028 tCO2/MWh (célula G4, gravada como 2.8E-3 na planilha do ano-base 2017), mantida como publicada.
* Divergências entre a página vigente e o site anterior (vale a vigente): fator médio anual de 2021 (0,1263 × 0,1264), fator médio de nov/2021 (0,1474 × 0,1484), margem de operação diária de 31/12/2021 (0,5778 × 0,5500) e simples ajustado de 2019 (0,3896 × 0,386). A nota das duas publicações para 2019 ("O valor foi revisado em agosto de 2020. O valor anterior era 0,3992") não explica essa divergência: 0,3992 não é nenhum dos dois valores. A divergência fica publicada sem explicação da fonte.
* Consistência interna da margem de operação: média simples dos fatores diários × fator mensal publicado, maior diferença 0,0071 tCO2/MWh (fev/2024), em 248 meses; o mensal oficial é ponderado pela geração horária.

### 4.5 Testes automatizados

`python3 -m unittest pipeline.tests.test_energia_transicao`: 60 testes, todos aprovados em 01/10/2026. Cobrem: agregados iguais entre o Parquet e o CSV oficiais (amostra real de 274 linhas); distribuidora pequena (CODESAM, 20 unidades e 332,07 kW) e multiestadual (CERES em MG e RJ) contra somas do CSV completo; identidade pelo CNPJ (Âmbar Amazonas com o CNPJ da antiga Amazonas Energia); data sentinela; código de município de 6 dígitos só com prefixo único; potência ausente distinta de zero; valor extremo de minigeração mantido; duplicidade candidata medida sem remover; controles por partes iguais aos da tabela inteira; energia do ONS contra o texto bruto; campo vazio de 2018 como ausência; dia em curso descartado; razão bloqueada em mês provisório; população de Roraima igual à soma dos municípios; planilhas do MCTI de 2015 (mês rotulado errado), 2020 e 2022 (revisões declaradas), 2021 (29/02 inexistente), inventário 2026 e simples ajustado 2025; âncoras invisíveis e comentários HTML ignorados; listagem nova só quando muda; precedência da página vigente e conflito entre arquivos; evidências válidas pelo contrato de `pipeline/energia/evidencia.py`; revisão quando unidades somem entre capturas; validação crítica vira stub; equivalência entre gold e CSV. Acrescentados na verificação de 30/09/2026 (seção 4.6): entidade grande (CEMIG-D e SP no recorte do agregado); conferência da quebra de 2023 com o recorte real do balanço do S3 do ONS; unidades fora da área da distribuidora (São Caetano de Odivelas e Abadia de Goiás); identidade de estoque e séries com zero; participação pequena; revisões diárias do MCTI (2020, 2022, 2023 e 2024) e releitura; natureza ESTIMADO; precisão da evidência do ONS; amostras do desafio de verificação humana.

### 4.6 Verificação adversarial de 30/09/2026: defeitos e correções (01/10/2026)

Todos os defeitos foram reproduzidos no código e no dado antes da correção; nenhum foi refutado. Cada um tem teste que o teria detectado (classe entre parênteses, em `pipeline/tests/test_energia_transicao.py`).

| Defeito (gravidade, painel) | Reprodução | Correção | Teste |
| --- | --- | --- | --- |
| Explicação causal sem fonte no A11 e pedido de marcar a carga sem conferir (médio, P063) | O texto `leitura` dizia "processos diferentes do ONS (previsão meteorológica…)", sem fonte; `_conferencia_quebra` só lia `solar.SIN`. No CSV do S3 (`BALANCO_ENERGIA_SUBSISTEMA_2023.csv`, baixado de novo em 01/10/2026), a carga do SIN tem 68.169 (sáb 15/04) e 68.158 (sáb 29/04) MWmed | Texto só com números e com "a fonte não publica explicação"; conferência estendida à carga (pares de mesmo dia da semana, 14 dias antes, sem feriados): mediana 559 MWmed na carga, 2.840 na solar, 3.478 de MMGD; pedido ao integrador restrito à solar, com a carga a conferir pelo dono (seção 6) | `ConferenciaQuebra2023` (recorte real do S3: solar 1.991 e 4.377; carga 68.169 e 68.158) |
| Fatores do MCTI rotulados OBSERVADO (médio, P064) | `natureza="OBSERVADO"` nas duas proveniências, nas 3 métricas e em `NATUREZA_BLOCO.fator_mcti` | ESTIMADO (estimado pela fonte) nas proveniências, nas métricas (fonte e transformação, como o IASC) e no tipo TS, com nota de valor oficial publicado sem alteração | `BlocoEmissoesRevisoes`, `PublicacaoAtual.test_natureza_dos_fatores_do_mcti` |
| Unidades com município de outra área de concessão sem sinal (médio, P063) | No Parquet oficial, São Caetano de Odivelas (1507102) tem 249 unidades e 2.613,05 kW, das quais 185 e 1.830,21 kW da Neoenergia PE; Abadia de Goiás, 157 da COELBA (1.169,92 kW) | Área de cada CNPJ pelos conjuntos elétricos da ANEEL (seção 2.1.1); por município, contagem e kW das unidades fora da área (mapa e CSV), por distribuidora as UFs fora, controle `distribuidora_fora_da_uf` (4.497 unidades, 62,9 MW, 677 municípios, 26 distribuidoras) e limitação nas proveniências do cadastro e do por habitante. Nada corrigido | `AreaDistribuidora`, `AreaDistribuidoraNaGold` |
| Revisões diárias do MCTI ignoradas e rótulo contraditório sem registro (médio, P064) | O parser só lia as colunas extras do bloco mensal: 11 revisões. No XML, 43 diárias em 2024, 35 em 2020 e 7 valores em 2023 | Leitura dos diários da publicação anterior (`margem_operacao_diaria`): 92 revisões (81 diárias); rótulo de 2020 resolvido pelo dado e registrado; bloco de 2022 sob "atual" não lido e registrado; 4 dias inexistentes de 2023 descartados; releitura versionada das planilhas já capturadas | `RevisoesDiariasMCTI`, `BlocoEmissoesRevisoes` |
| Validações declaradas e não executadas (baixo, P063) | Estoque mensal 53.964,849 MW contra 53.965,593 MW de total; anual 4.656.793 contra 4.656.839 | Identidade estoque com data + sem data = total executada a cada publicação (derruba a publicação se falhar) e publicada em `controles.identidade_estoque`; textos das métricas ajustados | `EstoqueEZeros.test_identidade_de_estoque_e_series_sem_buraco`, `test_estoque_que_nao_fecha_derruba_a_publicacao` |
| Faltavam entidade grande e A11 nos testes (baixo, P063/P064) | Nenhum teste com CEMIG-D ou SP; nenhum teste de `_conferencia_quebra` | Recorte do agregado vigente (CEMIG-D em `dist_uf_ano`, SP em `uf_mes_fonte`) com valores do CSV e do Parquet oficiais (426.729 e 5.840.077,77 kW; 787.146 e 7.610.299,55 kW); recorte real do balanço | `EntidadeGrande`, `ConferenciaQuebra2023` |
| Zero real omitido e participações arredondadas a zero (baixo, P063) | `anual` pulava de 2004 para 2009; `mensal` tinha 187 meses com lacunas; iluminação pública e consumo próprio com 0,0% | Anos, meses e UF × ano com zero explícito (268 meses); participação com dois algarismos significativos abaixo de 0,01% | `EstoqueEZeros` |
| Afirmações do documento sem conferência (baixo) | Lote de 250 mil (o código usa 50 mil); RS por prefixo; nota de 2019; queda de 2026 atribuída à nota de 2025; conexões "até 29/09/2026" | Corrigidas nas seções 2.1, 3.1, 4.2 e 4.4: lote de 50 mil; RS 431.430 pelo prefixo e 431.429 por `SigUF` (1 nulo); divergência de 2019 sem explicação da fonte; queda provisória sem causa; última conexão em 31/08/2026 | conferências desta seção |
| Precisão da evidência do ONS (baixo, P063) | `valor_exibido` "8.968" contra KPI 8.967,9 | Evidência com uma casa decimal, igual ao KPI ("8.967,9") | `PublicacaoAtual.test_evidencia_ons_com_a_mesma_precisao_do_kpi` |
| Evidências de acesso ao MCTI não guardadas (baixo, P064) | Só um registro de `pagina_atual` em `coletas`; nenhum arquivo com o desafio das 22:40 | Afirmações sem registro retiradas; desafio de 01/10/2026 00:06:34 UTC guardado (recorte com support ID e sha256); o coletor passa a guardar o HTML do desafio no bronze | `DesafioMCTIGuardado` |

## 5. Limitações materiais e o que não se pode concluir

* Capacidade cadastrada (kW, MW) não é energia gerada. Não há geração de MMGD por município ou por unidade em fonte pública; a estimativa de energia do ONS é por submercado e SIN.
* O cadastro é o vigente: unidades desativadas não aparecem no histórico, e a série por ano de conexão é das unidades que continuam cadastradas. Meses recentes são provisórios.
* O local é o município da unidade com geração; no autoconsumo remoto (1.105.104 unidades, 13.851 MW) o crédito é usado em outras unidades, possivelmente em outro município.
* Potência por habitante relaciona território, não renda: nada permite inferir renda ou perfil de um beneficiário.
* Há 4.497 unidades (62,9 MW; 0,1% do cadastro) em 677 municípios de UF onde a distribuidora informada (CNPJ) não tem nenhum conjunto elétrico (ex.: 880 da COELBA fora da Bahia; 425 da Neoenergia PE fora de PE, PB, PI e BA; 1.370 da Equatorial PI). As UFs legítimas das multiestaduais não são sinalizadas (ELEKTRO em SP e MS, EMR em MG e RJ, CERES em RJ e MG, todas com conjunto nas duas UFs); unidades delas em terceiras UFs são (13 da ELEKTRO, 10 da EMR). É provável erro de código de município na origem; o módulo não corrige: publica, por município, a contagem e os kW dessas unidades e o sinal no mapa e no CSV. Em município pequeno o efeito é grande: São Caetano de Odivelas (PA) tem 249 unidades e 2.613,05 kW, das quais 185 unidades e 1.830,21 kW (70% da potência) da Neoenergia PE; o W/hab publicado inclui essas unidades.
* A estimativa de MMGD do ONS é modelo, não medição, e o ONS revisa o histórico. A razão com o cadastro compara perímetros diferentes (SIN × Brasil) e não é fator de capacidade.
* Fator médio não é fator marginal: não mede o efeito de consumir ou economizar um MWh. Fatores do MDL servem só a projetos de MDL. Só CO2, emissões da operação das usinas; não é CO2e nem ciclo de vida. Perímetro: geração no SIN; perdas não são tratadas à parte pela fonte.
* Comparações que atravessam jan/2025 misturam bases de usinas diferentes (quebra declarada pelo MCTI).
* Não existe intensidade de emissão municipal nem horária oficial, e nenhuma foi derivada.

## 6. Pedidos ao integrador

1. **Tipo de evidência compartilhado.** `tipos-transicao.ts` define `EvidenciaTransicao` espelhando `pipeline/energia/evidencia.py` (`CAMPOS`), porque `src/lib/energia/evidencia.ts` ainda não existe. Quando existir, trocar por um alias do tipo `Evidencia` compartilhado.
2. **Achado A11 nos módulos de geração e carga.** A declaração está confirmada pela fonte primária (seção 2.3), e a quebra aparece no dado da solar (degrau de 2.386 MWmed na solar do SIN em 29/04/2023). O dono de `gold/geracao.py` deve marcar a quebra em 29/04/2023 na série de solar (e nos agregados de geração que a contêm) e não comparar períodos antes e depois sem rótulo. Para a carga, o ONS declara a mesma incorporação, mas o dado do balanço não mostra degrau do tamanho da MMGD (mediana de 559 MWmed contra 3.478 MWmed de MMGD, seção 3.2): o dono de `gold/carga.py` deve conferir a própria série (o balanço e a carga verificada) antes de marcar qualquer quebra, e não atribuir variação da carga à MMGD sem essa conferência. A evidência dia a dia, com os pares de mesmo dia da semana, está em `transicao.json`, `ons_mmgd.conferencia_quebra_2023`.
3. **Download duplicado do cadastro de MMGD.** O módulo de perdas baixa o mesmo Parquet da ANEEL para `data/energia/bronze/aneel/aneel_mmgd_municipio` (77 MB repetidos no bronze). Pode ler os agregados por município do silver `aneel_mmgd` (série `qtd.mun_ano_fonte` e `kw.mun_ano_fonte`) ou do CSV `transicao_mmgd_municipio_ano_fonte.csv`.
4. **Navegação e matriz.** Na fase de interface, incluir `/setor-eletrico/transicao` em `navegacao.ts` e atualizar P063 e P064 em `MATRIZ_PAINEIS.md` e `status_paineis.json` com o estado da seção 1.
5. **Workflow de atualização.** A família `aneel_mmgd` precisa entrar na cópia durável dos silvers (o cadastro importado e as capturas do MCTI e do ONS medem revisões entre execuções).
