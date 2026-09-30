# Módulo Qualidade do serviço de distribuição (P051 a P054)

Documento de método do módulo `qualidade` (rota `/setor-eletrico/qualidade`, família de silver `aneel_qualidade`, ordem 41). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/qualidade.py` |
| Leitura e agregação das bases da ANEEL | `pipeline/energia/fontes/aneel_qualidade.py` |
| Métricas (14 medidas) | `pipeline/energia/metricas/qualidade.py` |
| Testes (39, sem rede) | `pipeline/tests/test_energia_qualidade.py`, amostras reais em `pipeline/tests/dados/energia_qualidade/` |
| Gold | `public/energia/gold/qualidade.json` (cerca de 382 KB) |
| Downloads | `public/energia/series/qualidade_*.csv` (11 arquivos, todos abaixo de 5 MB) |
| Leitura sob demanda | `public/energia/series/qualidade_mapa.json` (mapa municipal compacto, 207 KB) |
| Tipos | `src/lib/energia/tipos-qualidade.ts` (usa `Evidencia` de `src/lib/energia/evidencia.ts`) |

Execução: `python3 pipeline/energia/executar_modulo.py qualidade` (coleta e gold) ou `--sem-coleta` (só gold, a partir do silver, cerca de 19 s e 490 MB de pico). A coleta completa, com a importação dos três Parquets de continuidade, levou 570 s em 30/09/2026 com pico de 1.788 MB de memória residente (lote de 500 mil linhas; o lote passou a 200 mil depois dessa medição). Os Parquets são descomprimidos do bronze para arquivo temporário e lidos em lotes, só com as colunas usadas; CSV grandes (Ouvidoria, 58 a 110 MB por ano) são lidos em fluxo. Recoletas posteriores só baixam o que mudou (`last_modified` ou idade acima de 20 dias; eventos, 7 dias) e só reimportam arquivo novo ou importado com regra anterior.

Retomada após o reinício de 30/09/2026 (22h30 UTC): o silver tinha os downloads e as importações da primeira rodada (continuidade 2010 a 2029, limites, compensações, IASC, manifestações) feitas com uma versão anterior do importador. O importador agora tem versão por tipo de arquivo; arquivo importado com regra anterior tem as suas linhas derivadas apagadas e refeitas (sem isso o `INSERT OR IGNORE` do silver mantinha o valor da regra antiga e a troca de método apareceria como revisão da fonte). Foram coletados o Parquet de 2000 a 2009, a Ouvidoria de 2023 a 2026, atendimento emergencial, eventos em situação de emergência, IndQual Município e as páginas do ranking de 2021 a 2025.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P051 Duração e frequência | DEC e FEC mensais por conjunto (3.146 conjuntos em 2025) de jan/2000 a ago/2026; DEC e FEC por distribuidora (CNPJ, 102 no ano de referência) e do Brasil, mensais e anuais, com a agregação ponderada por unidades consumidoras; ano de referência 2025 (último completo) e acumulado de jan a jun/2026 comparado só com os mesmos meses de 2025; parcelas (apurado, emergência, dia crítico, externa, ONS) de 2010 em diante; mapa municipal com o intervalo dos conjuntos que atendem cada município; unidade e expurgos explicados | Dados concluídos com limitação declarada: grão temporal mensal por conjunto, como prometido; o mapa é por atribuição de conjunto, não medição municipal (seção 5.4); 2000 a 2009 sem as parcelas atuais. Página pendente |
| P052 Realizado e limites | Limite anual por conjunto do mesmo ano de apuração; limite da distribuidora e do Brasil ponderado pelas UCs médias (regra da ANEEL, conferida); razões DEC ÷ limite e FEC ÷ limite; DGC calculado ao lado do DGC publicado no ranking; conjuntos acima do limite (811 de 3.146 em 2025, 25,8%; 23,0% das UCs); quantis, histograma da razão, matriz faixa de limite × faixa de razão, 25 maiores razões e 25 maiores DEC; histórico 2001 a 2025 | Dados concluídos com limitação declarada: 1 a 3 distribuidoras por ano divergem do DGC publicado acima de 0,01 (seção 4.1). Página pendente |
| P053 Compensações | Valor (R$ nominais) e quantidade de compensações por violação de DIC, FIC, DMIC, DICRI e DISE, por distribuidora, competência e tipo, 2011 a jun/2026 (último mês completo), unidades consumidoras e geradoras separadas; série mensal; concentração nas 5 maiores; valor por UC só como normalização | Dados concluídos com limitação declarada: a fonte informa a competência, não a data do crédito; quantidade é de ocorrências, não de consumidores; nenhum crédito individual é estimado. Página pendente |
| P054 Atendimento e resiliência | IASC por distribuidora (2006 a 2025, sem 2011) com amostra (29.624 entrevistas em 2025); reclamações no 1º e 2º nível da distribuidora (2023 a 2026) por mil UCs; reclamações na Ouvidoria Setorial da ANEEL (2023 a 2026) por 100 mil UCs; TMAE (2015 a ago/2026); eventos em situação de emergência (2026, 239 eventos); parcelas de emergência e dia crítico do DEC como medida de resiliência; escopos separados | Dados concluídos com limitação declarada: DER e FER (indicadores oficiais de reclamação da ANEEL) não estão em dados abertos e o portal que os mostra recusou conexão (seção 5.6); a base de eventos só existe a partir de 2026. Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não existe.

## 2. Fontes verificadas (consulta em 30/09/2026)

Cada arquivo está no bronze com sha256 (`data/energia/bronze/aneel/aneel_*`) e vintage no silver `data/energia/silver/aneel_qualidade.db`. Os dicionários em PDF ficam no bronze e foram lidos com `pdftotext`. Licença de todos os conjuntos CKAN: Open Data Commons Open Database License (ODbL), conforme `license_title` do `package_show`.

| Fonte | Recurso usado | URL | Período e grão | Publicação pela fonte (`last_modified`) |
| --- | --- | --- | --- | --- |
| ANEEL, Indicadores Coletivos de Continuidade (S8) | `indicadores-continuidade-coletivos-2000-2009.parquet` (17.577.940 bytes), `-2010-2019.parquet` (50.121.834), `-2020-2029.parquet` (30.197.991); os ZIP com CSV equivalentes não são baixados | https://dadosabertos.aneel.gov.br/dataset/indicadores-coletivos-de-continuidade-dec-e-fec | jan/2000 a ago/2026; conjunto × mês × sigla (DEC, FEC, NumCon e parcelas); 592.231, 371.820 e 247.261 conjunto-meses; 0 chaves repetidas com valor diferente | 05/09/2026 (05:06 a 05:16 UTC) |
| idem, limites | `indicadores-continuidade-coletivos-limite` (CSV, 25.865.955 bytes, vírgula decimal) | mesmo pacote | 1990 a 2032 (anos futuros definidos na revisão tarifária); conjunto × ano × DEC ou FEC; 263.389 limites; usados de 2000 em diante e só com o apurado do mesmo ano | 05/09/2026 05:27 |
| idem, compensações | `indicadores-continuidade-coletivos-compensacao-2010-2019.parquet` e `-2020-2029.parquet` (56 e 59 MB); o CSV de 2020-2029 (cerca de 1 GB) não é baixado | mesmo pacote | 2011 a ago/2026; conjunto × competência × sigla PG/QT + UC/UG + tensão + tipo; todas as siglas no padrão | 05/09/2026 |
| idem, dicionários | `dm-indicadores-continuidade.pdf`, `dm-indicadores-compensacao-continuidade.pdf` (versão 1.0 de 06/06/2022), `dm-02-indicadores-limite-continuidade.pdf` (versão 1.0 de 22/09/2022) e `dominio-indicadores.csv` | mesmo pacote | DEC em horas e centésimos de hora; FEC em número de interrupções e centésimos; `NumPeriodoIndice` = mês; frequência mensal | 12/06/2026 |
| idem, atributos dos conjuntos | `indicadores-continuidade-coletivos-atributos.csv` (72 MB) lido em fluxo para verificação, não integrado | mesmo pacote | 2008 a 2014 apenas (área, extensão de rede, consumo e UCs por classe, trimestral); não traz municípios | 05/09/2026 |
| ANEEL, ranking da continuidade (S16) | páginas HTML de 2021 a 2025 (tabelas de grande e pequeno porte, DGC com duas casas) | https://www.gov.br/aneel/pt-br/centrais-de-conteudos/relatorios-e-indicadores/distribuicao/ranking-de-continuidade/2025 (e /2021 a /2024) | ano × distribuidora; 46, 46, 45, 47 e 51 linhas; 2025 com a Nota Técnica nº 65/2026-STD/ANEEL | a página não informa data; conteúdo público do gov.br, reprodução com citação |
| ANEEL, página Qualidade do Fornecimento (S16) | texto conferido em 30/09/2026 | https://www.gov.br/aneel/pt-br/assuntos/distribuicao/qualidade-do-fornecimento-de-energia-eletrica | regras: interrupções de 3 minutos ou mais; "limites globais das distribuidoras, obtidos pela média dos limites dos conjuntos, ponderada pelos respectivos números de unidades consumidoras"; crédito da compensação "no prazo de até dois meses após o período de apuração" | página |
| ANEEL, IASC | `indice-aneel-satisfacao-consumidor` (CSV, 3.317.215 bytes) e dicionário | https://dadosabertos.aneel.gov.br/dataset/indice-aneel-de-satisfacao-do-consumidor-iasc | 2006 a 2025 (sem 2011); distribuidora × ano; índice, construtos, ordem na categoria e contagens de entrevistados por sexo | 26/06/2026 |
| ANEEL, Manifestações no 1º e 2º nível da distribuidora | `manifestacoes-1-2-niveis-distribuidora-2023.parquet` a `-2026.parquet` e dicionário versão 1.2 de 30/07/2026 | https://dadosabertos.aneel.gov.br/dataset/manifestacoes-no-1o-e-2o-niveis-da-distribuidora | 2023 a 2026 (2026 parcial); distribuidora × município × mês × nível × tipologia | 26/09/2026 |
| ANEEL, Ouvidoria Setorial | `ouvidoria-aneel-2023.parquet` (o Parquet de 2023 foi conferido com o CSV do mesmo ano: 603.640 linhas e as mesmas somas por categoria, 213.947 reclamações); `ouvidoria-aneel-2024`, `-2025`, `-2026` em CSV, único formato publicado | https://dadosabertos.aneel.gov.br/dataset/ouvidoria-setorial-aneel | 2023 a set/2026; distribuidora × município × dia × categoria × decisão | 21/07/2026 (2023, 2024) e 30/09/2026 (2025, 2026) |
| ANEEL, Atendimento às Ocorrências Emergenciais | `indicador-atendimento-emergencial.parquet` (18 MB; o CSV tem 622 MB) | https://dadosabertos.aneel.gov.br/dataset/atendimento-ocorrencias-emergenciais | usado de 2015 a ago/2026; conjunto × mês × TMP, TMD, TME, NumOcorr, Nie, NDIACRI | 05/09/2026 |
| ANEEL, Evento Situação de Emergência | `evento-situacao-emergencia-2026.csv` (253 linhas) | https://dadosabertos.aneel.gov.br/dataset/evento-situacao-de-emergencia | dez/2025 a jul/2026; evento × competência | 15/08/2026 |
| ANEEL, IndQual Município (S22) | `indqual-municipio` (CSV, Latin-1) e dicionário versão 1.0 de 01/06/2022 | https://dadosabertos.aneel.gov.br/dataset/indqual-municipio | relação conjunto × município sem vigência; 42.699 pares, 5.574 códigos | 09/09/2026 |

Fontes procuradas e não integradas: DER e FER (duração e frequência equivalentes de reclamação por mil UCs, indicador oficial da ANEEL) aparecem só no portal `portalrelatorios.aneel.gov.br/hubDistribuicao/indicadorReclamacoes`, que respondeu "Connection reset by peer" em duas tentativas, e não há conjunto CKAN com eles (buscas por "DER", "reclamações" e "qualidade comercial"). Qualidade do Atendimento Comercial e INDGER (dados abertos da ANEEL) tratam de prazos de serviços e dados gerenciais, fora das perguntas destes painéis; ficam como candidatas. O arquivo de manifestações de 2010 a 2022 usa outra classificação e não é somado à série de 2023 em diante. A Ouvidoria de 2014 a 2022 existe e pode entrar numa extensão; não entrou para manter o mesmo período das manifestações.

## 3. Método

### 3.1 Unidades

DEC em horas e centésimos de hora por unidade consumidora (10,50 h são 10 h 30 min, nunca 10 h 50 min); FEC em interrupções e centésimos por unidade consumidora. Nenhuma etapa converte centésimos em minutos (teste `test_centesimos_de_hora_nao_sao_minutos`). Compensações em reais correntes da competência. TMAE em minutos. IASC de 0 a 100.

### 3.2 Agregação da distribuidora e do Brasil

O DEC de um agregado de conjuntos no mês é o DEC da união dos conjuntos: `DEC(g, m) = Σ_c DEC(c, m) × UC(c, m) ÷ Σ_c UC(c, m)`, com `UC(c, m)` = `NumCon` do conjunto no mês. O anual é a soma dos 12 meses. Conjunto sem DEC ou sem `NumCon` no mês fica fora do numerador e do denominador daquele mês, e a cobertura (UCs com DEC ÷ UCs com `NumCon`) é publicada. Ano só existe com os 12 meses; nunca se soma 11 meses como ano. Mês nacional completo: UCs com DEC ≥ 99% do máximo dos 12 meses anteriores (a fonte publica um mês antes de todas as distribuidoras enviarem: julho de 2026 tem 90.388.616 UCs contra 94.280.510 em junho). Idem para o FEC.

A chave da distribuidora é o CNPJ de 14 dígitos que a ANEEL publica em cada linha; o valor de um conjunto num ano fica com o CNPJ que o publicou naquele ano. Sigla e nome vêm do cadastro do mês mais recente em que o conjunto aparece, escolhido pelo mês de referência e não pela ordem de captura dos arquivos por década (teste `test_cadastro_pelo_mes_mais_recente_e_nao_pela_captura`).

### 3.3 Limites e distância ao limite

Limite anual do conjunto do mesmo ano de apuração (vigência). Limite da distribuidora e do Brasil: `L(g, ano) = Σ_c L(c, ano) × UCmédia(c, ano) ÷ Σ_c UCmédia(c, ano)`, só com conjuntos com dado no ano; a fração das UCs com limite é publicada (`cobertura_limite`). É a regra que a própria ANEEL descreve (seção 2) e a que reproduz o DGC publicado. Razão = apurado ÷ limite, calculada depois da agregação. DGC = média simples das razões de DEC e FEC, como no ranking. Conjuntos acima do limite: comparação estrita com os valores publicados em centésimos, contagem de conjuntos e fração das UCs ao lado; quantis, histograma e caudas mostram o que a média esconde.

### 3.4 Parcelas e expurgos

Parcelas publicadas desde 2010: IP e IND (internas, programada e não programada não expurgável), INE (situação de emergência), INC e IPC (dia crítico), XN, XP, XNC e XPC (origem externa), INO (racionamento ou alívio de carga pelo ONS). Cada parcela é agregada com a mesma ponderação, só com os conjuntos que a informaram no mês; o "DEC de todas as origens publicadas" soma todas as parcelas de cada conjunto que informou IP e IND. Desde 2022 o DEC apurado é exatamente IP + IND em 100% dos conjunto-meses (37.363 a 37.795 por ano). De 2010 a 2021 a identidade vale em 84,7% a 96,3% dos conjunto-meses; em 2021 os 1.482 divergentes têm todos DEC = IP + IND + XN + XP (apurado incluía as externas não críticas). XNC e XPC passaram de cerca de 100% das UC-mês informadas até 2021 para 15% desde 2022. De 2000 a 2009 a fonte publica outra desagregação (DECi, DECx, Decr, Dec1 e as do FEC), não integrada: parcelas nulas nesses anos.

### 3.5 Compensações

Siglas `PG` (valor pago, R$) e `QT` (quantidade) + `UC` ou `UG` + tensão (AT, MTU, MTNU, BTU, BTNU) + tipo (mensal sem sufixo, `T` trimestral, `A` anual, `DC` DICRI, `DS` DISE). Soma por distribuidora e competência (mês; AAAA-Tn para trimestral; AAAA para anual). Sigla fora do padrão seria contada e não somada (nenhuma em 30/09/2026). Trimestral e anual vêm com valor zero publicado desde 2022; DISE aparece em 2026; unidades geradoras a partir de 2018 (antes, `valor_ug` é ausência, não zero). Mês de compensação completo: distribuidoras que informaram ≥ 99% das que informaram nos 12 meses anteriores (último completo: jun/2026). Nenhum crédito individual é estimado: ele depende do DIC, FIC e DMIC de cada unidade e do encargo de uso, que não são publicados.

### 3.6 Atendimento e resiliência (P054)

* IASC: publicado por distribuidora, natureza ESTIMADO (pesquisa amostral); amostra = soma das contagens por sexo publicadas; resumo nacional só por quantis (sem média ponderada, que exigiria o desenho amostral).
* Manifestações: reclamação = grupo 102 da tipologia da REN 1.000/2021. Desde 2024 o código publicado já é o novo; o arquivo de 2023 ainda usa os códigos antigos, e alguns coincidem com códigos novos de outro sentido (em 2023 o código 101 é "Cobrança decorrente de religação à revelia", uma reclamação; na tipologia nova 101 é o grupo das informações). Em 2023 a classificação usa o `IdeTipoRCA`, identificador estável da tipologia segundo o dicionário, traduzido por tabela explícita extraída dos arquivos de 2024 a 2026 (131 correspondências únicas, em `fontes/aneel_qualidade.py`). Interrupção = 1020901, 1020902 e 1020903. Taxa = 1.000 × reclamações do ano ÷ UCs médias do mesmo CNPJ no mesmo ano; só com os 12 meses enviados pela distribuidora (mês não enviado é ausência). Nacional = Σ reclamações ÷ Σ UCs das mesmas distribuidoras; em 2025, 98 distribuidoras com 99,96% das UCs, 3 fora por meses faltantes (listadas).
* Ouvidoria Setorial: registro de solicitações; mês sem solicitação da distribuidora é zero registrado, mas distribuidora sem nenhuma solicitação no ano fica fora do agregado (zero e CNPJ não vinculado não se distinguem), com a cobertura em UCs publicada (99,4% em 2025). Taxa por 100 mil UCs só quando o arquivo cobre os 12 meses.
* TMAE = TMP + TMD + TME por conjunto e mês, agregado pela média ponderada pelo número de ocorrências com os três tempos informados.
* Eventos: um registro por (CNPJ, competência, código). O código é da distribuidora e se repete entre distribuidoras; evento que atravessa o mês aparece em mais de uma competência, às vezes com CHI parcial, às vezes com o mesmo CHI repetido, por isso nada é somado nem fundido. 253 linhas, 9 repetidas idênticas, 1 conflito (EDP ES, "ISE 02.2026", nível de contingência 3 e 2 na mesma competência; fica a última linha), 243 registros, 239 eventos. Duração = fim − início; data implausível fica sem duração, mantida como publicada e listada (Neoenergia Elektro com fim em 13/03/3036; CELESC, evento 78, sem início e fim).

### 3.7 Mapa (conjunto × município)

A base IndQual Município não tem vigência e acumula conjuntos de todas as épocas (São Paulo tem 201 conjuntos na base e 112 ativos em 2025). Valem só os conjuntos com DEC no ano de referência. Cada município recebe o menor e o maior DEC e FEC anuais desses conjuntos e a relação: conjunto exclusivo (31 municípios), conjunto compartilhado com outros municípios (1.179), vários conjuntos (4.347), sem conjunto ativo (17, entre eles 5 códigos sem nome na base). Nenhuma média municipal é calculada: a base não informa quantas UCs de cada conjunto estão em cada município.

### 3.8 Validação antes de publicar

`validar_dados` roda em toda construção e publica o resultado em `validacao`: DEC e FEC não negativos, DEC mensal abaixo de 744 h e anual abaixo de 8.784 h (horas do período), no máximo 12 meses por conjunto e ano, limites não negativos, último mês não posterior ao corrente, CNPJ de 14 dígitos, compensações não negativas, IASC entre 0 e 100. Reprovação crítica vira stub (a sentinela mantém a publicação anterior). Extremo raro vira ressalva, sem descarte: 548 conjunto-anos acima de 200 h, quase todos de 2000 a 2013, o maior o conjunto RURAL BENJAMIN CONSTANT (CEAM) em 2007 com 1.482,00 h, conferido no Parquet.

## 4. Evidências de aceite

### 4.1 DGC calculado × DGC publicado (caminho independente)

O DGC de cada distribuidora foi recalculado com as regras da seção 3 e comparado com o DGC publicado pela ANEEL nas páginas do ranking. Tolerância: 0,01 (o publicado tem duas casas; cada DEC e FEC mensal de conjunto também é publicado arredondado ao centésimo).

| Ano | Comparadas | Até 0,01 | Iguais em duas casas | Maior diferença | Divergentes (publicado × calculado) |
| --- | --- | --- | --- | --- | --- |
| 2021 | 45 | 44 | 39 | 0,21 | ELETROCAR 0,80 × 1,012 |
| 2022 | 45 | 43 | 39 | 0,44 | EQUATORIAL GO 1,10 × 1,536; COOPERALIANÇA 0,81 × 0,896 |
| 2023 | 44 | 42 | 37 | 0,08 | ELETROCAR 0,81 × 0,735; COOPERALIANÇA 1,11 × 1,193 |
| 2024 | 47 | 44 | 43 | 0,06 | CEEE 1,76 × 1,727; DEMEI 0,74 × 0,797; ELETROCAR 1,26 × 1,241 |
| 2025 | 51 | 50 | 47 | 0,09 | ELETROCAR 0,79 × 0,696 |

Casos de 2025 (gold × ranking): CPFL Santa Cruz 0,5396 × 0,54 (1º, grande porte); Energisa Minas Rio (MG e RJ) 0,7006 × 0,70; CEMIG 0,9125 × 0,91 (265 conjuntos, 9,43 milhões de UCs); Equatorial GO 0,9603 × 0,96; COCEL 0,9196 × 0,92; DCELT 1,0706 × 1,07; Cooperativa Aliança (um conjunto) 1,3638 × 1,36. A média simples dos conjuntos da CEMIG, sem pesos, erra o DGC em mais de 0,05 (teste). As divergências não foram explicadas caso a caso: revisão posterior dos indicadores, decisão judicial (o ranking de 2021 foi retificado por decisão judicial, conforme a página) ou limite diferente na nota técnica são hipóteses não verificadas. A evidência dos números nacionais leva a reconciliação com resultado "ressalva".

Todos os 109 nomes de empresa distintos publicados nas páginas de 2021 a 2025 foram ligados a CNPJ por tabela explícita (`CNPJ_RANKING`), sem semelhança de nome; cada CNPJ da tabela foi conferido nos indicadores de continuidade com a sigla correspondente (ex.: "COMPANHIA JAGUARI DE ENERGIA" → 53.859.112/0001-69, sigla CPFL JAGUARI, CPFL Santa Cruz no ranking).

### 4.2 Releitura do arquivo original por outro código

| Entidade e período | Gold ou parser | Fonte relida | Diferença |
| --- | --- | --- | --- |
| CEMIG, DEC 2025 | 8,976398059 h | junção DEC × NumCon com pyarrow e soma por mês no Parquet 2020-2029 | 0 (9 casas) |
| Cooperativa Aliança, conjunto IÇARA (14768), jan/2025 | DEC 0,40; FEC 0,44; NumCon 45.161 | leitura direta do Parquet | 0 |
| DCELT, conjunto 13109, DEC 2025 | 10,54 h | soma dos 12 meses com pyarrow | 0 |
| COCEL, conjunto 12306, DEC 2009 | 13,93 h | soma com pyarrow no Parquet 2000-2009 | 0 |
| COCEL, compensações 2025 | R$ 148.286,82 e 7.883 ocorrências | soma de todos os PG* e QT* de 2025 com pyarrow | 0 |
| COCEL, reclamações de interrupção 2023 (nível 1 e 2) | 34.535 e 48, pelo IdeTipoRCA | soma pela descrição publicada (`DscManifestacao`) | 0 |
| IASC 2025, total de entrevistas | 29.624 em 103 distribuidoras | ANEEL declara "cerca de 30.000 entrevistas" no conjunto de dados | coerente |
| Ouvidoria 2023 | Parquet: 603.640 linhas; 213.947 reclamações | CSV do mesmo ano lido em fluxo | 0 |

### 4.3 Conferência indicativa com o número nacional divulgado

Um trecho da notícia da ANEEL "ANEEL divulga os resultados do desempenho das distribuidoras na continuidade do fornecimento de energia elétrica em 2024", indexado por buscador em 30/09/2026, cita DEC de 10,24 h em 2024 e 10,42 h em 2023 e FEC de 4,89 e 5,15. A gold tem 10,28 h e 10,46 h, 4,91 e 5,18 (diferenças de 0,04 h e de 0,02 a 0,03 interrupção). A página da notícia passou a exigir autenticação (HTTP 302 para "Unauthorized"), então o valor não foi lido no original nem guardado no bronze: é conferência indicativa, não teste. A ponderação alternativa pelas UCs médias anuais dá o mesmo 10,29 h em 2024, o que descarta diferença de peso; revisão dos dados depois da divulgação é a hipótese mais simples, não verificada.

### 4.4 Testes

`python3 -m unittest pipeline.tests.test_energia_qualidade`: 39 testes, todos aprovados em 30/09/2026. Cobrem a reconciliação com o DGC de 2025 (6 distribuidoras, grande, pequena, multiestadual e de um conjunto), valores brutos e somas relidas do Parquet, soma anual e centésimos, mês ausente que não fecha o ano, `NumCon` ausente fora do numerador e do denominador, valor extremo preservado, identidade do apurado, parcelas que somam o total, vigência do limite, mudança societária pelo CNPJ, parser do ranking (DGC "-" é ausência, não zero), compensações por tipo e competência com zero publicado distinto de ausência, IASC e amostra, reclamações de 2023 pelo IdeTipoRCA contra a descrição, código antigo que não pode ser lido como novo, Ouvidoria, TMAE ponderado, série de 2009 sem parcelas atuais, eventos com código repetido entre distribuidoras e em duas competências, data de fim no ano 3036, cadastro pelo mês de referência, regra de importação nova que substitui a antiga, limites físicos que derrubam a publicação e extremo que vira ressalva. Os tipos TypeScript foram conferidos contra a gold e o JSON do mapa por `tsc` com um arquivo de checagem (com controle negativo) e `npx tsc --noEmit -p .` passa sem erro.

## 5. Limitações materiais e o que não se pode concluir

1. DEC e FEC são médias por unidade consumidora: não descrevem o tempo sem energia de cada pessoa. Parte das unidades fica muito acima da média do conjunto (por isso existem DIC, FIC e as compensações).
2. Valores apurados e enviados pelas distribuidoras; a ANEEL pode revisar meses publicados. Revisões entre capturas ficam no silver.
3. O apurado exclui interrupções expurgadas (emergência, dia crítico, externas, ONS). Em 2023 e 2024 o DEC de todas as origens publicadas foi cerca do dobro do apurado; comparar o apurado entre anos sem olhar as parcelas pode esconder eventos extremos.
4. O mapa atribui a cada município os valores dos conjuntos que o atendem; um conjunto cobre vários municípios e um município pode ter dezenas de conjuntos. Não é DEC medido no município e não permite ordenar municípios pela qualidade vivida.
5. 2000 a 2009: outra desagregação e outros critérios de expurgo; comparação de nível entre décadas com ressalva. 2010 a 2021: parte do apurado incluía XN e XP.
6. Reclamações dependem dos canais e da prática de registro; ligação sobre falta de energia é reclamação, então a taxa acompanha o número de interrupções. A série começa em 2023 e 2023 foi classificado pelo IdeTipoRCA.
7. DGC: 1 a 3 divergências por ano não explicadas (seção 4.1).
8. Eventos em situação de emergência: só 2026; evento declarado pela distribuidora.
9. Compensações em reais correntes; competência, não data de pagamento; quantidade de ocorrências, não de consumidores.

## 6. Pedidos ao integrador

Nenhum arquivo compartilhado foi alterado.

1. `base.escreve_gold` grava com `indent=1`: a gold deste módulo tem 382 KB assim e cerca de 277 KB sem indentação. Se o limite de 400 KB apertar, uma opção de gravação compacta resolveria sem cortar conteúdo.
2. `qualidade_mapa.json` fica em `public/energia/series/` e é escrito dentro de `construir` só depois das validações; a sentinela do `run.py` protege apenas a gold principal. Se a política for proteger também JSONs de séries, o mapa precisa entrar nela.
3. Primeira coleta completa: cerca de 10 min e pico de 1,8 GB de memória (Parquet de 2000 a 2009, 592 mil conjunto-meses em memória); recoletas mensais só reimportam arquivo novo. Convém não rodar este módulo em paralelo com outro de mesmo porte no Actions.
