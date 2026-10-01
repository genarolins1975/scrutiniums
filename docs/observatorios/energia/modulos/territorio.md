# Módulo Território: o que acontece na minha região (P002)

Rota: `/setor-eletrico/territorio` (página na fase de interface). Família de silver: `territorio` (`data/energia/silver/territorio.db`). Ordem no `run.py`: 97 (depois de todos os módulos cujas golds ele lê).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Índice territorial, coleta da conferência e gold | `pipeline/energia/modulos/territorio.py` |
| Áreas de carga do ONS: lista oficial e prova de pertença ao submercado | `pipeline/energia/fontes/ons_territorio.py` |
| Malha do IBGE: nomes, grafias antigas (DTB), ponto em polígono | `pipeline/energia/fontes/ibge_territorio.py` |
| Métricas | `pipeline/energia/metricas/territorio.py` (8 medidas próprias; as reapresentadas apontam para a métrica do módulo de origem) |
| Testes | `pipeline/tests/test_energia_territorio.py` (49 testes), amostras em `pipeline/tests/dados/energia_territorio/` |
| Gold | `public/energia/gold/territorio.json` (352 KB) |
| Sob demanda (mapa) | `public/energia/series/territorio_municipios.json` (1,0 MB) e `territorio_usinas.json` (2,7 MB), sem indentação |
| Downloads | `public/energia/series/territorio_{municipios,distribuidoras,conjuntos,usinas,areas_carga}.csv` |
| Tipos TS | `src/lib/energia/tipos-territorio.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py territorio` (conferência das áreas de carga quando a última tem 30 dias ou mais, e gold) ou `--sem-coleta` (só gold: 3 s, pico de 167 MB de memória residente). A coleta de dois dias de áreas de carga (68 consultas à API do ONS) levou cerca de 30 s.

## 1. Painel e estado

| Painel | Estado dos dados (esta fase) | Interface |
| --- | --- | --- |
| P002 Mapa geográfico transversal | Dados concluídos com limitação declarada. Índice dos 5.571 municípios do IBGE com: distribuidora(s) e estado do vínculo (relação oficial da ANEEL, via módulo Perdas); conjuntos elétricos (via Qualidade, valores de 2025 na tabela de conjuntos); submercado pela UF, com a pertença de cada área de carga do ONS provada pela carga verificada meia hora a meia hora; localidades em sistema isolado (PASI da EPE); indicadores municipais (MMGD, Tarifa Social, Luz para Todos, usinas declaradas só no município). Tabelas próprias para submercado (PLD, EAR, MMGD estimada pelo ONS), UF (capacidade, Tarifa Social, isolados), 123 distribuidoras (perdas, DEC e FEC, tarifa B1, MMGD, Tarifa Social) e 25.042 usinas do SIGA como pontos. Critério de aceite verificado na gold e no índice (seção 4.1). | Pendente (fase de interface): página, `MapaCoropletico` com as quatro camadas, URL, busca, painel lateral e tabela equivalente. O teste do critério de aceite na página fica para essa fase. Sem a página, o P002 não está concluído. |

O mapa geográfico complementa o mapa conceitual da página inicial (P001), não o substitui.

## 2. Fontes verificadas

O módulo não coleta indicador novo: lê as golds e os arquivos publicados pelos módulos de origem, cada um com a sua proveniência, e só coleta a carga por área de carga do ONS para provar o vínculo UF → submercado. O sha256 de cada arquivo lido fica em `insumos` na gold.

### 2.1 ONS, Carga de Energia Verificada (API por área de carga), coleta própria

* Conjunto: https://dados.ons.org.br/dataset/carga-energia-verificada (package_show consultado em 01/10/2026; `metadata_modified` 2025-10-01; licença Creative Commons Attribution, `cc-by`, com o aviso legal do portal).
* Recurso: API `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=AAAA-MM-DD&dat_fim=AAAA-MM-DD&cod_areacarga=XX`, uma consulta por área e dia; campo usado `val_cargaglobal` (MWmed integralizado na meia hora), instante `din_referenciautc` (fim do intervalo, UTC).
* Dicionário: `DicionarioDados_Carga_Verificada.pdf` (versão de 30/10/2023, sha256 `9912f603b7f442d221fdc4009527a3959f6df28a745f486f0f824e5875c3fe12`, lido com `pdftotext` em 01/10/2026). Lista 4 submercados (SECO, N, NE, S), 26 áreas geoelétricas com o nome de cada uma (BASE = Bahia/Sergipe, BAOE = Bahia Oeste, PBRN = Paraíba/Rio Grande do Norte, ALPE = Alagoas/Pernambuco, TON = Tocantins Norte, TOCO = Tocantins, e uma área por UF nas demais) e 4 áreas de perdas (PEN, PES, PENE, PESE, cujo nome diz o submercado). O dicionário NÃO diz a que submercado pertence cada área geoelétrica.
* Dias conferidos: 16/09/2026 (quarta-feira) e 13/09/2026 (domingo), 34 áreas por dia, 48 meias horas em todas. Bronze: `data/energia/bronze/ons/territorio_ons_areas_carga/<área>@<dia>/`; silver: `territorio_ons_areas_carga`, série `meia_hora.<área>` por instante.
* Recoleta: nova conferência (dois dias novos) quando a última tem 30 dias ou mais.

### 2.2 Insumos publicados por outros módulos (lidos em 01/10/2026)

| Módulo | Arquivo | Fonte primária (dele) | Grão | Referência |
| --- | --- | --- | --- | --- |
| Perdas | `gold/perdas.json`, `series/perdas_municipios.json` | ANEEL SAMP Balanço; IndQual Município e limites de continuidade (relação conjunto × município); cadastro de MMGD (confirmação) | distribuidora; município × distribuidora | perdas de 2025; relação de 2026 |
| Qualidade | `gold/qualidade.json`, `series/qualidade_municipios.csv`, `series/qualidade_conjuntos_anual_2020_2029.csv` | ANEEL, Indicadores Coletivos de Continuidade; IndQual Município | distribuidora; conjunto; município × conjunto | 2025 |
| Conta de luz | `gold/conta.json` (tarifas vigentes) | ANEEL, Tarifas de aplicação | distribuidora | vigente em 30/09/2026 |
| Transição | `gold/transicao.json`, `series/transicao_mmgd_municipios.csv` | ANEEL, Relação de empreendimentos de MMGD; IBGE SIDRA 6579; ONS (MMGD estimada) | município; distribuidora; submercado | cadastro de 29/09/2026; ONS ago/2026 |
| Expansão | `gold/expansao.json`, `series/expansao_usinas_siga.csv` | ANEEL, SIGA | usina; UF principal | 30/09/2026 |
| Inclusão | `gold/inclusao.json`, `series/inclusao_municipios.csv`, `inclusao_luz_para_todos_municipios.csv`, `inclusao_sistemas_isolados_pontos.json` | ANEEL Beneficiários da CDE e SCS; MDS (CadÚnico); MME Luz para Todos; EPE PASI | município; distribuidora; UF | CDE mar/2026; SCS mai/2025; LPT 2004 a ago/2026; PASI ciclo 2025 |
| PLD | `gold/pld.json` | CCEE, PLD horário | submercado | 30/09/2026; mês completo set/2026 |
| Água e clima | `gold/agua_detalhe.json` | ONS, EAR diária por subsistema; mapeamento UF → subsistema (hipótese) | subsistema | 29/09/2026 |
| Carga | `gold/carga_detalhe.json` | mapeamento UF → subsistema (conferência da hipótese) | subsistema | |
| Geometria | `geo/municipios.json`, `geo/uf.json` | IBGE, API de malhas v4 (revisão 2025) e localidades v1 | município; UF | captura de 30/09/2026 |

### 2.3 IBGE, Divisão Territorial Brasileira (DTB), conferência manual

Usada só para documentar as grafias antigas que o SIGA e o arquivo do Luz para Todos ainda usam (o código IBGE não muda quando o nome muda). Arquivos baixados em 01/10/2026 de `https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/divisao_territorial/<ano>/`:

| Arquivo | sha256 |
| --- | --- |
| `2010/dtb_2010.zip` (`dtb_2010.xls`, planilha Município) | `4cfbe9ae50b6e5d67179050a9041993940a2548abdba0057e6b9677f49fa95e1` |
| `2005/dtb_2005.zip` (`DTB 2005.xls`, planilha NomeNormal) | `44163f809524bfdc86bc4a2c8398c457fcbf5cbfdee842faf75f7a9380ae916a` |
| `2000/dtb_2000.zip` (`DTB - 2000.xls`, nível 5 = município) | `54cf75d7420339d3a82d13ed719c705ce3a975b47ea70e3eb66cf38f3f907ac1` |

Lidos com o leitor de XLS de `pipeline/energia/fontes/planilha_inclusao.py`. As 27 linhas resultantes estão em `ibge_territorio.TOPONIMOS`, cada uma com a DTB de origem (ex.: Açu, RN, 2400208, DTB 2010; Parati, RJ, 3303807, DTB 2005; Moji das Cruzes, SP, 3530607, DTB 2000). O pipeline não baixa a DTB: a tabela é versionada no código, como manda `entidades.py` para correspondência sem chave oficial.

### 2.4 Fontes tentadas para a geometria de concessão (S16, S22)

* SIGEL (`https://sigel.aneel.gov.br/portal/home/` e `/arcgis/rest/services`): sem resposta em 01/10/2026 (conexão encerrada após 11 a 12 s), como em 30/09/2026.
* Portal de dados abertos da ANEEL, busca "área de concessão" (18 resultados): nenhum conjunto com geometria de concessão.
* ANEEL, página de distribuição (S16) e de Cartografia e Geoprocessamento: manuais e diretrizes em PDF, nenhum arquivo de geometria de área de concessão.
* BDGD (entidade ARAT): File Geodatabase por distribuidora e ano, sem leitor no ambiente (registrado pelo módulo Perdas).

## 3. Método

### 3.1 Regra do grão (critério de aceite do P002)

Seis grãos, cada um com a sua tabela: submercado, UF, distribuidora (área de atuação), conjunto elétrico, município e usina (ponto). Um número só aparece na tabela do seu grão. O município guarda referências: `dist` = [índice da distribuidora na gold, estado do vínculo], `conj` = ids de conjunto, `sm` = submercado da UF, `usi_multi` = CEG das usinas declaradas nele e em outros municípios. O catálogo `indicadores` da gold diz, para cada indicador, o grão, a tabela, a métrica de origem e o rótulo que ele recebe no painel de um município (ex.: distribuidora: "da distribuidora que atende o município (valor da área inteira da distribuidora, não do município)"). Agregar para cima só quando a soma é da mesma grandeza e cobre o universo inteiro: potência de usinas declaradas em um único município e localidades isoladas do município. Taxa, tarifa, DEC e preço nunca descem.

Compatibilidade entre camadas (`compatibilidade` na gold): município → distribuidora (vínculo 1 ou 2; com mais de uma, lista sem escolher), → conjunto, → submercado (estado da UF; com localidade isolada, com aviso), → usinas declaradas; distribuidora → municípios e → submercado (só quando todos os municípios estão num submercado provado: `submercado_unico`); submercado → UFs. Não passam: submercado → município (não seleciona um município), usina → submercado (depende do ponto de conexão, que o SIGA não publica) e usina → distribuidora.

### 3.2 Distribuidora do município

Lida de `perdas_municipios.json` sem reclassificação: estado 1 = relação conjunto × município confirmada por empreendimento de MMGD da distribuidora no município; 0 = relação sem confirmação; 2 = só pelo cadastro de MMGD. Compartilhado = duas ou mais distribuidoras com estado 1 ou 2. Os indicadores da distribuidora vêm das golds por CNPJ (14 dígitos), com o período de cada bloco; quando a fonte não publica, o bloco sai `disponivel: false` com o motivo (ex.: "sem balanço no SAMP em 2025; última competência publicada: 2023-06 (distribuidora encerrada ou absorvida)").

### 3.3 Submercado do município

Não há tabela oficial município → submercado. A hipótese é o mapeamento UF → subsistema publicado pelos módulos Água (`clima.cobertura_temperatura`) e Carga (`temperatura.ufs_por_subsistema`), iguais entre si. A prova, em cada dia conferido:

* resíduo(sm, h) = Σ carga(áreas geoelétricas de sm, h) + carga(área de perdas de sm, h) − carga(sm, h), em cada meia hora h comum a todas as áreas (exigidas ao menos 40);
* a hipótese fecha quando a mediana de |resíduo| de cada submercado é no máximo 15 MWmed;
* cada área com carga é testada contra todas as alternativas (mover a área para cada outro submercado, 75 casos; trocar duas áreas de submercados diferentes, 222 casos): fica provada quando a hipótese fecha e nenhuma alternativa que a envolva fecha; ambígua quando alguma fecha; indeterminada quando tem carga zero no dia;
* UF provada quando todas as suas áreas com carga são provadas no mesmo submercado nos dois dias. Estados: `provado`, `provado_com_area_sem_carga` (Tocantins: TOCO sem carga), `nao_provado`; no município, `com_localidade_isolada` quando o PASI lista localidade dele em sistema isolado.

Por que meia hora a meia hora e não a média do dia: com a média do dia, a troca de Acre (SE) e Roraima (N), de carga média parecida, fecharia dentro de qualquer tolerância acima de 37 MWmed. Por meia hora, os perfis diários diferentes deixam um resíduo mediano de 28,8 MWmed (13/09) e 38,7 MWmed (16/09). A tolerância de 15 MWmed fica acima do ruído da hipótese (até 7,9 MWmed, no Nordeste, um desvio quase constante que o módulo Água também viu em 10/08/2026) e abaixo da menor alternativa. A mediana resiste a uma meia hora isolada em consistência (Sudeste, 13/09: 160,7 MWmed numa meia hora, mediana de 0,19). Cada dia publica o seu ruído e a sua menor alternativa.

### 3.4 Usinas

Do CSV do SIGA publicado pelo módulo Expansão (25.042 usinas). Município = o que o SIGA declara (`DscMuninicpios`), ligado ao código IBGE pela igualdade do nome normalizado (sem acento, maiúsculas, apóstrofo, acento agudo e hífen como espaço) na mesma UF, ou pela tabela de grafias antigas (seção 2.3). Sem semelhança: o que não é igual fica sem vínculo e é listado. Soma municipal só das usinas declaradas em um único município: operação com a potência fiscalizada; construção e construção não iniciada com a outorgada, em colunas separadas. Usina declarada em mais de um município (531) é listada em cada um, sem potência somada. A coordenada é projetada na grade da malha (Albers, 100 m) e conferida por ponto em polígono contra os municípios declarados; a conferência não corrige a declaração.

### 3.5 Indicadores municipais

* MMGD: unidades, kW e W por habitante de `transicao_mmgd_municipios.csv` (cadastro completo: zero é zero); população estimada do IBGE como publicada lá.
* Tarifa Social: faturas, desconto e razão proxy de `inclusao_municipios.csv`; código de 6 dígitos completado pelo único código de 7 dígitos com o mesmo prefixo (os 5.571 casaram sem ambiguidade).
* Luz para Todos: soma dos domicílios atendidos por município em todos os anos e programas; as linhas sem código IBGE no arquivo do módulo Inclusão foram ligadas pelo mesmo critério de nome (18.719 domicílios por grafia antiga, 312 pelo nome atual); nenhuma ficou sem município. Município sem linha = nulo, não zero.
* Localidades isoladas: as 160 do PASI ciclo 2025 ligadas pelo nome do município (todas); população declarada pela fonte.

### 3.6 Validação antes de publicar

Críticas (derrubam a publicação; a sentinela mantém a anterior): um registro por município da malha; referências a distribuidoras válidas; contagens e potências não negativas; estrutura das tabelas sem indicador fora do grão; nenhum valor de distribuidora copiado sistematicamente para município (conferência por valor, em 5.126 municípios com uma única distribuidora). Ressalvas (visíveis em `controles`): reconciliação com Perdas e Expansão, relação de Perdas × conjuntos de Qualidade, reconhecimento de nomes, concordância das coordenadas, pertença das áreas de carga.

## 4. Evidências de aceite

### 4.1 Critério do P002 (nenhum indicador abaixo do grão de origem)

| Conferência | Resultado | Teste |
| --- | --- | --- |
| Colunas municipais = 15 indicadores de grão município + 8 referências; nenhuma com nome de taxa, DEC, FEC, tarifa, PLD, EAR, perdas ou participação | aprovado | `GoldPublicada.test_colunas_municipais_so_do_municipio_ou_referencia` |
| Cada indicador do catálogo na tabela do seu grão; rótulo no município diz "da distribuidora", "não do município", "não é um valor do município" | aprovado | `test_catalogo_cada_indicador_na_tabela_do_seu_grao` |
| Nenhum valor da distribuidora (taxa de perdas, DEC, FEC, tarifa, participação da Tarifa Social) repetido nos municípios de distribuidora única | 1 coincidência isolada em 5.126 municípios | `test_nenhum_valor_da_distribuidora_no_municipio` e controle crítico na gold |
| Soma municipal de usinas refeita pelo arquivo de usinas, sem as de vários municípios | igual em todos os 5.571 (0,002 MW) | `test_soma_municipal_de_usinas_refeita_pelo_arquivo_de_usinas` |
| Conjunto só por referência, valor na tabela de conjuntos | 3.146 conjuntos de 2025, todos com valor | `test_conjuntos_so_por_referencia` |

### 4.2 Números conferidos contra a fonte original

| Entidade | Período | Gold/índice | Fonte original (outro código) | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| MMGD, Alta Floresta D'Oeste, Manaus, Assú, Belo Horizonte, São Paulo, Florianópolis | cadastro de 29/09/2026 | 1.381 / 22.844 / 2.780 / 18.005 / 25.575 / 8.201 unidades; 15.374,44 / 359.575,76 / 23.866,62 / 165.320,2 / 257.930,0 / 83.561,79 kW | Parquet da ANEEL no bronze, pyarrow em lotes por `CodMunicipioIbge` | 0 | 0 unidade; 0,01 kW |
| Usinas em operação declaradas só no município: Nova Lima, Assú (Açu no SIGA), Belo Horizonte, São Paulo, Florianópolis | SIGA de 30/09/2026 | 12 / 31 / 31 / 224 / 9 usinas; 15,943 / 1.243,97 / 37,045 / 1.012,831 / 4,902 MW | CSV original do SIGA no bronze, `DscFaseUsina = Operação` e `DscMuninicpios` igual | 0 | 0 usina; 0,001 MW |
| Tarifa B1 residencial da CEMIG-D | vigência 28/05/2026 a 27/05/2027 | TUSD 593,08 + TE 310,21 = 903,29 R$/MWh | linha "Tarifa de Aplicação; B1; Convencional; Residencial; Residencial" da REH 3.589/2026 no CSV da ANEEL | 0 | 0,01 R$/MWh |
| Carga média do Acre | 16/09/2026 | 219,335 MWmed | `statistics.fmean` das 48 meias horas da resposta da API | 0 | 0,0001 MWmed |
| Fechamento das áreas de carga (mediana do resíduo por meia hora) | 16/09 e 13/09/2026 | SE 0,32 e 0,19; S 0,57 e 0,36; NE 7,87 e 7,71; N 1,42 e 0,33 MWmed | recalculado com `statistics.median` | até 0,006 | 0,006 MWmed (arredondamento das constantes) |
| Menor alternativa (troca Acre e Roraima) | 13/09 e 16/09/2026 | 28,8 e 38,7 MWmed | idem | até 0,06 | 0,06 MWmed |
| Municípios compartilhados; vínculos; vínculos sem confirmação | relação de 2026 | 440; 6.259 + 1 fora da malha; 191 + 1 | gold de Perdas: 440; 6.260; 192 | 0 | 0 |
| Municípios da CEMIG-D (total, confirmados, exclusivos) | relação de 2026 | 800, 776, 769 | gold de Perdas | 0 | 0 |
| Potência em operação por UF principal | SIGA de 30/09/2026 | 27 UFs | gold de Expansão | 0 | 0,05 MW (arredondamento a 0,1 MW na gold dela) |

### 4.3 Robustez

Grande: CEMIG-D (800 municípios, submercado único SE). Pequena: COCEL (um município, exclusivo, PR). Multiestadual: ESS (MG, PR e SP; 83 municípios no SE e 1 no S, sem submercado único). Mudança societária: ENF (Energisa Nova Friburgo, absorvida; vínculo só sem confirmação; perdas indisponível com o motivo "encerrada ou absorvida") e o código 4314530 da relação (RGE), inexistente no IBGE, listado fora da malha. Valor extremo: São Paulo (duas distribuidoras, 224 usinas em operação, Luz para Todos nulo); Tefé (duas localidades isoladas com 74.643 habitantes: estado `com_localidade_isolada`). Ausência: Porto Rico do Maranhão sem vínculo na relação de Perdas (a Qualidade liga um conjunto da Equatorial Maranhão a ele; listado em `distribuidoras_por_municipio_perdas_x_qualidade`); CODESAM sem tarifa vigente (bloco indisponível com motivo, sem valor).

### 4.4 Testes

`python3 -m unittest pipeline.tests.test_energia_territorio`: 49 testes aprovados em 01/10/2026 (amostras reais: respostas da API do ONS dos dois dias, 27 linhas do CSV do SIGA, 27 feições da malha, recorte da relação de Perdas). `pipeline.tests.test_energia`, `test_energia_infra`, `test_energia_evidencia` e `test_energia_geo`: 90 aprovados. `npx tsc --noEmit` sem erro. `src/tests/energia-comp-navegacao.test.ts` e `telemetry-adminstats.test.ts` aprovados com a seção de telemetria nova.

## 5. Limitações e o que não se pode concluir

* Área de distribuidora = municípios inteiros da relação oficial: limites internos de município compartilhado e área em km² da concessão não são conhecidos.
* Submercado no mapa = divisa da UF. Município com localidade em sistema isolado aponta o submercado da UF com aviso: o PASI não diz quanto do município está fora do SIN. A área TOCO (Tocantins) teve carga zero nos dois dias: a pertença dela não é provada pela soma.
* Indicador de distribuidora não descreve o município e não serve para comparar municípios da mesma distribuidora; DEC e FEC do conjunto são do conjunto inteiro.
* Usina em vários municípios (531) não entra em nenhuma soma municipal; 12 usinas têm município não reconhecido (9 nomes, listados; ex.: "Armação de Búzios", "Alto Alegre do Parecis", "Não Informado"), e 1.379 têm coordenada fora do município declarado (conferência na malha simplificada; a declaração prevalece).
* Em 31 municípios a relação de Perdas (2026) e os conjuntos de Qualidade (2025) listam distribuidoras diferentes; o índice usa a de Perdas e publica a lista. A causa não é atribuída.
* As datas de referência diferem entre fontes; cada bloco traz o seu período.

## 6. Pedidos ao integrador

1. Navegação (`src/lib/energia/navegacao.ts`): a entrada pedida (slug `territorio`, rótulo "Minha região", grupo `comece-aqui`, pergunta "O que acontece na minha região?") quebra `src/tests/energia-comp-navegacao.test.ts`, que fixa os destinos de cada grupo em `SECAO_5_1` (`["Comece aqui", ["mapa", "visao-geral"]]`). A entrada não foi deixada no arquivo para não quebrar o teste compartilhado. Linha pronta, a acrescentar depois de "visao-geral" junto com `"territorio"` em `SECAO_5_1`:
   `{ slug: "territorio", href: "/setor-eletrico/territorio", rotulo: "Minha região", pergunta: "O que acontece na minha região?", resumo: "Mapa com submercado, distribuidora, município e usinas, cada número no seu próprio grão e com link para o módulo de origem.", grupo: "comece-aqui", publicado: false, integrado: true },` (com `publicado: true` quando a página existir).
2. Telemetria: `energia:territorio` acrescentada a `VIEW_SECTIONS` e `SECTION_LABELS` em `src/lib/telemetry.ts` (as duas linhas autorizadas).
3. Componente de área por distribuidora: o mapa por área do módulo Perdas (`PerdasMapa`, `montarAreas`) resolve a área sobre a malha municipal; se virar `MapaAreas` em `src/components/energia/` (pedido já feito pelo módulo Perdas), a página do território a reutiliza na camada de distribuidoras.
4. Projeção de pontos no cliente: o índice de usinas já traz x e y na grade da malha; se outros mapas precisarem projetar lat/lon no navegador, `src/lib/energia/geo.ts` precisaria da Albers de `pipeline/energia/geo.py`.
5. A relação de Qualidade liga Porto Rico do Maranhão (2109056) a um conjunto da Equatorial Maranhão, enquanto a de Perdas o deixa sem vínculo: vale o módulo Perdas conferir a fonte desse caso.
6. Parquet automático do módulo Dados: `territorio_usinas.parquet` foi gerado de uma versão anterior do CSV; ele se regenera na próxima execução do módulo Dados.
