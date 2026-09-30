# Módulo Conta de luz (P047 a P050)

Documento de método do módulo `conta` (rota `/setor-eletrico/conta-de-luz`, família de silver `aneel_tarifas`, ordem 42). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/conta.py` |
| Leitura das bases (ANEEL e IBGE) | `pipeline/energia/fontes/aneel_conta.py`, `pipeline/energia/fontes/ibge_conta.py` |
| Métricas (9 medidas) | `pipeline/energia/metricas/conta.py` |
| Testes (35, sem rede) | `pipeline/tests/test_energia_conta.py`, amostras reais em `pipeline/tests/dados/energia_conta/` |
| Gold | `public/energia/gold/conta.json` (cerca de 344 KB) |
| Downloads | `public/energia/series/conta_*.csv` (9 arquivos) |
| Leitura sob demanda | `public/energia/series/conta_historico_b1.json` (vigências e mudanças da tarifa B1 por distribuidora, 320 KB) |
| Tipos | `src/lib/energia/tipos-conta.ts` (usa `Evidencia` de `src/lib/energia/evidencia.ts`) |

Execução: `python3 pipeline/energia/executar_modulo.py conta` (coleta e gold) ou `--sem-coleta` (só gold, a partir do silver). A coleta completa levou 323 s em 30/09/2026 com pico de 691 MB de memória residente (leitura em fluxo do CSV de 89 MB de tarifas e do CSV de 77 MB de subsídios). O Parquet de componentes de 2025 (3 milhões de linhas) é descomprimido do bronze para arquivo temporário e lido em lotes de 200 mil linhas, só com as colunas usadas: 390 MB de pico. A gold sai do silver em cerca de 2 s.

Retomada após o reinício de 30/09/2026 (22h30 UTC): o silver `aneel_tarifas.db` tinha sido zerado no meio de uma recoleta. Tudo foi recoletado (vintages novas de 22h48 a 22h53 UTC; o bronze já tinha os mesmos arquivos, reaproveitados pelo sha256) e reprocessado com a versão de leitura `conta-3`.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P047 Tarifa e comparação | Tarifa de aplicação B1 residencial convencional (TE + TUSD, R$/MWh, sem tributos e sem bandeira) vigente em 30/09/2026 para 81 distribuidoras, com posição, base econômica ao lado, custo para perfis de 100, 200 e 300 kWh/mês; mediana e quartis; evolução mensal da mediana nominal e real (fev/2010 a set/2026); histórico por distribuidora em JSON; 34 distribuidoras fora do ranking listadas com motivo | Dados concluídos com limitação declarada: a tarifa média de fornecimento não é calculada (seção 5.3); 22 distribuidoras estão fora do ranking porque a vigência encerrou em 29/09/2026 e a tarifa seguinte ainda não está no arquivo. Página pendente |
| P048 Composição | Componentes oficiais da TE e da TUSD agrupados em energia, transmissão, distribuição (fio B), perdas, encargos e outros; parcelas conferidas contra a TE e a TUSD do próprio conjunto e do conjunto de tarifas; parcela das componentes CDE; mediana por grupo | Dados concluídos com limitação declarada: agrupamento é do observatório (PRORET 7.1 bloqueado); tributos e iluminação pública fora, sem fonte estruturada que os leve à tarifa de uma distribuidora (seção 5.3). Página pendente |
| P049 Simulador de consumo | TE e TUSD vigentes por distribuidora para residencial, Tarifa Social (faixas 01 e 02), Desconto Social (faixas 01 e 02), rural e demais classes; custo de disponibilidade; patamares de bandeira e bandeira de set/2026; regras com o texto oficial conferido a cada captura; fórmula e 100 casos de referência calculados no pipeline | Dados concluídos com limitação declarada: resultado é estimativa sem tributos e sem iluminação pública; o texto da REN nº 1.000/2021 não pôde ser lido (seção 5.2) e a regra do custo de disponibilidade vem das páginas oficiais da ANEEL. Página pendente |
| P050 Reajustes, bandeiras e subsídios | Mudanças da tarifa B1 por distribuidora com IPCA do mesmo intervalo; janelas de 12, 60 e 120 meses contra o IPCA; bandeiras acionadas de jan/2015 a set/2026 e tabela de adicionais; subsídios tarifários por categoria e ano (2013 a 2026); custeio da CDE por rubrica de despesa e receita (2013 a 2026), com a Tarifa Social separada dos descontos a categorias | Entregue em parte: o efeito médio de cada processo tarifário e o calendário oficial estão bloqueados (seção 5.1); o que se publica é a variação da tarifa B1 residencial, outra medida, com rótulo próprio. Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não existe, e P050 depende de recurso que a ANEEL não oferece a clientes automatizados.

## 2. Fontes verificadas (consulta em 30/09/2026)

| Fonte | Recurso usado | URL | Licença | Período e grão | Publicação pela fonte (last_modified) |
| --- | --- | --- | --- | --- | --- |
| ANEEL, Tarifas de aplicação das distribuidoras (S9) | `tarifas-homologadas-distribuidoras-energia-eletrica.csv` (89.235.715 bytes, sha256 `420b3139...`); o XML do mesmo pacote (322 MB) tem o mesmo conteúdo e não é usado | https://dadosabertos.aneel.gov.br/dataset/tarifas-distribuidoras-energia-eletrica | ODbL | vigências de fev/2010 a 2027; distribuidora (CNPJ) × subgrupo × modalidade × classe × subclasse × detalhe × posto × base × unidade × vigência × resolução; 328.293 linhas | 30/09/2026 10:01 (portal declara frequência semanal; o dicionário diz mensal) |
| ANEEL, dicionário de tarifas | `dd-tarifas-por-distribuidora.pdf`, versão 1.0 de 15/03/2022 | mesmo pacote | ODbL | cinco nomes de campo diferentes do cabeçalho real (`DscResolucaoHomologatoria` é `DscREH`; `DscBaseTarifa` é `DscBaseTarifaria`; `DscSubgrupo` é `DscSubGrupo`; `DscUnidade` é `DscUnidadeTerciaria`; `VlrTusd`/`VlrTe` são `VlrTUSD`/`VlrTE`); o parser segue o cabeçalho real e para se ele mudar | 12/06/2026 |
| ANEEL, Componentes Tarifárias (S6, parte aberta) | `componentes-tarifarias-2012.parquet` a `-2026.parquet` (Parquet oficial, mesmo conteúdo dos CSV anuais de 200 a 830 MB) e `dm-componentes-tarifarias.pdf` | https://dadosabertos.aneel.gov.br/dataset/componentes-tarifarias | ODbL | vigências de fev/2012 a 2027; processo × componente, R$/MWh; 18,6 milhões de linhas lidas, 78.392 no recorte B1 residencial de aplicação | 26 e 27/09/2026 |
| ANEEL, Bandeiras Tarifárias (S6) | `Bandeira Tarifária - Acionamento` (141 meses) e `Bandeira Tarifária - Adicional` (27 linhas, 10 resoluções) e os dois dicionários; o recurso `Conta Bandeira` não é usado | https://dadosabertos.aneel.gov.br/dataset/bandeiras-tarifarias | ODbL | jan/2015 a set/2026, mensal, SIN | acionamento 28/09/2026 08:00; adicional 15/07/2026 |
| ANEEL, Subsídios Tarifários (S13) | `subsidios-tarifarios.csv` (77.498.920 bytes) e dicionário versão 1.0 de 01/03/2023 | https://dadosabertos.aneel.gov.br/dataset/subsidios-tarifarios | ODbL | fev/2013 a jul/2027 (competências futuras já homologadas); distribuidora × mês × montante (previsão, ajuste, total) × categoria; 319.040 linhas | 11/09/2026 11:44 |
| ANEEL, CDE: custeio dos benefícios tarifários | `cde-custeio-beneficios-tarifarios.csv` (373 linhas) e dicionário versão 2.0 de 29/07/2022 | https://dadosabertos.aneel.gov.br/dataset/conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios | ODbL | 2013 a 2026, ano × rubrica de despesa ou receita, R$ | 01/09/2026 05:02 |
| IBGE, IPCA (S23) | SIDRA tabela 1737, variáveis 2266 (número-índice, dez/1993 = 100) e 2265 (variação acumulada em 12 meses) | https://apisidra.ibge.gov.br/values/t/1737/n1/all/v/2266,2265/p/all?formato=json | dados públicos do IBGE, com citação | dez/1979 a ago/2026, mensal | a API não informa data de publicação |
| Lei nº 15.235/2025 (Tarifa Social e Desconto Social) | publicação original no portal da Câmara dos Deputados; 5 trechos conferidos a cada captura | https://www2.camara.leg.br/legin/fed/lei/2025/lei-15235-8-outubro-2025-798121-publicacaooriginal-176682-pl.html | texto de lei (Lei nº 9.610/1998, art. 8º, IV) | vigente em 30/09/2026 | página |
| ANEEL, páginas Tarifa Social, Micro e Minigeração Distribuída, Bandeiras Tarifárias, Custo da energia | HTML guardado no bronze; 10 trechos conferidos a cada captura | https://www.gov.br/aneel/pt-br/assuntos/tarifas/tarifa-social e demais em `NORMAS` | CC BY-ND 3.0 (rodapé gov.br) | texto | página |

Cada arquivo está no bronze com sha256 (`data/energia/bronze/aneel/aneel_*`, `data/energia/bronze/ibge/ibge_ipca`, `data/energia/bronze/camara-dos-deputados/normas_conta`, `data/energia/bronze/aneel/normas_conta`) e vintage no silver `data/energia/silver/aneel_tarifas.db`. Recoleta: conjuntos da ANEEL a cada 7 dias ou quando o `last_modified` muda, IPCA a cada 3 dias, normas a cada 7 dias; arquivo idêntico não vira vintage nova. Dicionários em PDF ficam no bronze como evidência e foram lidos com `pdftotext`.

## 3. Método

### 3.1 Recorte das tarifas

Das 328.293 linhas, entram 27.121: subgrupos B1, B2 e B3, modalidade convencional, detalhe, posto e acessante "Não se aplica", base "Tarifa de Aplicação" ou "Base Econômica", unidade MWh. Saem, contadas no universo publicado: 193.929 de outros subgrupos, 98.075 de outras modalidades, 9.168 com detalhe específico (SCEE, APE). A unidade é conferida linha a linha: linha em kW não é convertida, fica fora e é contada (nenhuma no recorte em 30/09/2026). Tarifa de aplicação e base econômica ficam em séries separadas e nunca se misturam.

`VlrTE` e `VlrTUSD` publicados como `,00` nas duas parcelas da mesma linha são tarifa não homologada para a subclasse (ocorre em cooperativas antigas): o valor fica no silver como zero publicado, mas não entra em comparação. Vazio é ausência.

### 3.2 Vigência e sobreposição

Início e fim de vigência são inclusivos. A fonte publica vigências sobrepostas (274 casos no recorte, 16 na tarifa B1 residencial de aplicação): o mesmo ato repetido com fins diferentes (Ceraçá, 2025) ou dois atos para o mesmo período (CEA, 2021). Regra publicada: vence a vigência de início mais recente; empate, o ato mais recente (pela data do ato lida do texto da resolução); empate, a vigência mais curta. Valores iguais não são conflito. Cada caso fica em `conflitos_fonte` e no CSV `conta_conflitos_fonte.csv`, com a escolha feita e as alternativas. A linha do tempo resolvida une pedaços contíguos com o mesmo ato e valor e preserva lacunas (nunca repete a vigência anterior).

Data de referência: data civil de Brasília (o executor passa a data UTC, que entre 21h e 24h já é o dia seguinte).

### 3.3 Comparação por perfil (P047)

`total = TE + TUSD` (R$/MWh) da vigência que cobre a data; `custo_perfil(kWh) = kWh × total ÷ 1000`. Perfis de 100, 200 e 300 kWh/mês são referências do observatório, não consumo médio. Os três ficam acima do maior custo de disponibilidade (100 kWh na ligação trifásica), que não altera nenhum perfil. Mediana e quartis (quantil tipo 7) entre distribuidoras, sem ponderação por consumidores. A evolução mensal usa a tarifa vigente no dia 1º de cada mês; a mediana só é calculada nos meses com pelo menos 80% do maior número mensal de distribuidoras com tarifa (84 de 105), porque o arquivo começa em fev/2010 com poucas empresas; valor real em reais do último mês com IPCA (`nominal × I(último) ÷ I(mês)`), vazio sem índice.

### 3.4 Composição (P048)

Componentes do conjunto oficial para a mesma distribuidora, ato e vigência da tarifa exibida, base de aplicação, R$/MWh. Grupos pelo código (classificação do observatório): energia (`TE_ENERGIA`, `TE_ANGRA`), transmissão e conexão (rede básica, fronteira, CUSD, conexões, transporte e TUST de Itaipu), distribuição (`TUSD_FioB`), perdas (técnicas, não técnicas, rede básica, receitas irrecuperáveis), encargos (CDE, Proinfa, TFSEE, P&D, ONS, RGR, CCC, ESS e reserva, CFURH), outros (subsídios, benefício da Lei nº 14.299/2022, liminares). Código novo sem grupo vai para "outros" e é listado. Os totais `TE` e `TUSD` do conjunto não entram nos grupos: nada é somado por fora da tarifa. Conferências: soma das parcelas = TE e TUSD do próprio conjunto (0,01 R$/MWh, porque as parcelas têm nove casas e os totais duas) e TE e TUSD do conjunto de componentes = TE e TUSD do conjunto de tarifas (0,005 R$/MWh). A parcela CDE (soma dos códigos com CDE no nome) é subconjunto dos encargos e aparece à parte, sem ser somada. Repetições da mesma componente, vigência e ato dentro do arquivo anual são contadas: 192 iguais e 13 com valor diferente (arquivo de 2022; vale a última linha).

### 3.5 Simulador (P049)

Fórmula publicada: `total = Σ faixas (kWh da faixa × (TE + TUSD) da faixa ÷ 1000) − descontos + kWh sujeitos à bandeira × adicional ÷ 1000`, sempre rotulada como estimativa sem ICMS, PIS/Pasep, Cofins e contribuição de iluminação pública.

* Residencial, rural (B2) e demais classes (B3): energia faturada = maior entre consumo e mínimo da ligação (30, 50 ou 100 kWh em ligação monofásica, bifásica ou trifásica, conforme a página oficial da ANEEL sobre micro e minigeração distribuída).
* Tarifa Social (Lei nº 12.212/2010, art. 1º, na redação da Lei nº 15.235/2025, conferida no texto): 100% de desconto até 80 kWh/mês e 0% acima, sobre a tarifa homologada da subclasse (faixas 01 e 02; a ANEEL informa que beneficiários não pagam CDE nem Proinfa). Sem custo de disponibilidade até 80 kWh, inclusive em ligação trifásica (página oficial da ANEEL). Bandeira só sobre a parcela acima de 80 kWh (leitura da página da ANEEL, declarada).
* Desconto Social (Lei nº 10.438/2002, art. 13, § 3º-I, incluído pela Lei nº 15.235/2025, desde 01/01/2026): faixa 01 até 120 kWh e faixa 02 acima, com as tarifas homologadas das duas faixas (leitura por parcela, declarada).
* Tarifas por subclasse publicadas na vigência: residencial 81 distribuidoras, Tarifa Social 81, Desconto Social 80, rural 81, demais 81. Classe sem tarifa devolve simulação indisponível com motivo; nunca se usa tarifa de outra classe.
* Cada regra está ligada a uma norma cuja página é recapturada e cujos trechos são conferidos (5 normas, 15 trechos, todos presentes em 30/09/2026). Trecho ausente numa captura futura rebaixa a regra para "não reconferida".

### 3.6 Reajustes e inflação (P050)

Evento = início de pedaço da linha do tempo resolvida com pedaço anterior contíguo (mudança de valor ou de ato). Variação = `total_depois ÷ total_antes − 1`, também para TE e TUSD. IPCA do evento: razão dos números-índice do mês anterior à data do evento anterior e do mês anterior à data do evento. Janelas de 12, 60 e 120 meses terminadas no último mês com IPCA (ago/2026): tarifa vigente no último dia do mês inicial e do mês final, IPCA pela razão dos índices dos mesmos meses, variação real `(1 + variação) ÷ (1 + IPCA) − 1`. Distribuidoras sem tarifa numa das datas ficam fora e são contadas. A contagem acima e abaixo do IPCA usa valores não arredondados. Não é o efeito médio do processo tarifário, que pondera todas as classes e tensões (seção 5.1).

### 3.7 Bandeiras

Bandeira e valor por mês de competência como publicados; adicionais por resolução e vigência. O campo do adicional se chama `VlrAdicionalBandeiraRSMWh` e o dicionário o descreve como reais por kWh, mas os valores são R$/MWh: 18,85 da amarela é R$ 0,01885/kWh, como na página oficial da ANEEL (trecho conferido). Conferência acionamento × tabela: 131 de 141 meses conferem; 3 meses sem resolução correspondente na tabela (jan a mar/2015) e 7 com valor diferente do adicional da tabela vigente (set/2015 a jan/2016, nov/2017, abr/2022), listados em `bandeiras.conferencia`; o conjunto não traz resolução que explique a diferença. Mês não publicado não é preenchido.

### 3.8 Subsídios tarifários

Soma, por ano de competência, do montante `Total` (previsão + ajuste) por categoria, todas as distribuidoras; a linha de categoria `Total` publicada só confere. Competências posteriores ao mês de referência (homologadas para o futuro) ficam fora e são contadas. Anos com menos de 12 meses são parciais (2013 e 2026). Definições das categorias do dicionário da ANEEL; `SCEE` e `Lei 14.299/2022` não estão no dicionário e são descritas com essa ressalva. Repasses da CDE às distribuidoras por descontos a categorias de usuários: não são transferências a famílias; a Tarifa Social não integra o conjunto.

### 3.9 Custeio da CDE (quem financia)

Rubricas de despesa e de receita por ano como publicadas, nome aparado (`RGR ` com espaço, de 2023 a 2026, e `RGR`, de 2013 a 2022, são a mesma rubrica). Grupos pelo nome: Tarifa Social (`Subsídio Baixa Renda`), descontos tarifários (demais `Subsídio ...`), CCC e Luz para Todos, outras despesas; quotas da CDE (`Quotas CDE Uso`, `Quotas CDE Energia`, `Quotas CDE - GD`) e outras receitas. Participação das quotas = quotas ÷ receitas do ano; da Tarifa Social = rubrica ÷ despesas do ano. Rubrica publicada sem valor (14 casos) fica sem valor e é listada no ano, nunca vira zero. Identidade conferida: despesa = receita em todos os 14 anos (R$ 1). O ano corrente tem valores antes de terminar, o que indica valores orçados; o dicionário (que descreve o campo como custeio da Tarifa Social, embora o arquivo traga todas as rubricas) não diz se os anos anteriores são orçamento ou execução.

### 3.10 Identidade e ausência

Chave de distribuidora: CNPJ de 14 dígitos (`entidades.cnpj`; o Parquet de componentes publica o CNPJ como inteiro, sem zeros à esquerda). Mudança de sigla com o mesmo CNPJ não quebra a série (RGE SUL passou a RGE em 2019). A sigla "Não Informado" publicada para o CNPJ 89435598000155 é trocada pela sigla do mesmo CNPJ no conjunto de subsídios (Creral), com registro em `siglas_substituidas`. Nada é ligado por nome. Ausência, zero publicado e não se aplica são estados distintos em todas as camadas; CSV com vazio para ausência.

### 3.11 Validação antes de publicar

`valida_gold`: CNPJ único no ranking, tarifa positiva, data de referência não posterior à geração, adicional de bandeira e índice de preços não negativos (violação crítica vira stub e a sentinela mantém a gold anterior); parcela negativa, tarifa fora de 200 a 3.000 R$/MWh, participação fora de −100% a 200% e ano da CDE que não fecha viram ressalva visível em `validacao.ressalvas` (nenhuma em 30/09/2026). Valor atípico é mantido e conferido no arquivo original (seção 4).

### 3.12 Evidências

Sete números têm evidência "Comprove este número" montada e validada por `pipeline/energia/evidencia.py`: mediana da tarifa B1 (`tarifas.evidencia_mediana`), participação dos encargos na distribuidora de referência (`composicao.evidencia`), caso do simulador (`simulador.evidencia`), mediana da variação em 12 meses (`reajustes.evidencia`), bandeira do mês (`bandeiras.evidencia`), subsídios do último ano completo (`subsidios.evidencia`) e participação das quotas no custeio da CDE (`financiamento_cde.evidencia`). Listas com mais de 50 chaves apontam para o CSV completo (manifesto).

## 4. Evidências de aceite (conferidas em 30/09/2026)

Releitura independente dos arquivos do bronze com o módulo `csv` e `Decimal` (script fora do módulo, mesmo resultado repetido nos testes com amostras reais):

| Número | Entidade e período | Gold | Fonte (releitura) | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| TE, TUSD, total B1 | CEMIG-D, vigência 28/05/2026 a 27/05/2027 (REH 3.589/2026) | 310,21; 593,08; 903,29 R$/MWh; 61ª de 81 | `"310,21"`, `"593,08"`, MWh | 0 | exata (duas casas publicadas) |
| Menor tarifa B1 | DMED, vigência até 17/11/2026 (REH 3.548/2025) | 617,57 R$/MWh (221,14 + 396,43) | 221,14 + 396,43 | 0 | exata |
| Maior tarifa B1 | CERES, vigência 29/04/2026 a 28/04/2027 (REH 1.454/2026) | 1.569,23 R$/MWh (405,56 + 1.163,67) | 405,56 + 1.163,67 | 0 | exata; valor atípico mantido e conferido |
| Variação B1 em 12 meses | CERAL Anitápolis, 31/08/2025 a 31/08/2026 | 34,49% | (780,93 + 220,97) ÷ (553,82 + 191,14) − 1 = 34,49% | 0 | 0,005 ponto percentual (arredondamento) |
| Encargos na tarifa B1 | CERIPa (referência da mediana), vigência 29/04/2026 (REH 1.462/2026), Parquet de 2026 | 21,6% (177,6699 ÷ 821,18) | 177,669851535 ÷ (647,17 + 174,01) = 21,6359% | 0 | exata (releitura com filtro próprio do pyarrow) |
| TE e TUSD nos dois conjuntos | 80 distribuidoras com componentes para o ato vigente | 80 conferidas, 0 divergentes, 1 sem componentes (ELFSM) | conjunto de componentes | 0 | 0,005 R$/MWh por parcela |
| Custeio da CDE 2026 | despesas e receitas | R$ 52.660.050.883 nos dois lados; quotas 96,4% | despesas 52.660.050.882,84; receitas 52.660.050.882,84; quotas 50.743.043.602,87 (96,3597%) | 0,16 (arredondamento a reais) | R$ 1 |
| Subsídios 2025 | todas as distribuidoras, 12 competências | R$ 18.818.338.552 (categorias) = linha Total | categorias 18.818.338.552,49; linha Total 18.818.338.552,49 | 0 | R$ 1 |
| Bandeira de set/2026 | SIN | Amarela, 18,85 R$/MWh | `2026-09-01;Amarela;18,85`; página da ANEEL: R$ 0,01885/kWh | 0 | 0,005 R$/MWh |
| IPCA 12 meses até ago/2026 | Brasil | razão de índices 4,2234%; publicado 4,22% | 7.633,23 ÷ 7.323,91 − 1; variável 2265 = 4,22 | 0,0034 ponto percentual | 0,01 ponto percentual (publicação com duas casas) |

Resultados principais em 30/09/2026 (para conferência da interface, não para fixar em código): mediana B1 de R$ 0,8212/kWh (821,18 R$/MWh; quartis 759,75 e 903,29) em 81 distribuidoras; perfil de 200 kWh na mediana, R$ 164,24 sem tributos e sem bandeira; composição mediana de 271 R$/MWh de energia, 93 de transmissão, 268 de distribuição, 57 de perdas e 172 de encargos, dos quais 139,5 R$/MWh (16,8%) em componentes CDE; variação mediana de 11,18% em 12 meses contra IPCA de 4,22% (87 de 102 distribuidoras acima), 36,17% em 60 meses contra 29,90% e 81,78% em 120 meses contra 61,15%; CDE de R$ 52,7 bilhões em 2026, 96,4% das receitas em quotas, 19,8% das despesas na Tarifa Social.

Testes: `python3 -m unittest pipeline.tests.test_energia_conta` (35 testes, OK). Cobrem: variantes reais do campo de ato; recorte e motivos de exclusão; unidade kW não convertida; cabeçalho diferente falha alto; reconciliação da CEMIG-D com releitura do CSV; zero publicado e ausência distintos (CERES 2010, CERNHE sem sucessora); sobreposição (Ceraçá e CEA); mudança de sigla com mesmo CNPJ (RGE); valor extremo mantido (Ceraçá, 951,42 R$/MWh); componentes somando TE e TUSD de outro conjunto; leitura do Parquet em lotes igual à leitura inteira; parcela CDE contra releitura do Parquet; simulador com mínimo, bandeira, Tarifa Social, Desconto Social e classe sem tarifa; adicionais contra a página oficial; IPCA pela razão de índices contra o publicado; data civil de Brasília; subsídios com competência futura e divergência real de 2017; custeio da CDE com releitura em `Decimal` (identidade, quotas, rubrica sem valor, rubrica aparada); gold de ponta a ponta com as sete evidências validadas por `evidencia.validar`, histórico fora da gold e validação física (crítica vira stub, atípico vira ressalva). `npx tsc --noEmit` sem erro nos arquivos do módulo.

## 5. Limitações, bloqueios e o que não se pode concluir

### 5.1 Efeito médio dos processos tarifários (P050): bloqueado

O efeito médio para o consumidor de cada reajuste ou revisão, o tipo do processo e o calendário oficial estão em `calculostarifarios.aneel.gov.br/lista-publica` (memórias de cálculo) e em `git.aneel.gov.br/publico/centralconteudo/.../2026_Processos_Tarifarios.xlsx` (calendário), ligados pela página https://www.gov.br/aneel/pt-br/calendario-de-atividades/processos-tarifarios. Em 30/09/2026 os dois responderam HTTP 403 com a página "Just a moment..." e o desafio de navegador do Cloudflare (`cf_chl`), assim como `www2.aneel.gov.br/cedoc` e `leis.org/aneel`. O desafio não foi contornado. O portal de dados abertos não tem conjunto equivalente (busca por "reajuste", "processos tarifários", "efeito médio" e "tarifa média" no `package_search`). Os painéis Power BI da página de relatórios ("Índices de reajuste das tarifas residenciais", "Componentes da tarifa residencial") não oferecem arquivo. O módulo publica a variação da tarifa B1 residencial entre vigências, com o rótulo "não é o efeito médio", e o conjunto não informa se o ato é reajuste, revisão periódica ou extraordinária.

### 5.2 Texto das normas regulatórias

A REN nº 1.000/2021 (custo de disponibilidade) e o PRORET (submódulos 7.1, componentes, e 6.8, bandeiras) não puderam ser lidos: `www2.aneel.gov.br/cedoc` e `git.aneel.gov.br` com desafio do Cloudflare; `www.in.gov.br` (Diário Oficial) respondeu com erro de protocolo HTTP/2 e resposta vazia em HTTP/1.1. As regras usadas vêm das páginas oficiais da ANEEL e do texto da Lei nº 15.235/2025, com trechos conferidos a cada captura. Consequências: o custo de disponibilidade segue a divisão monofásico, bifásico e trifásico da página da ANEEL, sem o detalhe de condutores da REN; a regra do mínimo na Tarifa Social acima de 80 kWh, a bandeira na Tarifa Social e o Desconto Social por parcela são leituras declaradas no simulador; o agrupamento das componentes é do observatório.

### 5.3 Tarifa média de fornecimento e tributos

Não há base oficial estruturada com alíquotas efetivas de ICMS, PIS/Pasep e Cofins e contribuição de iluminação pública por distribuidora e mês; esses itens ficam fora de todos os números, declarados em `composicao.excluidos` e no rótulo do simulador. Alternativa tentada: o conjunto SAMP (https://dadosabertos.aneel.gov.br/dataset/samp) traz receita, energia, ICMS e PIS/Cofins faturados por distribuidora, classe e mês, o que daria a tarifa média de fornecimento e a carga tributária observada. A leitura do `samp-2025.parquet` mostrou valores declarados com erro de ordem de grandeza em meses isolados (CEMIG-D, classe residencial convencional, mercado regular cativo: receita de energia de R$ 7,09 bilhões em jul/2025 e R$ 7,92 bilhões em out/2025, contra cerca de R$ 0,7 bilhão nos demais meses; ICMS de R$ 1,61 bilhão em jun/2025 contra cerca de R$ 0,16 bilhão), e o dicionário não define as linhas de `DscDetalheMercado`. Sem regra de tratamento de atípicos validada contra fonte independente, a tarifa média não é publicada.

### 5.4 Cobertura e comparabilidade

* 22 distribuidoras (em geral cooperativas com aniversário em 30/09) tiveram a vigência encerrada em 29/09/2026 e a tarifa seguinte não está no arquivo gerado pela ANEEL em 30/09/2026 (a vigência mais recente iniciada no arquivo é de 22/09/2026); ficam fora do ranking, listadas com a última tarifa. Por isso a mediana de 30/09 (821,18 R$/MWh, 81 distribuidoras) é maior que a mediana de 01/09 na evolução (795,97 R$/MWh, 102 distribuidoras). 12 outras estão sem tarifa há mais de 90 dias (incorporações e trocas de CNPJ que o conjunto não explica).
* A mediana entre distribuidoras não representa o consumidor médio do país (não é ponderada por consumidores) e o conjunto de distribuidoras muda ao longo do tempo.
* Custo por perfil e simulador não são conta final: sem tributos, sem iluminação pública, sem bandeira nos perfis.
* Subsídios: valores homologados, não desembolso realizado; 125 de 16.802 pares distribuidora-mês têm categorias que não somam a linha Total (todos entre 2013 e 2020; maior diferença de R$ 17,8 milhões, CNPJ 08336783000190 em 2020) e 376 de 102.540 comparações em que Total difere de previsão + ajuste. O ano exibido usa a soma das categorias. O custeio da CDE e os subsídios tarifários não se somam: um é o valor anual da conta por rubrica, o outro são repasses mensais por distribuidora.
* Bandeiras não se aplicam a sistemas isolados.
* PLD vezes consumo não é conta de luz; a diferença entre PLD e tarifa não é margem da distribuidora (a tarifa remunera energia contratada a prazo, transmissão, distribuição, perdas e encargos).

## 6. Pedidos ao integrador

1. Executor (`run.py` e `executar_modulo.py`): `ctx["hoje"]` é a data UTC (`comum.agora_date`). Para regras de vigência a data certa é a civil de Brasília; o módulo converte quando recebe a data UTC de hoje, mas seria melhor o executor passar `hoje` em America/Sao_Paulo para todos os módulos.
2. Catálogo: o conjunto `conta-desenvolvimento-energetico-cde-custeio-dos-beneficios-tarifarios` é registrado pelos módulos Conta de luz e Inclusão com o mesmo `dataset_silver` (`aneel_cde_custeio`) em famílias diferentes (`aneel_tarifas` e a do módulo Inclusão). `modulos.datasets_integrados` guarda a família do último módulo; a página Dados deve mostrar as duas golds.
3. Interface (fase 2): a página deve carregar `public/energia/series/conta_historico_b1.json` sob demanda (seleção de distribuidora) e reproduzir `simulador.casos_referencia` com a fórmula publicada (teste em `src/tests/energia-conta.test.ts`, a escrever).
4. Rede: a liberação de `calculostarifarios.aneel.gov.br` e `git.aneel.gov.br` para clientes automatizados (ou a publicação do efeito médio e do calendário dos processos no portal de dados abertos) destravaria P050 por inteiro; o mesmo vale para `www2.aneel.gov.br/cedoc` (REN nº 1.000/2021).
