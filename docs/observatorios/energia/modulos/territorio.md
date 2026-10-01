# Módulo Território: o que acontece na minha região (P002)

Rota: `/setor-eletrico/territorio` (página na fase de interface). Família de silver: `territorio` (`data/energia/silver/territorio.db`). Ordem no `run.py`: 97 (depois de todos os módulos cujas golds ele lê).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Índice territorial, coletas próprias e gold | `pipeline/energia/modulos/territorio.py` |
| Áreas de carga do ONS: lista oficial e prova de pertença ao submercado | `pipeline/energia/fontes/ons_territorio.py` |
| WebMap da EPE: UF × subsistema (camada 24) e localidades isoladas (camada 27) | `pipeline/energia/fontes/epe_territorio.py` |
| Malha do IBGE: nomes, grafias antigas (DTB), ponto em polígono na malha de qualidade máxima | `pipeline/energia/fontes/ibge_territorio.py` |
| Métricas | `pipeline/energia/metricas/territorio.py` (10 medidas; as reapresentadas sem definição no módulo de origem também estão aqui, como a EAR do subsistema) |
| Testes | `pipeline/tests/test_energia_territorio.py` (68 testes), amostras em `pipeline/tests/dados/energia_territorio/` |
| Gold | `public/energia/gold/territorio.json` (389 KB) |
| Sob demanda (mapa) | `public/energia/series/territorio_municipios.json` (1,1 MB) e `territorio_usinas.json` (3,1 MB), sem indentação |
| Downloads | `public/energia/series/territorio_{municipios,distribuidoras,conjuntos,usinas,areas_carga,areas_alternativas}.csv` |
| Tipos TS | `src/lib/energia/tipos-territorio.ts` |

Execução: `python3 pipeline/energia/executar_modulo.py territorio` (camadas da EPE a cada 30 dias, malha de qualidade máxima do IBGE a cada 180 dias, conferência das áreas de carga quando a última tem 30 dias ou mais, e gold) ou `--sem-coleta` (só gold: 11 s, pico de 311 MB de memória residente; a conferência das coordenadas carrega uma UF da malha máxima por vez). A execução com coleta de 01/10/2026 (2 camadas da EPE e 27 malhas do IBGE, 13,6 MB, mais a gold) levou 73 s, com pico de 312 MB de memória residente.

## 1. Painel e estado

| Painel | Estado dos dados (esta fase) | Interface |
| --- | --- | --- |
| P002 Mapa geográfico transversal | Dados concluídos com limitação declarada. Índice dos 5.571 municípios do IBGE com: distribuidora(s) e estado do vínculo (relação oficial da ANEEL, via módulo Perdas); conjuntos elétricos (via Qualidade, valores de 2025 na tabela de conjuntos); submercado pela UF (camada oficial da EPE, com a pertença de cada área de carga do ONS provada pela carga verificada meia hora a meia hora); 73 municípios fora do SIN, sem submercado (sede ou maior parte da população em localidade isolada do PASI); indicadores municipais (MMGD, Tarifa Social, Luz para Todos, usinas declaradas só no município e, à parte, registros do SIGA de até 10 kW). Tabelas próprias para submercado (PLD, EAR, MMGD estimada pelo ONS), UF (capacidade, Tarifa Social, isolados), 123 distribuidoras (perdas, DEC e FEC, tarifa B1, MMGD, Tarifa Social, municípios fora do SIN) e 25.042 usinas do SIGA como pontos, com a coordenada conferida na malha de qualidade máxima. Critério de aceite verificado na gold e no índice (seção 4.1). | Pendente (fase de interface): página, `MapaCoropletico` com as quatro camadas e a marca dos municípios fora do SIN, URL, busca, painel lateral e tabela equivalente. O teste do critério de aceite na página fica para essa fase. Sem a página, o P002 não está concluído. |

O mapa geográfico complementa o mapa conceitual da página inicial (P001), não o substitui.

## 2. Fontes verificadas

O módulo não coleta indicador municipal novo: lê as golds e os arquivos publicados pelos módulos de origem, cada um com a sua proveniência. Coleta só o que liga as peças ao território: a camada oficial UF × subsistema e a de localidades isoladas da EPE, a carga por área de carga do ONS (prova da pertença) e a malha municipal de qualidade máxima do IBGE (conferência das coordenadas). O sha256 de cada arquivo lido fica em `insumos` na gold.

### 2.1 ONS, Carga de Energia Verificada (API por área de carga), coleta própria

* Conjunto: https://dados.ons.org.br/dataset/carga-energia-verificada (package_show consultado em 01/10/2026; `metadata_modified` 2025-10-01; licença Creative Commons Attribution, `cc-by`, com o aviso legal do portal).
* Recurso: API `https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio=AAAA-MM-DD&dat_fim=AAAA-MM-DD&cod_areacarga=XX`, uma consulta por área e dia; campo usado `val_cargaglobal` (MWmed integralizado na meia hora), instante `din_referenciautc` (fim do intervalo, UTC).
* Dicionário: `DicionarioDados_Carga_Verificada.pdf` (versão de 30/10/2023, sha256 `9912f603b7f442d221fdc4009527a3959f6df28a745f486f0f824e5875c3fe12`, lido com `pdftotext` em 01/10/2026). Lista 4 submercados (SECO, N, NE, S), 26 áreas geoelétricas com o nome de cada uma (BASE = Bahia/Sergipe, BAOE = Bahia Oeste, PBRN = Paraíba/Rio Grande do Norte, ALPE = Alagoas/Pernambuco, TON = Tocantins Norte, TOCO = Tocantins, e uma área por UF nas demais) e 4 áreas de perdas (PEN, PES, PENE, PESE, cujo nome diz o submercado). O dicionário NÃO diz a que submercado pertence cada área geoelétrica.
* Dias conferidos: 16/09/2026 (quarta-feira) e 13/09/2026 (domingo), 34 áreas por dia, 48 meias horas em todas. Bronze: `data/energia/bronze/ons/territorio_ons_areas_carga/<área>@<dia>/`; silver: `territorio_ons_areas_carga`, série `meia_hora.<área>` por instante.
* Recoleta: nova conferência (dois dias novos) quando a última tem 30 dias ou mais.

### 2.2 EPE, WebMap (serviço ArcGIS `WMS_Webmap_EPE_Data`), coleta própria

* Camada 24, "Subsystem of National Interconnected System (SIN)", descrição "Unidades da federação e Subsistemas do Sistema Interligado Nacional", polígonos, 27 feições, `copyrightText` "EPE, ONS, IBGE; 2020-09-11; criação". Consulta de atributos (sem geometria): `https://gisepeprd2.epe.gov.br/arcgis/rest/services/WMS_Webmap_EPE_Data/MapServer/24/query?where=1%3D1&outFields=*&returnGeometry=false&f=json`, capturada em 01/10/2026 07:36 UTC (3.327 bytes, sha256 `3a8255bd9a09cd155131a0944fae84da8360b915b180b0fc826aedb0279deb81`). Campos usados: `UF`, `Nome`, `subsistee` (SE-CO, S, NE, N). Duas peculiaridades da camada: a Bahia vem com a sigla "BH" (nome "BAHIA") e o Distrito Federal com o nome "DF"; a ligação à UF do IBGE usa a sigla quando ela é do IBGE e, senão, o nome normalizado (só a Bahia foi ligada pelo nome). É a fonte oficial do mapeamento UF → subsistema adotado; o mapeamento coincide com o publicado pelos módulos Água e Carga e com o provado pela soma da carga nas 27 UFs.
* Camada 27, "Isolated Systems": as 160 localidades isoladas como pontos (distribuidora, localidade, UF, município, coordenada, demanda, carga), sem população. Capturada em 01/10/2026 07:36 UTC (44.898 bytes, sha256 `0c92b71f139b376685d8e7cb34a7498d01ac1e489ede60c81dd8f2e5485375cc`). Serve para conferir por outro caminho a lista do PASI que o módulo Inclusão integra: as 160 localidades coincidem (UF, município e localidade normalizados).
* Licença: dados públicos da EPE, uso com citação; direitos da camada 24: EPE, ONS e IBGE. Bronze: `data/energia/bronze/epe/territorio_epe_webmap/`. Recoleta a cada 30 dias.

### 2.3 IBGE, malha municipal em qualidade máxima (API de malhas v4), coleta própria

* Recurso: `https://servicodados.ibge.gov.br/api/v4/malhas/estados/{código da UF}?formato=application/json&intrarregiao=municipio&qualidade=maxima` (TopoJSON quantizado, cerca de 3,5 m de resolução), 27 consultas em 01/10/2026 (13,6 MB como recebidos, com gzip; bronze `data/energia/bronze/ibge/territorio_ibge_malha_maxima/UF<código>/`, sha256 de cada um na gold em `resumo.usinas.conferencia_coordenada.arquivos`). Revisão 2025, a mesma da malha publicada para o mapa.
* Uso: só a conferência das coordenadas das usinas (seção 3.4). A malha do mapa (`public/energia/geo/municipios.json`) parte da qualidade "mínima" do IBGE e ainda é simplificada a 400 m: serve para desenhar, não para decidir se um ponto perto da divisa está dentro.
* Recoleta a cada 180 dias. Uso livre com citação da fonte (IBGE).

### 2.4 Insumos publicados por outros módulos (lidos em 01/10/2026)

| Módulo | Arquivo | Fonte primária (dele) | Grão | Referência |
| --- | --- | --- | --- | --- |
| Perdas | `gold/perdas.json`, `series/perdas_municipios.json` | ANEEL SAMP Balanço; IndQual Município e limites de continuidade (relação conjunto × município); cadastro de MMGD (confirmação) | distribuidora; município × distribuidora | perdas de 2025; relação de 2026 |
| Qualidade | `gold/qualidade.json`, `series/qualidade_municipios.csv`, `series/qualidade_conjuntos_anual_2020_2029.csv` | ANEEL, Indicadores Coletivos de Continuidade; IndQual Município | distribuidora; conjunto; município × conjunto | 2025 |
| Conta de luz | `gold/conta.json` (tarifas vigentes) | ANEEL, Tarifas de aplicação | distribuidora | vigente em 30/09/2026 |
| Transição | `gold/transicao.json`, `series/transicao_mmgd_municipios.csv` | ANEEL, Relação de empreendimentos de MMGD; IBGE SIDRA 6579 (população estimada de 2026, capturada em 30/09/2026 22:20 UTC); ONS (MMGD estimada) | município; distribuidora; submercado | cadastro de 29/09/2026; população de 2026; ONS ago/2026 |
| Expansão | `gold/expansao.json`, `series/expansao_usinas_siga.csv` | ANEEL, SIGA (com o tipo de outorga) | usina; UF principal | 30/09/2026 |
| Inclusão | `gold/inclusao.json`, `series/inclusao_municipios.csv`, `inclusao_luz_para_todos_municipios.csv`, `inclusao_sistemas_isolados_pontos.json` | ANEEL Beneficiários da CDE e SCS; MDS (CadÚnico); MME Luz para Todos; EPE PASI | município; distribuidora; UF | CDE mar/2026; SCS mai/2025; LPT 2004 a ago/2026; PASI ciclo 2025 |
| PLD | `gold/pld.json` | CCEE, PLD horário | submercado | 30/09/2026; mês completo set/2026 |
| Água e clima | `gold/agua_detalhe.json` | ONS, EAR diária por subsistema; mapeamento UF → subsistema | subsistema | 29/09/2026 |
| Carga | `gold/carga_detalhe.json` | mapeamento UF → subsistema (conferência) | subsistema | |
| Geometria | `geo/municipios.json`, `geo/uf.json` | IBGE, API de malhas v4 (revisão 2025) e localidades v1 | município; UF | captura de 30/09/2026 |

### 2.5 IBGE, Divisão Territorial Brasileira (DTB), conferência manual

Usada só para documentar as grafias antigas que o SIGA e o arquivo do Luz para Todos ainda usam (o código IBGE não muda quando o nome muda). Arquivos baixados em 01/10/2026 de `https://geoftp.ibge.gov.br/organizacao_do_territorio/estrutura_territorial/divisao_territorial/<ano>/`:

| Arquivo | sha256 |
| --- | --- |
| `2010/dtb_2010.zip` (`dtb_2010.xls`, planilha Município) | `4cfbe9ae50b6e5d67179050a9041993940a2548abdba0057e6b9677f49fa95e1` |
| `2005/dtb_2005.zip` (`DTB 2005.xls`, planilha NomeNormal) | `44163f809524bfdc86bc4a2c8398c457fcbf5cbfdee842faf75f7a9380ae916a` |
| `2000/dtb_2000.zip` (`DTB - 2000.xls`, nível 5 = município) | `54cf75d7420339d3a82d13ed719c705ce3a975b47ea70e3eb66cf38f3f907ac1` |

Lidos com o leitor de XLS de `pipeline/energia/fontes/planilha_inclusao.py`. As 27 linhas resultantes estão em `ibge_territorio.TOPONIMOS`, cada uma com a DTB de origem (ex.: Açu, RN, 2400208, DTB 2010; Parati, RJ, 3303807, DTB 2005; Moji das Cruzes, SP, 3530607, DTB 2000). O pipeline não baixa a DTB: a tabela é versionada no código, como manda `entidades.py` para correspondência sem chave oficial.

### 2.6 Fontes tentadas para a geometria de concessão (S16, S22) e para o submercado por município

* SIGEL (`https://sigel.aneel.gov.br/portal/home/` e `/arcgis/rest/services`): sem resposta em 30/09 e 01/10/2026 (conexão encerrada após 11 a 12 s nos três endereços).
* Portal de dados abertos da ANEEL, busca "área de concessão" (18 resultados): nenhum conjunto com geometria de concessão.
* ANEEL, página de distribuição (S16) e de Cartografia e Geoprocessamento: manuais e diretrizes em PDF, nenhum arquivo de geometria de área de concessão.
* BDGD (entidade ARAT): File Geodatabase por distribuidora e ano, sem leitor no ambiente (registrado pelo módulo Perdas).
* WebMap da EPE: tem a camada UF × subsistema (24, adotada) e a de sistemas isolados (27), nenhuma de área de concessão e nenhuma de submercado por município.

## 3. Método

### 3.1 Regra do grão (critério de aceite do P002)

Seis grãos, cada um com a sua tabela: submercado, UF, distribuidora (área de atuação), conjunto elétrico, município e usina (ponto). Um número só aparece na tabela do seu grão. O município guarda referências: `dist` = [índice da distribuidora na gold, estado do vínculo], `conj` = ids de conjunto, `sm` = submercado da UF (nulo fora do SIN), `usi_multi` = CEG das usinas declaradas nele e em outros municípios. O catálogo `indicadores` da gold diz, para cada indicador, o grão, a tabela, a métrica de origem e o rótulo que ele recebe no painel de um município (ex.: distribuidora: "da distribuidora que atende o município (valor da área inteira da distribuidora, não do município)"). Agregar para cima só quando a soma é da mesma grandeza e cobre o universo inteiro: potência de usinas declaradas em um único município, registros de até 10 kW e localidades isoladas do município. Taxa, tarifa, DEC e preço nunca descem.

Compatibilidade entre camadas (`compatibilidade` na gold): município → distribuidora (vínculo 1 ou 2; com mais de uma, lista sem escolher), → conjunto, → submercado (estado da UF; com localidade isolada menor, com aviso; fora do SIN, não passa), → usinas declaradas; distribuidora → municípios e → submercado (só com os municípios no SIN, e só quando todos eles estão num submercado provado: `submercado_unico`; `parte_fora_do_sin` avisa quando há município da área fora do SIN); submercado → UFs. Não passam: submercado → município (não seleciona um município), usina → submercado (depende do ponto de conexão, que o SIGA não publica) e usina → distribuidora.

### 3.2 Distribuidora do município

Lida de `perdas_municipios.json` sem reclassificação: estado 1 = relação conjunto × município confirmada por empreendimento de MMGD da distribuidora no município; 0 = relação sem confirmação; 2 = município que a relação não cobre, ligado pelo cadastro de MMGD à distribuidora que tem nele ao menos 10 empreendimentos e ao menos 5% dos empreendimentos do município (regra do módulo Perdas, `aneel_perdas.vinculos_so_mmgd`, `minimo=10`, `participacao=0,05`). Município fora da relação sem distribuidora acima dos dois limiares fica sem vínculo. Compartilhado = duas ou mais distribuidoras com estado 1 ou 2. Os indicadores da distribuidora vêm das golds por CNPJ (14 dígitos), com o período de cada bloco; quando a fonte não publica, o bloco sai `disponivel: false` com o motivo (ex.: "sem balanço no SAMP em 2025; última competência publicada: 2023-06 (distribuidora encerrada ou absorvida)").

Ano incompleto e faixa física, com o mesmo critério nas duas fontes anuais: ano sem os 12 meses é parcial. A taxa de perdas de ano parcial sai com `parcial: true` e ressalva visível (CEJAMA, CERMC e CODESAM com 11 meses, COORSEL com 8); o módulo Qualidade não publica DEC e FEC anuais de ano parcial, então o bloco sai indisponível com o motivo (CASTRO-DIS, CERAÇÁ, CERIPA com 11 meses, CERAL ANITÁPOLIS com 10). Taxa de perdas totais fora de 0% a 100% (CERPRO −10,44%, CERTHIL −17,31%, COORSEL −18,24%, balanço com energia fornecida maior que a injetada) fica como o SAMP publica, com ressalva no bloco e no controle; nada é descartado. Distribuidora sem energia injetada no balanço (CERAL-DIS, CERAL ANITÁPOLIS) sai com o bloco de perdas indisponível.

### 3.3 Submercado do município

Não há tabela oficial município → submercado. A correspondência oficial UF → subsistema é a camada 24 do WebMap da EPE (seção 2.2), igual aos mapeamentos publicados pelos módulos Água (`clima.cobertura_temperatura`) e Carga (`temperatura.ufs_por_subsistema`). Sem a camada numa execução, a hipótese conferida volta a ser a do módulo Água, com ressalva. A reconciliação independente, área por área, em cada dia conferido:

* resíduo(sm, h) = Σ carga(áreas geoelétricas de sm, h) + carga(área de perdas de sm, h) − carga(sm, h), em cada meia hora h comum a todas as áreas (exigidas ao menos 40);
* a hipótese fecha quando a mediana de |resíduo| de cada submercado é no máximo 15 MWmed;
* cada área com carga é testada contra todas as alternativas (mover a área para cada outro submercado, 75 casos; trocar duas áreas de submercados diferentes, 222 casos): fica provada quando a hipótese fecha e nenhuma alternativa que a envolva fecha; ambígua quando alguma fecha; indeterminada quando tem carga zero no dia;
* uma área vale como provada na UF quando é provada em todo dia conferido em que teve carga: com carga zero num dos dias, vale a prova do outro; com carga zero nos dois, fica indeterminada. UF provada quando todas as suas áreas são provadas no mesmo submercado. Estados: `provado`, `provado_com_area_sem_carga` (Tocantins: TOCO sem carga nos dois dias), `nao_provado`.

Por que a mediana por meia hora e não o resíduo das médias do dia. As duas estatísticas são publicadas para cada uma das 297 alternativas de cada dia (`territorio_areas_alternativas.csv`; na gold, `menor_alternativa`, `menor_alternativa_pelas_medias` e `alternativas_que_fechariam_pelas_medias`). A troca de Acre (SE) e Roraima (N), a menor alternativa por meia hora (28,8 MWmed em 13/09 e 38,7 em 16/09), é reprovada também pelas médias do dia (37,4 e 37,8 MWmed no pior submercado; +34,1 no SE e −37,4 no N em 13/09). A razão que sustenta a escolha é outra, em dois pontos: (1) pelas médias do dia, duas áreas de carga média quase igual no mesmo dia trocam sem deixar resíduo. Em 16/09/2026, Rondônia (753,7 MWmed) e Tocantins Norte (745,9) trocadas deixam −7,9 MWmed no Sudeste e 6,9 no Norte, e Rio Grande do Sul (4.296,0) e Bahia/Sergipe (4.292,9) trocadas deixam −3,1 no Sul e 11,0 no Nordeste: as duas trocas caberiam na tolerância e as quatro áreas ficariam ambíguas naquele dia. Por meia hora, os perfis diários diferentes deixam medianas de 230,7 e 368,1 MWmed. (2) A mediana resiste a uma meia hora ainda em consistência, que desloca a média do dia inteiro: Sudeste em 13/09, 160,7 MWmed numa meia hora, resíduo das médias do dia de −3,26 MWmed contra mediana de 0,19. A tolerância de 15 MWmed fica acima do ruído da hipótese (até 7,9 MWmed, no Nordeste, um desvio quase constante que o módulo Água também viu em 10/08/2026) e abaixo da menor alternativa. Cada dia publica o seu ruído e a sua menor alternativa pelas duas estatísticas.

Município com localidade isolada (PASI ciclo 2025, 160 localidades em 89 municípios):

* `fora_do_sin` (submercado nulo, não se aplica): a sede é localidade isolada (o PASI dá à localidade-sede o nome do município: igualdade do nome normalizado) ou as localidades isoladas somam ao menos 50% da população estimada do município (IBGE, 2026). São 73 municípios: 71 pela sede, 2 só pela população (Careiro da Várzea, com CAREIRO e PARAUÁ somando 99% da população, e Careiro, com CASTANHO, 95%). PLD, EAR e MMGD estimada do submercado não valem para eles, e a seleção município → submercado não passa;
* `com_localidade_isolada` (submercado da UF com aviso): localidades menores num município cuja sede e maior parte da população estão no SIN. São 16 (ex.: Itaituba, 12.500 habitantes isolados em 136.990; Porto Velho, 5.050 em 520.379; Juruti, duas localidades industriais da Alcoa sem população publicada).

O limiar de 50% fica longe dos dois grupos: a razão entre a população isolada declarada e a estimada fica em 84% ou mais nos 73 municípios fora do SIN (Amajari, 84%, é o menor) e em 9% ou menos nos 15 demais com população publicada (Itaituba, 9,1%, é o maior). As duas populações têm bases diferentes (em Uiramutã a do PASI, 18.849, passa a estimativa do IBGE, 16.809): a razão separa os grupos, não mede a parte exata do município fora do SIN. Na distribuidora, `submercados` e `submercado_unico` contam só os municípios de vínculo válido no SIN, e `area.fora_do_sin` conta os demais: Âmbar Amazonas tem 49 dos seus 58 municípios válidos fora do SIN, 3 com localidade isolada e 9 no Norte; Âmbar Energia RR, 3 de 15 fora do SIN.

### 3.4 Usinas

Do CSV do SIGA publicado pelo módulo Expansão (25.042 usinas). Município = o que o SIGA declara (`DscMuninicpios`), ligado ao código IBGE pela igualdade do nome normalizado (sem acento, maiúsculas, apóstrofo, acento agudo e hífen como espaço) na mesma UF, ou pela tabela de grafias antigas (seção 2.5). Sem semelhança: o que não é igual fica sem vínculo e é listado. Soma municipal só das usinas declaradas em um único município: operação com a potência fiscalizada; construção e construção não iniciada com a outorgada, em colunas separadas. Usina declarada em mais de um município (531) é listada em cada um, sem potência somada.

Registros de até 10 kW: empreendimento com tipo de outorga "Registro", em operação e com potência fiscalizada de até 10 kW fica numa coluna própria (`usi_reg_n`, `usi_reg_kw`, em kW), fora da contagem de usinas do município. São 16.035 no SIGA de 30/09/2026: 16.008 de até 5 kW e 27 entre 5 e 10 kW (contra 262 registros entre 10 e 75 kW), quase todos UFV de 1 a 3 kW de propriedade da Equatorial Pará (13.100) e da Energisa MS (2.864), em nome de moradores, escolas e igrejas, com entrada em operação de 2017 a 2022: sistemas individuais. Somados às usinas, eles dominavam a contagem municipal (Portel, 5.708; Corumbá, 2.862). Registro acima de 10 kW (pequenas centrais, térmicas de até 5 MW) continua usina.

Coordenada: ponto em polígono, em graus, contra os municípios declarados, na malha municipal do IBGE em qualidade máxima (seção 2.3), uma UF por vez na memória, com as arestas de cada município repartidas em faixas horizontais. Sem a malha máxima de alguma UF, a conferência usa a malha simplificada do mapa e o resultado sai marcado como aproximado (`malha_conferencia`). A conferência não corrige a declaração: o município declarado prevalece.

### 3.5 Indicadores municipais

* MMGD: unidades, kW e W por habitante de `transicao_mmgd_municipios.csv` (cadastro completo: zero é zero); população estimada do IBGE de 2026 como publicada lá (`referencias.populacao_ano`, proveniência `populacao`).
* Tarifa Social: faturas, desconto e razão proxy de `inclusao_municipios.csv`; código de 6 dígitos completado pelo único código de 7 dígitos com o mesmo prefixo (os 5.571 casaram sem ambiguidade).
* Luz para Todos: soma dos domicílios atendidos por município em todos os anos e programas; as linhas sem código IBGE no arquivo do módulo Inclusão foram ligadas pelo mesmo critério de nome (18.719 domicílios por grafia antiga, 312 pelo nome atual); nenhuma ficou sem município. Município sem linha = nulo, não zero.
* Localidades isoladas: as 160 do PASI ciclo 2025 ligadas pelo nome do município (todas); população declarada pela fonte; `isol_sede` = 1 quando a sede é localidade isolada.

### 3.6 Proveniência e evidência

Cada bloco reapresentado tem proveniência própria, com o período do valor exibido (não a cobertura da fonte, que fica em `cobertura_historica`): `pld_dia` (CALCULADO, média das 24 horas de 30/09/2026, métrica `visao_pld_media_diaria`), `pld_mes` (set/2026), `ear` (OBSERVADO como o ONS publica por subsistema, 29/09/2026, sem a fórmula da EAR do SIN; métrica `territorio_ear_subsistema_pct`), `mmgd_ons` (ESTIMADO pelo ONS, ago/2026), `conjuntos` (DEC e FEC de 2025 do módulo Qualidade), `populacao` (IBGE, 2026), `subsistema_uf` (camada 24 da EPE), `distribuidora_perdas` (2025), `isolados` (ciclo 2025) e as demais. Nas evidências, `fonte.capturado_em` e `fonte.publicado_em` são os do dado original (captura do IndQual em 30/09/2026 22:32 UTC; do SIGA em 30/09/2026 22:18 UTC, publicado em 30/09/2026 10:40 UTC), e a geração do arquivo intermediário do módulo de origem vai em `fonte.processado_em`. A URL da proveniência do índice é a do conjunto de origem (IndQual Município), não a do observatório.

### 3.7 Validação antes de publicar

Críticas (derrubam a publicação; a sentinela mantém a anterior): um registro por município da malha; referências a distribuidoras válidas; contagens e potências não negativas; estrutura das tabelas sem indicador fora do grão; nenhum valor de distribuidora copiado sistematicamente para município (conferência por valor, em 5.126 municípios com uma única distribuidora). Ressalvas (visíveis em `controles`): camada da EPE × Água × Carga; PASI × camada 27 da EPE; consistência com Perdas e Expansão; relação de Perdas × conjuntos de Qualidade; reconhecimento de nomes; coordenadas na malha máxima (com a comparação com a simplificada); extremos da contagem municipal; percentuais na faixa física de 0% a 100%; ano incompleto; pertença das áreas de carga; subsistema provado × camada da EPE.

## 4. Evidências de aceite

### 4.1 Critério do P002 (nenhum indicador abaixo do grão de origem)

| Conferência | Resultado | Teste |
| --- | --- | --- |
| Colunas municipais = 17 indicadores de grão município + 9 referências; nenhuma com nome de taxa, DEC, FEC, tarifa, PLD, EAR, perdas ou participação | aprovado | `GoldPublicada.test_colunas_municipais_so_do_municipio_ou_referencia` |
| Cada indicador do catálogo presente na tabela PUBLICADA do seu grão (bloco na gold ou coluna do arquivo, com o grão da coluna igual ao do indicador) e ausente das colunas municipais; rótulo no município diz "da distribuidora", "não do município", "não é um valor do município" | aprovado | `test_catalogo_cada_indicador_publicado_na_tabela_do_seu_grao` |
| Nenhum valor da distribuidora (taxa de perdas, DEC, FEC, tarifa, participação da Tarifa Social) repetido nos municípios de distribuidora única | 1 coincidência isolada em 5.126 municípios | `test_nenhum_valor_da_distribuidora_no_municipio` e controle crítico na gold |
| Município fora do SIN sem submercado (o "não se aplica" não vira valor); distribuidora sem os municípios fora do SIN em `submercados` | 73 municípios, todos com `sm` nulo; Âmbar Amazonas só com os 9 do SIN | `test_valores_extremos_e_sistema_isolado`, `test_distribuidora_com_area_fora_do_sin`, classe `SistemaIsolado` |
| Conjunto só por referência, valor na tabela de conjuntos | 3.146 conjuntos de 2025, todos com valor | `test_conjuntos_so_por_referencia` |

### 4.2 Números conferidos contra a fonte original (outro código, valores escritos nos testes)

| Entidade | Período | Gold/índice | Fonte original (outro código) | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| MMGD, Alta Floresta D'Oeste, Manaus, Assú, Belo Horizonte, São Paulo, Florianópolis | cadastro de 29/09/2026 | 1.381 / 22.844 / 2.780 / 18.005 / 25.575 / 8.201 unidades; 15.374,44 / 359.575,76 / 23.866,62 / 165.320,2 / 257.930,0 / 83.561,79 kW | Parquet da ANEEL no bronze, pyarrow em lotes por `CodMunicipioIbge` | 0 | 0 unidade; 0,01 kW |
| Usinas em operação declaradas só no município, sem os registros de até 10 kW; registros de até 10 kW: Nova Lima, Assú, Belo Horizonte, São Paulo, Florianópolis, Manaus, Tefé, Portel, Corumbá, Jandira | SIGA de 30/09/2026 | usinas 12 / 31 / 31 / 222 / 8 / 24 / 5 / 0 / 2 / 1; MW 15,943 / 1.243,97 / 37,045 / 1.012,819 / 4,901 / 1.298,978 / 31,868 / 0 / 10,312 / 1,07; registros 0 / 0 / 0 / 2 / 1 / 2 / 0 / 5.708 / 2.862 / 0; kW 0 / 0 / 0 / 12 / 1 / 13 / 0 / 5.990 / 2.862 / 0 | CSV original do SIGA no bronze, `DscFaseUsina = Operação`, `DscMuninicpios` igual, CEG sem repetição, `DscTipoOutorga = Registro` com `MdaPotenciaFiscalizadaKw` ≤ 10 à parte; total de registros de até 10 kW 16.035 | 0 | 0 usina; 0,001 MW; 0,001 kW |
| Relação município × distribuidora | relação de 2026 | 440 compartilhados; 5.566 municípios com distribuidora; 6.259 vínculos na malha (6.044 confirmados, 191 sem confirmação, 24 só pelo MMGD); CEMIG-D 800 = 776 + 24; sem vínculo só 2109056; fora da malha só 4314530 | script à parte sobre `indicadores-continuidade-coletivos-limite.csv` (AnoLimiteQualidade = 2026), `indqual-municipio.csv` e o Parquet de MMGD, com o limiar de 10 empreendimentos e 5% | 0 | 0 |
| Tarifa B1 residencial da CEMIG-D | vigência 28/05/2026 a 27/05/2027 | TUSD 593,08 + TE 310,21 = 903,29 R$/MWh | linha "Tarifa de Aplicação; B1; Convencional; Residencial; Residencial" da REH 3.589/2026 no CSV da ANEEL | 0 | 0,01 R$/MWh |
| Carga média do Acre | 16/09/2026 | 219,335 MWmed | `statistics.fmean` das 48 meias horas da resposta da API | 0 | 0,0001 MWmed |
| Fechamento das áreas de carga (mediana do resíduo por meia hora) | 16/09 e 13/09/2026 | SE 0,32 e 0,19; S 0,57 e 0,36; NE 7,87 e 7,71; N 1,42 e 0,33 MWmed | recalculado com `statistics.median` | até 0,006 | 0,006 MWmed (arredondamento das constantes) |
| Alternativas: troca Acre e Roraima; trocas Rondônia e Tocantins Norte, Rio Grande do Sul e Bahia/Sergipe | 13/09 e 16/09/2026 | mediana por meia hora 28,8 e 38,7; pelas médias do dia 37,42 e 37,77; RO e TON 7,94 e RS e BASE 10,95 pelas médias (16/09) | `statistics.fmean` e `statistics.median` à parte | até 0,06 | 0,06 MWmed (mediana); 0,002 MWmed (médias) |
| Subsistema de cada UF | camada consultada em 01/10/2026 | 27 UFs, igual ao provado pela soma e aos módulos Água e Carga | camada 24 do WebMap da EPE (resposta real no teste) | 0 | 0 |
| Localidades isoladas | ciclo 2025 | 160 do PASI (módulo Inclusão) | 160 na camada 27 do WebMap da EPE (UF, município e localidade) | 0 | 0 |
| Tefé: localidades isoladas | ciclo 2025 | 2 localidades, 74.643 habitantes; `fora_do_sin` | WebMap da EPE: AM-096 TEFÉ 73.669 e AM-025 CAIAMBÉ 974 | 0 | 0 |
| UTE Budai (Jandira, SP) | SIGA de 30/09/2026 | coordenada dentro de Jandira | recorte de Jandira da malha máxima (API v4) no teste; fora na malha simplificada do mapa | | |

### 4.3 Consistência interna (não é reconciliação com a fonte)

| Conferência | Resultado | Onde |
| --- | --- | --- |
| Compartilhados, vínculos e vínculos sem confirmação contra a gold de Perdas (440; 6.259 + 1 fora da malha; 191 + 1) | iguais | controle na gold |
| Municípios por distribuidora (confirmados e só MMGD) contra a gold de Perdas | iguais nas 123 | controle na gold |
| Potência em operação por UF principal contra a gold de Expansão | iguais nas 27 UFs (0,05 MW, arredondamento a 0,1 MW na gold dela) | controle na gold |
| Soma municipal de usinas refeita a partir do arquivo de usinas publicado (sem as de vários municípios e sem os registros de até 10 kW) | igual nos 5.571 (0,002 MW) | `test_consistencia_interna_soma_municipal_e_arquivo_de_usinas` |
| Topo da contagem municipal refeito a partir das usinas | igual (São Paulo 222, Rio de Janeiro 83, Sento Sé 53, Salvador 50, Uberlândia 48) | controle "Extremos da contagem municipal" |

### 4.4 Robustez

Grande: CEMIG-D (800 municípios, submercado único SE). Pequena: COCEL (um município, exclusivo, PR). Multiestadual: ESS (MG, PR e SP; 83 municípios no SE e 1 no S, sem submercado único). Área quase toda fora do SIN: Âmbar Amazonas (49 de 58 municípios válidos fora do SIN; `submercado_unico` N só pelos 9 do SIN, `parte_fora_do_sin` verdadeiro). Mudança societária: ENF (Energisa Nova Friburgo, absorvida; vínculo só sem confirmação; perdas indisponível com o motivo "encerrada ou absorvida") e o código 4314530 da relação (RGE), inexistente no IBGE, listado fora da malha. Valor extremo: Portel (PA), 5.708 registros de 1 a 3 kW (5.990 kW) e nenhuma usina; Corumbá (MS), 2.862 registros; São Paulo, a maior contagem de usinas (222, mais 2 registros), duas distribuidoras e Luz para Todos nulo. Sistema isolado: Tefé (sede isolada, 74.643 habitantes em localidades isoladas de 81.046 estimados) e Jordão (AC, UF do Sudeste/Centro-Oeste, sede isolada) fora do SIN; Itaituba com localidade isolada e submercado N com aviso. Ausência: Porto Rico do Maranhão sem vínculo (seção 4.6, defeito 8); CODESAM sem tarifa vigente (bloco indisponível com motivo, sem valor); CASTRO-DIS sem DEC e FEC de 2025 (11 meses).

### 4.5 Testes

`python3 -m unittest pipeline.tests.test_energia_territorio`: 68 testes aprovados em 01/10/2026 (amostras reais: respostas da API do ONS dos dois dias, resposta da camada 24 da EPE, recorte de Jandira da malha máxima, 31 linhas do CSV do SIGA, 29 feições da malha, recorte da relação de Perdas). `pipeline.tests.test_energia`, `test_energia_infra`, `test_energia_evidencia` e `test_energia_geo`: 90 aprovados. `npx tsc --noEmit` sem erro.

### 4.6 Defeitos apontados pela verificação de 01/10/2026 e o que foi feito

1. Municípios fora do SIN recebiam submercado (alto). Confirmado: 71 dos 89 municípios com localidade isolada têm a sede isolada e 69 têm 90% ou mais da população em localidades isoladas; Tefé saía com `sm` N e Jordão com SE. Corrigido: estado `fora_do_sin` com `sm` nulo (seção 3.3), 73 municípios; distribuidora calcula `submercados` e `submercado_unico` só com municípios no SIN e publica `area.fora_do_sin`, `area.com_localidade_isolada` e `parte_fora_do_sin`; compatibilidade, métrica `territorio_submercado_municipio` (versão 2), limitações e camada de submercado (marca sobreposta) atualizadas. Testes: classe `SistemaIsolado` (Tefé, Jordão, Careiro da Várzea, Itaituba, Juruti, Manaus) e `test_valores_extremos_e_sistema_isolado`, `test_distribuidora_com_area_fora_do_sin` (Âmbar Amazonas, Âmbar Energia RR).
2. Justificativa falsa da mediana (médio). Confirmado na letra: pela média do dia a troca Acre e Roraima também é reprovada (+34,08 e −37,42 MWmed em 13/09; +36,71 e −37,77 em 16/09). Justificativa reescrita no documento, no código e no comentário do teste, com o que de fato a sustenta: pela média do dia, as trocas Rondônia e Tocantins Norte (7,9 MWmed) e Rio Grande do Sul e Bahia/Sergipe (11,0 MWmed) caberiam na tolerância em 16/09, e a mediana resiste à meia hora em consistência. As duas estatísticas são publicadas para cada alternativa (`territorio_areas_alternativas.csv`, 594 linhas). Testes: `test_media_do_dia_deixaria_passar_troca_que_a_meia_hora_reprova`, `test_mediana_resiste_onde_a_media_do_dia_desloca`, `test_troca_de_areas_de_carga_parecida_e_detectada` (com o valor pelas médias), `test_areas_publicam_as_duas_estatisticas`.
3. Usinas municipais dominadas por sistemas individuais (médio). Confirmado (Portel 5.708, todos registros de 1 ou 3 kW). Corrigido: registros de até 10 kW em colunas próprias (seção 3.4), métrica `territorio_registros_10kw_municipio`, limitação, controle de extremos e seção de robustez com o extremo real. Testes: `test_registros_ate_10kw_fora_da_contagem_de_usinas` (registros reais de Portel), `test_usinas_iguais_ao_csv_original_do_siga` (10 municípios relidos do CSV original, inclusive Portel e Corumbá) e o controle de extremos.
4. Indicadores sem proveniência própria (médio). Confirmado. Corrigido: proveniências `mmgd_ons` (ESTIMADO pelo ONS), `conjuntos` (Qualidade, 2025) e `populacao` (IBGE SIDRA 6579, 2026, com a captura do módulo Transição lida em modo somente leitura), e `referencias.populacao_ano`. Teste: `test_cada_bloco_reapresentado_tem_proveniencia_propria`.
5. Natureza, métrica e período errados (médio). Confirmado. Corrigido: `pld_dia` CALCULADO (métrica `visao_pld_media_diaria`, fórmula do PLD diário); `pld` separado em `pld_dia` e `pld_mes`; EAR do subsistema OBSERVADA, sem a fórmula do SIN, com métrica própria; `_prov_derivada` recebe o período do valor exibido. Teste: `test_natureza_metrica_e_periodo_do_valor_exibido`.
6. Evidências com consulta desatualizada, captura trocada e URL do observatório (baixo). Confirmado. Corrigido: consulta `meia_hora.<área>`; `capturado_em` e `publicado_em` do dado original e `processado_em` para a geração do arquivo intermediário; `url_dataset` do IndQual Município. Teste: `test_evidencia_com_captura_original_e_consulta_atual`.
7. Coordenadas fora do município superestimadas (baixo). Confirmado: refeita na malha de qualidade máxima do IBGE (seções 2.3 e 3.4). Das 1.379 que a malha simplificada dava como fora, 292 (21%) estão dentro na máxima; 126 que ela dava como dentro estão fora; o resultado publicado é 1.213 fora. Dos cinco exemplos nomeados na verificação, quatro ficaram dentro (Junco do Seridó, Lagoa do Barro do Piauí, Jandira, Chapadão do Sul). O quinto, Tapuirama (CGH.PH.MG.028955-8.1, declarada em Uberlândia), continua fora: na malha de qualidade máxima da revisão 2025 (API v4, mesma do mapa) o ponto cai em Uberaba, a 144 m do vértice mais próximo da divisa; na revisão anterior servida pela API v3, que a verificação usou, cai em Uberlândia. A diferença vem da revisão da divisa, não da simplificação. Testes: `test_malha_maxima_desfaz_falso_positivo_da_simplificada`, `test_conferencia_na_malha_maxima_sobrepoe_a_simplificada`, `test_coordenadas_na_malha_maxima`.
8. Limiar do vínculo 2 omitido e Porto Rico do Maranhão mal diagnosticado (baixo). Confirmado. Documentado na métrica e na seção 3.2. Porto Rico do Maranhão (2109056) não tem vínculo pela regra, não por erro de fonte: tem 5 empreendimentos de MMGD, todos da Equatorial Maranhão (abaixo do mínimo de 10), e os três conjuntos que o IndQual liga a ele não têm limite de 2026 (7939 só em 2001; 14736 de 2011 a 2021; 16837, MIRINZAL, de 2022 a 2025). A relação de 2025 do módulo Qualidade, que usa o conjunto 16837, por isso liga o município à Equatorial Maranhão. Pedido ao módulo Perdas retirado (seção 6).
9. Comparações internas rotuladas como conferência com a fonte e testes que repetem a implementação (baixo). Confirmado. As comparações com as golds de Perdas e Expansão estão na seção 4.3 (consistência interna). Os testes passaram a: reconstruir a relação a partir dos arquivos originais (valores escritos no teste: 6.044 / 191 / 24, 5.566, CEMIG-D 776 + 24), conferir o catálogo contra a publicação (bloco ou coluna existente no grão), e o teste da soma municipal ficou rotulado como consistência interna. Casos de sistema isolado acrescentados (item 1).
10. Camada oficial da EPE não citada (baixo). Confirmado. A camada 24 passou a ser coletada e é a fonte oficial do mapeamento UF → subsistema (hipótese conferida), com a prova pelas áreas de carga como reconciliação independente; a camada 27 confere as localidades do PASI. Bloqueios e seção 2.6 atualizados. Testes: classe `CamadaEpe`, `test_areas_publicam_as_duas_estatisticas`.
11. Faixa de perdas negativa aprovada e ano incompleto tratado de modo diferente (baixo). Confirmado. Faixa física de 0% a 100% com ressalva visível no bloco e no controle; mesmo critério de ano incompleto (12 meses) nas duas fontes, com `parcial` e ressalva na taxa de perdas e motivo explícito na qualidade (seção 3.2). Teste: `test_perdas_faixa_fisica_e_ano_parcial`.
12. Métrica e docstring divergentes do código (baixo). Confirmado. A métrica diz que a área com carga zero num dos dias vale pela prova do outro; a docstring de `_dias_para_conferir` diz sexta-feira. Teste: `test_dias_conferidos` (comentário alinhado).

## 5. Limitações e o que não se pode concluir

* Área de distribuidora = municípios inteiros da relação oficial: limites internos de município compartilhado e área em km² da concessão não são conhecidos.
* Submercado no mapa = divisa da UF (camada oficial da EPE). Município cuja sede é localidade isolada do PASI, ou com ao menos metade da população em localidades isoladas, fica fora do SIN e sem submercado; nos 16 demais com localidade isolada, o submercado da UF vale com aviso. A população do PASI e a estimada pelo IBGE têm bases diferentes: a razão separa os dois grupos (84% ou mais contra 9% ou menos), não mede a parte exata do município fora do SIN. A área TOCO (Tocantins) teve carga zero nos dois dias: a pertença dela não é provada pela soma.
* Indicador de distribuidora não descreve o município e não serve para comparar municípios da mesma distribuidora; DEC e FEC do conjunto são do conjunto inteiro. Taxa de perdas de ano parcial (4 distribuidoras) não é comparável à de ano completo; taxas negativas (3) estão como o SAMP publica.
* Usina em vários municípios (531) não entra em nenhuma soma municipal. Registros de até 10 kW (16.035) ficam em coluna própria: o limite de 10 kW separa o grupo de sistemas individuais do SIGA, não é categoria da fonte. 12 usinas têm município não reconhecido (9 nomes, listados; ex.: "Armação de Búzios", "Alto Alegre do Parecis", "Não Informado"). 1.213 têm coordenada fora do município declarado na malha de qualidade máxima (a coordenada do SIGA é um centróide aproximado, e a divisa muda entre revisões da malha; a declaração prevalece).
* Em 31 municípios a relação de Perdas (2026) e os conjuntos de Qualidade (2025) listam distribuidoras diferentes; o índice usa a de Perdas e publica a lista. Em Porto Rico do Maranhão a causa é conhecida (seção 4.6, item 8); nos demais, não é atribuída.
* As datas de referência diferem entre fontes; cada bloco traz o seu período.

## 6. Pedidos ao integrador

1. Navegação (`src/lib/energia/navegacao.ts`): a entrada pedida (slug `territorio`, rótulo "Minha região", grupo `comece-aqui`, pergunta "O que acontece na minha região?") quebra `src/tests/energia-comp-navegacao.test.ts`, que fixa os destinos de cada grupo em `SECAO_5_1` (`["Comece aqui", ["mapa", "visao-geral"]]`). A entrada não foi deixada no arquivo para não quebrar o teste compartilhado. Linha pronta, a acrescentar depois de "visao-geral" junto com `"territorio"` em `SECAO_5_1`:
   `{ slug: "territorio", href: "/setor-eletrico/territorio", rotulo: "Minha região", pergunta: "O que acontece na minha região?", resumo: "Mapa com submercado, distribuidora, município e usinas, cada número no seu próprio grão e com link para o módulo de origem.", grupo: "comece-aqui", publicado: false, integrado: true },` (com `publicado: true` quando a página existir).
2. Telemetria: `energia:territorio` acrescentada a `VIEW_SECTIONS` e `SECTION_LABELS` em `src/lib/telemetry.ts` (as duas linhas autorizadas).
3. Componente de área por distribuidora: o mapa por área do módulo Perdas (`PerdasMapa`, `montarAreas`) resolve a área sobre a malha municipal; se virar `MapaAreas` em `src/components/energia/` (pedido já feito pelo módulo Perdas), a página do território a reutiliza na camada de distribuidoras.
4. Projeção de pontos no cliente: o índice de usinas já traz x e y na grade da malha; se outros mapas precisarem projetar lat/lon no navegador, `src/lib/energia/geo.ts` precisaria da Albers de `pipeline/energia/geo.py`.
5. Catálogo de dados (`catalogo.py`): os conjuntos novos `territorio_epe_webmap` (EPE) e `territorio_ibge_malha_maxima` (IBGE) entram pelo `REGISTRO` do módulo; se o catálogo exigir entrada própria para fontes fora do CKAN, falta acrescentá-las.
6. Parquet automático do módulo Dados: `territorio_usinas.parquet` foi gerado de uma versão anterior do CSV (sem `outorga`, `registro_ate_10kw` e `malha_conferencia`); ele se regenera na próxima execução do módulo Dados.
