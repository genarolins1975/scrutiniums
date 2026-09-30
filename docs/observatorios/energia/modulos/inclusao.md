# Módulo Inclusão energética (P059 a P062)

Documento de método do módulo `inclusao` (rota `/setor-eletrico/inclusao-energetica`, família de silver `aneel_social`, ordem 43). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/inclusao.py` |
| Leitores (funções puras) | `pipeline/energia/fontes/aneel_inclusao.py` (SCS, Beneficiários da CDE, série antiga, custeio da CDE), `ibge_inclusao.py` (SIDRA, POF, PNAD), `mds_inclusao.py` (Cadastro Único), `epe_inclusao.py` (PASI e caderno em PDF), `mme_inclusao.py` (Luz para Todos), `planilha_inclusao.py` (XLSX e XLS sem dependência externa) |
| Métricas (19 medidas) | `pipeline/energia/metricas/inclusao.py` |
| Testes (44, sem rede) | `pipeline/tests/test_energia_inclusao.py`, recortes reais em `pipeline/tests/dados/energia_inclusao/` |
| Gold | `public/energia/gold/inclusao.json` (453 KB; ver seção 6) |
| Downloads e leitura sob demanda | `public/energia/series/inclusao_*.csv` (12 arquivos) e `inclusao_sistemas_isolados_pontos.json` |
| Tipos | `src/lib/energia/tipos-inclusao.ts` (conferido contra a gold com `tsc` em modo estrito, checagem de propriedades excedentes) |

Execução: `python3 pipeline/energia/executar_modulo.py inclusao` (coleta e gold) ou `--sem-coleta` (só gold, cerca de 4 s). Pico de memória medido na gold: 192 MB. Na coleta, cada arquivo mensal de Beneficiários da CDE (cerca de 300 MB compactado, 2 GB de CSV) é lido em fluxo a partir de arquivo temporário e agregado por distribuidora, município, subclasse e tipo de faturamento; os microdados da POF (146 MB) vão para temporário em disco e são lidos registro a registro. Tempo da coleta completa a partir do zero: cerca de 14 minutos, quase todo nos quatro arquivos da CDE.

## 1. Painéis e estado

| Painel | O que a gold entrega | Estado |
| --- | --- | --- |
| P059 Tarifa Social | Série mensal nacional de UC com Tarifa Social, participação nas UC residenciais, DMR e energia (SCS, dez/2011 a jun/2025, gold desde jan/2014); tabela de 102 distribuidoras no mês de referência (mai/2025) com modalidades, DMR por UC, kWh por UC e variação em 12 meses; faixas de consumo; mapa por UF e por município de faturas com desconto no arquivo de Beneficiários da CDE de mar/2026; conferência SCS × CDE; série antiga descontinuada como histórico identificado; custeio anual da CDE | Dados concluídos com limitação declarada: o SCS termina em jun/2025 (último mês completo mai/2025) e a contagem do mapa é de faturas, não de UC (seção 5). Página pendente |
| P060 Cobertura potencial | Razão entre UC (ou faturas) com Tarifa Social e famílias do Cadastro Único com renda per capita até meio salário mínimo, Brasil, UF e município (mar/2026), série mensal nacional (abr/2015 a mai/2025), faixa de sensibilidade (cadastradas × atualizadas), regra de elegibilidade com base legal e vigência | Concluído como PROXY rotulada: o denominador não é o universo elegível completo (critérios do BPC e de equipamento médico ficam fora) e o numerador conta UC, não famílias. Não se publica número de famílias "fora" (seção 5). Página pendente |
| P061 Peso no orçamento | POF 2017-2018: despesa média com energia e com o total, razão de médias (igual à tabela 6715), média das participações por família (na despesa e na renda), medianas, famílias sem despesa com energia e proporções acima de 3%, 5% e 10% (sensibilidade), com CV pelo plano amostral; Brasil e regiões por classe de rendimento, UF só no total | Dados concluídos com limitação declarada: estatística de 2017-2018, sem atualização modelada; nenhum recorte municipal. Página pendente |
| P062 Acesso e sistemas isolados | PNAD Contínua anual 2016 a 2025 (domicílios com energia de qualquer fonte, de rede geral e com rede em tempo integral; sem energia), Brasil, regiões e UF, urbano e rural; PASI (EPE) ciclos 2023 a 2025 com localidades, população e coordenadas, conferido contra o caderno em PDF; Luz para Todos (MME) com domicílios atendidos por programa, UF, município e mês (abr/2004 a ago/2026) e recursos por contrato; custeio anual da CDE para o programa e para a CCC | Dados concluídos com limitação declarada (seção 5). Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não existe, e P060 só pode ser proxy com as fontes públicas disponíveis.

## 2. Fontes verificadas (consulta em 30/09/2026)

| Fonte | Recurso usado | URL | Licença | Período e grão | Publicação pela fonte |
| --- | --- | --- | --- | --- | --- |
| ANEEL, SCS (S10) | `sistema-controle-subvencoes-programas-sociais.csv` e dicionário `Dicionário de dados` (versão 1.0 de 16/04/2024) | https://dadosabertos.aneel.gov.br/dataset/scs-sistema-de-controle-de-subvencoes-e-programas-sociais | ODbL | dez/2011 a jun/2025; distribuidora × competência × despacho × faixa de consumo; 75.365 linhas, 14.053 pares distribuidora e competência | CSV 20/09/2026 04:01 UTC (campo DatGeracaoConjuntoDados 2026-09-20) |
| ANEEL, Beneficiários da CDE (S11) | arquivos mensais `Beneficiários da CDE - mai/25` (conferência), `cde-beneficiarios-01mar2026.zip` (mapa), `-01apr2026.zip` e `-01may2026.zip` (sondados) e o dicionário | https://dadosabertos.aneel.gov.br/dataset/beneficiarios-da-cde | ODbL | um arquivo por mês (jan/2018 a mai/2026); uma linha por fatura com desconto custeado pela CDE, com nome e CPF mascarado do cliente | arquivos 24/07/2026; o portal avisa que a base muda por retificação |
| ANEEL, série antiga (S12) | `tarifasocial.csv`, cópia do Internet Archive de 29/07/2024 | https://dadosabertos.aneel.gov.br/dataset/tarifa-social-de-energia-eletrica-beneficiarios | licença não declarada no conjunto; portal ODbL | trimestral por grande região, dez/2012 a mar/2019 | recurso modificado em 30/11/2021 |
| ANEEL, CDE: custeio dos benefícios tarifários | `cde-custeio-beneficios-tarifarios.csv` e dicionário | https://dadosabertos.aneel.gov.br/dataset/conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios | ODbL | anual por rubrica de despesa e receita | 01/09/2026 |
| ANEEL, página da Tarifa Social | texto das regras de elegibilidade e da MPV nº 1.300/2025 | https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social | página pública | vigência atual | consulta 30/09/2026 |
| MDS, Cadastro Único (MI Social, SAGI) (S23) | serviço Solr `misocial`: consulta municipal por `anomes_s` (CSV) e estatísticas por mês (JSON); campos `cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i`, `cadun_qtd_familias_atualizadas_rfpc_ate_meio_sm_i`, `cadun_qtd_familias_cadastradas_i` | https://aplicacoes.mds.gov.br/sagi/servicos/misocial | acesso público sem autenticação; o serviço não declara licença | município (código IBGE de 6 dígitos) × mês; totais nacionais de ago/2012 a set/2026 (famílias com cadastro atualizado desde abr/2015) | o serviço não informa data de publicação |
| IBGE, POF 2017-2018 (S18) | API SIDRA tabela 6715 (variáveis 1201 e 1204, classes 339, tipos 103536 e 8018); `tabelas_despesas_xls_20191108.zip` (Tabelas de Coeficientes_despesas); microdados `Dados_20230713.zip` e `Tradutores_20230713.zip` | https://sidra.ibge.gov.br/tabela/6715 e https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2017_2018/ | uso livre com citação do IBGE | jul/2017 a jul/2018; valores em R$ de 15/01/2018; 58.039 famílias na amostra | microdados de 13/07/2023; a API não informa data |
| IBGE, PNAD Contínua anual (S23) | API SIDRA tabelas 6737 (variáveis 5157, 5160, 5074, 5077; fonte rede geral ou alternativa e rede geral), 6738 (9992 a 9995) e 6731 (162, 5123) | https://sidra.ibge.gov.br/tabela/6737 | uso livre com citação do IBGE | 2016 a 2025; Brasil, regiões e UF; total, urbana e rural | a API não informa data |
| EPE, PASI (S23) | exportação "Localização Geográfica" por ciclo (`ExportarDadosLocalizacaoLocalidades?codCicloColeta=6, 8, 9`); caderno do ciclo 2025 em PDF | https://pasi.epe.gov.br/Downloads e https://www.epe.gov.br/sites-pt/publicacoes-dados-abertos/publicacoes/PublicacoesArquivos/publicacao-942/Caderno_Planejamento%20SISOL_2025_FINAL.pdf | CC BY 4.0 (portal da EPE) | ciclos 2023, 2024 e 2025; localidade | a exportação não informa data |
| MME, Luz para Todos (S17) | `domicilios_atendidos.csv`, `recursos_aplicados.csv` e `dicionario-de-dados-template_v1.2lpt.pdf` | https://dadosabertos.mme.gov.br/dataset/luz-para-todos | "Outra (Aberta)" no portal do MME | abr/2004 a ago/2026; lote de atendimento × município × mês; 619.018 linhas; 424 contratos | 20/09/2026 11:02 UTC |

Cada arquivo está no bronze com sha256 (`data/energia/bronze/{aneel,mds,ibge,epe,mme}/...`) e vintage no silver `data/energia/silver/aneel_social.db`, exceto os dois meses da CDE só sondados (abr e mai/2026), que têm sha256 e cobertura registrados mas não guardam cópia (cerca de 300 MB cada, rejeitados pela regra de cobertura). Recoleta: SCS, custeio, PNAD, PASI e Luz para Todos a cada 7 dias ou quando a data de modificação da fonte muda; Cadastro Único municipal a cada 30 dias; POF uma vez (pesquisa encerrada).

Descontinuação da série antiga, com evidência: o `package_show` do conjunto traz o título "Tarifa Social de Energia Elétrica – Beneficiários (descontinuado)" e a nota "Conjunto de dados substituído pelo https://dadosabertos.aneel.gov.br/dataset/beneficiarios-da-cde"; o recurso responde HTTP 302 com `Location` igual à própria URL (laço conferido em 30/09/2026 22:41 UTC, registrado no silver). A cópia usada é a do Internet Archive, identificada como tal na gold.

Finalidade de SCS e CDE, validada no próprio catálogo: o SCS registra os pedidos de reembolso da Diferença Mensal de Receita (DMR) da subclasse residencial baixa renda por distribuidora e mês; os Beneficiários da CDE listam, fatura a fatura, os descontos custeados pela CDE (Decreto nº 9.022/2017, art. 24). Os dois servem ao tema, com grãos e unidades diferentes.

Fontes tentadas sem integração: painéis Power BI da página "outras informações analíticas" do MME (quatro painéis, sem download); busca por "universalização" no portal da ANEEL (nenhum conjunto) e por "isolados" no portal do ONS (nenhum conjunto). CCEE não é fonte deste módulo.

## 3. Método

### 3.1 SCS (P059)

* Despacho vigente: uma competência aparece em mais de um despacho em 1.018 pares; vale o de data de registro mais recente (depois competência do despacho e número). Em 1.016 pares os valores são idênticos; em 2 diferem (CEEE-D abr/2020: 74.940 UC no despacho 1533/2020 e 78.574 no 2528/2020, que vale).
* A DMR e suas parcelas vêm repetidas nas cinco linhas de faixa do despacho: é lida uma vez por distribuidora e mês. Somar as faixas multiplicaria por cinco (teste com RGE jan/2014, R$ 1.468.574,35).
* UC com Tarifa Social = NumConsBaixaRenda + NumConsIndigena + NumConsQuilombola + NumConsBPC + NumConsMultifamiliar, somadas nas cinco faixas.
* Participação = 100 × Σ UC com Tarifa Social ÷ Σ QtdConsResTotal, das mesmas distribuidoras; sai das duas somas a distribuidora com total residencial inconsistente no mês (ausente, zero, menor que as próprias UC com Tarifa Social ou mais de 25% distante da mediana dos 3 meses anteriores e 3 posteriores). Casos reais: Eletropaulo dez/2021 (2.552.348 contra cerca de 7,4 milhões nos vizinhos) e EMR jul/2023 (zero). O valor da fonte continua no CSV.
* Mês completo: pelo menos 90 informantes e nenhuma distribuidora esperada faltando. Esperada é a que informou antes e volta a informar depois (lacuna) ou que informou em algum dos 3 últimos meses do arquivo (na cauda não se distingue saída de atraso). Distribuidora que para de informar para sempre antes da cauda saiu por incorporação (RGE em 2020, EBO e ENF em 2023, as quatro CPFL menores em 2018) e não torna o mês incompleto. Essa regra substituiu a comparação com a mediana de informantes dos 12 meses anteriores, que marcava como incompletos os seis meses seguintes a cada incorporação. Resultado: desde 2014, só abr/2025 (CERAL-DIS ausente, 20 UC) e jun/2025 (Enel CE e outras três ausentes, 1,6 milhão de UC) são incompletos. Mês de referência: mai/2025.

### 3.2 Beneficiários da CDE (P059 e P060)

* Agregação em fluxo; nenhum campo pessoal (NomCliente, NumCPFCNPJCliente) é lido para o silver nem publicado (teste com linha marcada).
* Faturas com Tarifa Social = linhas com DscTipoSubsidio = SubsBaixaRenda, IdcTipoFaturamento = 1 e IdcSubclasse de 3.2 a 3.6; desconto = soma de VlrSubsidio dessas linhas. Tipos 2 a 4 (cancelamento e refaturamentos) entram só no desconto líquido do mês.
* Município: código IBGE de 7 dígitos com UF existente; outro formato (ex.: "210083", "0") fica no total nacional e fora do mapa (190 faturas em mar/2026).
* Meses: o de conferência (último mês completo do SCS, mai/2025, relido e comparado distribuidora a distribuidora); o mais recente (mai/2026); e o do mapa, o mais recente cuja cobertura pelas UC do SCS de referência seja de pelo menos 99,5%, procurado para trás. Resultado: mai/2026 com 89,62% e abr/2026 com 94,33% (rejeitados, sem cópia no bronze); mar/2026 com 100% (mapa).

### 3.3 Cobertura potencial (P060, PROXY)

* Numerador: faturas com Tarifa Social no arquivo da CDE do mês do mapa (municípios e Brasil) ou UC do SCS (série mensal nacional, meses completos).
* Denominador: famílias do Cadastro Único com renda per capita até meio salário mínimo e cadastro atualizado, no mesmo mês de referência (`anomes_s`); faixa de sensibilidade com todas as cadastradas nessa renda. O total do cadastro (todas as rendas) nunca é denominador.
* Regra de elegibilidade conferida na página da ANEEL em 30/09/2026: critério I (Cadastro Único e renda per capita até meio salário mínimo) está no denominador; II (BPC) e III (equipamento médico, renda até 3 salários mínimos) não. A MPV nº 1.300/2025 mudou o tamanho do desconto a partir de 05/07/2025, não o público.
* Por que é proxy: UC não é família; família pode não ser titular da conta; o numerador inclui os critérios II e III (por isso a razão pode passar de 100%); o município da fatura é o da UC e o do cadastro é o da residência declarada; família sem acesso à rede está no denominador e não pode estar no numerador.
* Municípios com menos de 50 famílias no denominador ficam fora da distribuição (37 em mar/2026). Vínculo pelo código IBGE de 6 dígitos.

### 3.4 POF (P061)

* A despesa por família refaz a memória de cálculo do IBGE ("Tabela de Despesa Geral.R"): valor deflacionado × fator de anualização (× número de meses nos quadros mensais) ÷ 12, somado pelos códigos do tradutor com nível 0 "Despesa Total"; energia elétrica = nível 5 1102031 (item 600101).
* Razão de médias = Σ w·energia ÷ Σ w·despesa (a "distribuição" publicada pelo IBGE). Média das razões = Σ w·(energia ÷ despesa) ÷ Σ w (e o mesmo com a renda), só para famílias com denominador positivo. As duas medidas são publicadas lado a lado e não se substituem: na classe até R$ 1.908, a razão de médias é 4,37% e a média das participações na despesa é 5,12%.
* Erro-padrão por linearização de Taylor com estrato (ESTRATO_POF) e unidade primária (COD_UPA), pesos PESO_FINAL; UPA sem família no domínio conta como zero no estrato (erro de subpopulação correto). O IBGE calibra os pesos por pós-estratos; a linearização não refaz a calibração, e os CV ficam a até 0,18 ponto percentual dos publicados para o Brasil.
* Precisão: CV até 15% publicado; de 15% a 30% com cautela; acima de 30% suprimido (valor nulo); proporção zero sem erro-padrão fica como "zero_na_amostra" (não prova zero na população).
* Domínios: Brasil e grandes regiões por classe de rendimento; UF só no total (amostra por classe pequena). Nada municipal. Limiares de 3%, 5% e 10% da renda e da despesa são sensibilidade, não definição de pobreza energética.

### 3.5 Acesso (P062)

* PNAD Contínua: percentuais e contagens publicados; domicílios sem energia = total (6731) menos com energia de qualquer fonte (6737), sem erro-padrão para a diferença. O percentual em tempo integral (6738) é sobre os domicílios de rede geral, não sobre todos (conferido: 77.364 ÷ 78.692 = 98,31%, publicado 98,3%).
* Domicílio conectado e serviço confiável são dimensões separadas; a carga do SIN não é usada como medida de acesso.
* PASI: localidades e população informadas pelas distribuidoras; saída da lista entre ciclos contada (15 em 2025, igual ao texto do caderno, que atribui a interligações).
* Luz para Todos: soma de `qtddomicilios` por UF, programa e mês do atendimento; município ligado ao código IBGE pelo nome exato sem acento, pontuação e espaços dentro da UF (lista do Cadastro Único). 5.417 dos 5.439 nomes casam; os 22 restantes (19.031 domicílios, nomes antigos ou grafias diferentes como Parati, Itapagé, Poxoréo, Santa Isabel do Pará) ficam sem código, contados na UF e no total, sem aproximação.

## 4. Evidências de aceite

| Número | Gold | Fonte ou caminho independente | Diferença | Tolerância |
| --- | --- | --- | --- | --- |
| UC com Tarifa Social, Brasil, mai/2025 | 17.246.524 (102 distribuidoras) | soma direta do CSV do SCS no bronze, despacho de registro mais recente, sem as funções do módulo: 17.246.524 | 0 | exata |
| DMR, Brasil, mai/2025 | R$ 542.423.514,83 | mesma soma direta: R$ 542.423.514,83 | 0 | exata |
| Faturas com Tarifa Social, CDE mai/2025 | 17.612.898 | agregação do mesmo ZIP por outro programa (leitura direta do CSV, sem o módulo): 17.612.898 | 0 | exata |
| SCS × CDE, mai/2025 | 17.246.524 UC × 17.612.873 faturas (mesmas 102 distribuidoras) | produtos diferentes da ANEEL | +2,12% nas contagens; −2,12% em reais (R$ 542,4 milhões de DMR × R$ 530,9 milhões de desconto); 86 de 102 distribuidoras dentro de ±2%; maiores: CEMIG-D +12,35%, Equatorial PI, AL, PA e MA de +6,1% a +6,7% | ±2% no total e em 90% das distribuidoras: **ressalva publicada** |
| SCS × série antiga | 21 trimestres (mar/2014 a mar/2019) | CSV arquivado da ANEEL | mediana 0,64%; fora de ±2%: jun/2015 (−3,18%), set/2015 (−5,61%), jun/2016 (−2,03%) | 2%: **ressalva publicada**; nov/2018 repete set/2018 no arquivo original |
| Despesa média com energia, 75 domínios da POF | Brasil R$ 115,3556; até R$ 1.908, R$ 65,6156 | tabela 6715: R$ 115,36 e R$ 65,62 | 75 de 75 dentro de meio centavo; máximo R$ 0,005 | R$ 0,005 (duas casas publicadas) |
| Distribuição da despesa com energia | Brasil 2,4813%; até R$ 1.908, 4,3722% | tabela 6715: 2,5% e 4,4% | 75 de 75 dentro de 0,05 p.p. | 0,05 p.p. (uma casa publicada) |
| CV da despesa com energia, Brasil | 0,73% (total), 1,26% (até R$ 1.908) | Tabelas de coeficientes do IBGE: 0,8% e 1,4% | até 0,18 p.p. | informativa (calibração não refeita) |
| Domicílios sem energia, Brasil, 2025 | 135 mil | tabelas 6731 (79.305 mil) e 6737 (79.170 mil) | exata; 100 × 79.170 ÷ 79.305 = 99,83% contra 99,8% publicado | 0,06 p.p. |
| Sistemas isolados, ciclo 2025 | 160 localidades; 1.964.825 pessoas; 175 no ciclo 2024 | caderno em PDF da EPE, página 11 (pdftotext): "totaliza 160 ... (175 localidades)" e "1,965 milhões pessoas" | 0 localidades; 0,000175 milhão de pessoas | igualdade; 0,0005 milhão |
| Luz para Todos, total | 3.863.418 domicílios | soma direta do CSV do MME por outro programa: 3.863.418 | 0 | exata |
| Cadastro Único, mar/2026 | 25.305.223 famílias atualizadas | estatística do próprio serviço (soma do Solr) contra a soma dos 5.571 municípios | 0 | 0,5 família |

Testes (`python3 -m unittest pipeline.tests.test_energia_inclusao`, 44, todos aprovados): leitura do SCS com despacho vigente, DMR única, zero e ausência distintos, inconsistência residencial; completude com incorporação, lacuna e cauda; agregação da CDE com contagens conferidas no recorte, município inválido, tipos de faturamento e ausência de dado pessoal; série antiga; Cadastro Único; SIDRA, coeficientes, leitor XLS, microdados de duas famílias e estimador do plano conferido à mão; PNAD e convenções do IBGE; PASI contra o texto do caderno; Luz para Todos (somas, linhas inválidas, recursos, vínculo de nomes); catálogo de métricas; e, na gold, evidências válidas pelo construtor compartilhado, conferências concretas acima, identidade UF + inválidos = total, rótulo de proxy e limiares decrescentes.

Validação física e de domínio na construção (`validar_gold`): percentuais em 0 a 100, contagens e valores não negativos, CNPJ e UF únicos, meses não futuros, identidade das faturas por UF, razão com cadastradas não maior que com atualizadas. Violação crítica vira stub (a sentinela mantém a publicação anterior); nenhuma na publicação de 30/09/2026.

## 5. Limitações materiais e o que não se pode concluir

* O SCS termina em jun/2025 (arquivo de 20/09/2026); o mês de referência nacional é mai/2025. A nova regra de desconto (gratuidade até 80 kWh desde 05/07/2025) só aparece nos arquivos da CDE: o desconto médio por fatura sobe de R$ 30,15 (mai/2025) para R$ 45,93 (mar/2026).
* Faturas não são UC: o arquivo da CDE tem 2,12% mais faturas que as UC do SCS em mai/2025, com diferenças de até 12% por distribuidora. O mapa de P059 mostra faturas.
* P060 é proxy: não diz quantas famílias elegíveis estão fora do benefício. Razões municipais acima de 100% (72 municípios em mar/2026) são esperadas pela composição do numerador.
* A POF representa 2017-2018 e não 2026. Nenhuma atualização modelada é publicada. Não existe mapa municipal da POF.
* A PNAD é amostral; em UF pequenas e no rural os CV passam de 5%. O número de domicílios sem energia não tem erro-padrão publicado.
* A população do PASI é informada pelas distribuidoras; localidade isolada tem energia (em geral térmica a óleo diesel), fora do SIN.
* Luz para Todos: domicílio ligado não mede qualidade nem continuidade do serviço; o ano de 2026 vai até ago/2026; a homologação chega meses depois e o arquivo muda. O dicionário do MME descreve `vlrpagocaixa` como "valor pago da RGR" e `vlrpago` como participação do agente executor: o módulo segue a correspondência com os campos contratados (registrado aqui para revisão pelo MME). O arquivo não traz a categoria "Mais Luz para a Amazônia"; o PASI marca 15 localidades do ciclo 2025 com esse programa.
* O silver não apaga observação que some numa atualização da fonte (vale a última captura de cada chave); para o Luz para Todos, cuja base cresce por homologação, o risco é baixo e está declarado na proveniência.
* A contagem da série antiga repete em nov/2018 os valores de set/2018 no arquivo original.
* Associação não é causalidade: nenhum texto do módulo atribui causa às diferenças regionais.

## 6. Pedidos ao integrador

1. `ckan.PORTAIS` não inclui o portal do MME (https://dadosabertos.mme.gov.br): o módulo faz o `package_show` e monta os metadados por conta própria para não editar `fontes/ckan.py`. Sugestão: acrescentar `"MME": "https://dadosabertos.mme.gov.br"` a `PORTAIS`.
2. Gold com 453 KB, acima da meta de cerca de 400 KB, por reunir quatro painéis com mapas e tabelas; o detalhe já foi para CSV e para `inclusao_sistemas_isolados_pontos.json` (sob demanda). A página deve passar a componentes cliente só os recortes exibidos.
3. `arquivos.json` e `metricas.json` foram regenerados por `executar_modulo.py`, como previsto; nenhum arquivo compartilhado foi editado.
4. Catálogo (`catalogo.py`/`datasets.ts`): registrar os conjuntos do REGISTRO do módulo (SCS, Beneficiários da CDE, série antiga descontinuada, custeio da CDE, Cadastro Único, POF 6715, coeficientes e microdados, PNAD 6737/6738/6731, PASI e Luz para Todos), com o estado "DESCONTINUADO NA FONTE; HISTÓRICO IDENTIFICADO" para a série antiga.
