# Módulo Expansão da oferta e da rede (P040 a P043)

Documento de método do módulo `expansao` (rota `/setor-eletrico/expansao`, família de silver `aneel_geracao`, ordem 30). Estado em 30/09/2026, fim da fase de dados: coleta, silver, gold, métricas, tipos TypeScript e testes prontos; a página ainda não foi escrita (fase de interface).

Arquivos do módulo:

| Camada | Caminho |
| --- | --- |
| Coleta, silver e gold | `pipeline/energia/modulos/expansao.py` |
| Leitura das bases da ANEEL (SIGA, RALIE, liberações, atos, leilões, SIGET) | `pipeline/energia/fontes/aneel_expansao.py` |
| Leitura do caderno de dados do PDE 2035 | `pipeline/energia/fontes/epe_pde.py` |
| Métricas (15 medidas) | `pipeline/energia/metricas/expansao.py` |
| Testes (24, sem rede) | `pipeline/tests/test_energia_expansao.py`, recortes reais em `pipeline/tests/dados/energia_expansao/` |
| Gold | `public/energia/gold/expansao.json` (cerca de 257 KB) |
| Downloads | `public/energia/series/expansao_*.csv` (11 arquivos) |
| Leitura sob demanda (mapa) | `public/energia/series/expansao_usinas_pontos.json` (24.577 usinas com coordenada oficial do SIGA, 3,1 MB) |
| Tipos | `src/lib/energia/tipos-expansao.ts` (usa `Evidencia` de `src/lib/energia/evidencia.ts`) |

Execução: `python3 pipeline/energia/executar_modulo.py expansao` (coleta e gold) ou `--sem-coleta` (só gold, a partir do silver e do bronze). Em 30/09/2026 a gold sai em cerca de 30 s com pico de 1,15 GB de memória residente; com a coleta (recursos dentro do intervalo de recoleta, só `package_show`), 40 s. O Parquet histórico de unidades geradoras do RALIE tem 18,9 milhões de linhas: é lido em lotes de 500 mil linhas, só com as colunas usadas, e os agregados parciais de cada lote são recombinados (soma de somas, máximo de máximos). A leitura inteira das colunas levava o processo a 1,72 GB; em lotes, a parte do Parquet fica em 0,9 GB e o resultado é idêntico (conferido nas oito saídas: datas, agregados por fotografia, fotografias mensais, confiabilidade, deslizamento, trajetórias e primeira aparição).

Retomada após o reinício de 30/09/2026 (22h30 UTC): coleta e silver estavam completos (vintages de 22h18 a 22h23 UTC). O trabalho retomado conferiu cada bloco contra a fonte e acrescentou leitura em lotes, conferências entre recursos, evidências pelo contrato central, tolerância da reconciliação, data-base em cada previsão publicada, tratamento de atos sem data, km de circuito rotulado, métricas, tipos, testes e este documento.

## 1. Painéis e estado

| Painel | Dados entregues | Estado |
| --- | --- | --- |
| P040 Carteira de projetos | Parque do SIGA separado por estágio (em operação 22.798 usinas e 220.658,9 MW fiscalizados; em construção 145 usinas e 9.030,8 MW outorgados; outorgado sem obra 2.099 usinas e 87.267,2 MW outorgados), por tipo e por UF; encerramentos de outorga (2.545 atos de revogação e extinção desde 2015, 99.724,3 MW declarados, 3 atos sem data contados à parte); carteira do RALIE (2.246 usinas, 76.591 unidades geradoras, 95.888,3 MW em implantação) por situação da obra, viabilidade, cronograma, justificativa, tipo, UF e compromisso em leilão, com potência por unidade no CSV; desfecho das usinas que passaram pelo RALIE desde 17/06/2021 por coorte; série mensal da carteira desde jun/2021; capacidade em operação por tipo, origem, fonte e UF; pontos das usinas com latitude e longitude oficiais | Dados concluídos com limitação declarada (seção 5): encerramentos só desde 2015; usina multiestadual na UF principal. Página pendente |
| P041 Cronograma e atrasos | Previsões atuais da fiscalização por ano, mês (24 meses) e viabilidade, com data-base (fotografia de 18/09/2026) em cada linha; unidades sem previsão por justificativa; maiores usinas classificadas como atrasadas; confiabilidade das previsões em 50 fotografias mensais (jun/2021 a ago/2025) contra a liberação comercial real; revisão das previsões em 51 pares de fotografias com 12 meses de distância; atraso realizado da liberação comercial contra a data outorgada, por ano desde 2014; histórico próprio de previsões por unidade no silver a partir da primeira captura (30/09/2026) | Dados concluídos com limitação declarada: previsão convencional em bloco (13/09/2031 para 38.568 unidades) e data outorgada que é prazo limite, não previsão (seção 5). Página pendente |
| P042 Geração e transmissão | Leilões de transmissão por ano (1999 a 2024, 488 lotes) com km, MVA, investimento previsto e RAP em campos separados e deságio agregado pela RAP; obras do SIGET por empreendimento (km de circuito e MVA novos, prazo do ato legal, data efetiva), em andamento (763 empreendimentos, 25.947,5 km de circuito, 53.111,3 MVA, 22 com prazo legal vencido), por UF, atraso realizado e entrada por ano; geração em implantação e rede em obra por UF lado a lado; série anual de MW liberados, km e MVA energizados e leiloados | Entregue em parte, com bloqueio documentado: o arquivo aberto de leilões termina em 002/2024 e a planilha mais recente da ANEEL está atrás de desafio anti-robô; a geometria das linhas (SIGEL) não respondeu, então o território é por UF das subestações (seção 5.4). Página pendente |
| P043 Cenários oficiais | PDE 2035 (EPE e MME, aprovado pela Portaria MME nº 923, de 30/06/2026) com selo CENÁRIO, data-base (janeiro de 2025), horizonte, universo e 10 hipóteses com a página do relatório; figuras 3-6, 3-23, 3-25, 4-19, 4-24, 4-27 e 12-4 do caderno de dados; camadas separadas de cenário (PDE), realizado (SIGA) e carteira (RALIE) por categoria, sem diferença calculada; totais conferidos contra os rótulos do relatório | Dados concluídos com limitação declarada: o BEN não foi integrado (seção 5.5). Página pendente |

Nenhum painel está declarado como entrega integral: a interface ainda não existe, e P042 tem dependências externas não resolvidas.

## 2. Fontes verificadas (consulta em 30/09/2026)

Todas da ANEEL estão sob a licença declarada pelo portal (Open Data Commons Open Database License, ODbL). Cada arquivo está no bronze (`data/energia/bronze/aneel/aneel_*`, `data/energia/bronze/epe/epe_pde`) com sha256 e vintage no silver `data/energia/silver/aneel_geracao.db`. Dicionários em PDF foram baixados e lidos com `pdftotext`.

| Fonte | Recurso usado | Publicação pela fonte (last_modified) | Período e grão | Frequência (dicionário) |
| --- | --- | --- | --- | --- |
| SIGA (S14), https://dadosabertos.aneel.gov.br/dataset/siga-sistema-de-informacoes-de-geracao-da-aneel | `siga-empreendimentos-geracao-diario.csv` (8.418.652 bytes, sha256 `139603153f57...`, UTF-8); o XML e o CSV mensal do pacote têm o mesmo conteúdo e não são usados | 30/09/2026 10:40 | fotografia do dia; uma linha por usina (núcleo do CEG); 25.045 linhas, 25.042 núcleos | mensal (o arquivo diário é capturado no máximo uma vez por semana) |
| RALIE (S15), https://dadosabertos.aneel.gov.br/dataset/ralie-relatorio-de-acompanhamento-da-expansao-da-oferta-de-geracao-de-energia-eletrica | `ralie-usina-atual.csv` (2.246 usinas), `ralie-unidade-geradora-atual.csv` (76.591 unidades), `ralie-leilao-atual.csv`, `ralie-usina-historico.parquet` (533.091 linhas) e `ralie-unidade-geradora-historico.parquet` (18.891.040 linhas, 40.148.967 bytes, sha256 `c6a184da5d13...`); os ZIP históricos têm o mesmo conteúdo do Parquet e não são usados | 18/09/2026 21:05 a 21:17 | 177 fotografias (DatRalie) de 17/06/2021 a 18/09/2026; usina e unidade geradora | mensal; as fotografias têm intervalo irregular |
| Liberação para operação comercial, https://dadosabertos.aneel.gov.br/dataset/liberacao-para-operacao-comercial-de-empreendimentos-de-geracao | `unidades-geradoras-liberadas-operacao-comercial-detalhado.csv` (59.441 linhas) e `...-resumido.csv` (resumo anual por tipo) | 18/09/2026 20:07 e 17:43 | liberação por unidade ou grupo de unidades; resumo por ano e tipo | quinzenal (detalhado), mensal (resumido) |
| Atos de outorgas de geração, https://dadosabertos.aneel.gov.br/dataset/atos-de-outorgas-de-geracao | `atos-outorgas-aneel.csv` (13.887.333 bytes, Latin-1) | 25/09/2026 18:14 | atos desde 2015 | mensal |
| Resultado de leilões, https://dadosabertos.aneel.gov.br/dataset/resultado-de-leiloes | `resultado-leiloes-transmissao.csv` (488 lotes, Latin-1); o recurso de geração não é usado | 01/09/2026 05:01 | lote de leilão de transmissão, 1999 a 27/09/2024 | mensal |
| SIGET, https://dadosabertos.aneel.gov.br/dataset/sistema-de-gestao-da-transmissao-siget | `siget-contrato-empreendimento-obra-modulo.csv`, `siget-resolucao-empreendimento-obra-modulo.csv`, `siget-contrato-modulolinhatransmissao-subestacaoorigem-subestacaodestino.csv` (1.741 linhas, 1.567 módulos de linha), `siget-contrato-moduloequipamento-subestacao.csv` | 29/09/2026 16:31 a 16:36 | empreendimento × obra × módulo | diária (capturado no máximo uma vez por semana) |
| Capacidade instalada por UF e Empreendimentos em operação (agregados usados só para reconciliar o SIGA) | `capacidade-instalada-geracao-uf.csv`, `empreendimento-operacao-historico.csv` | 01/07/2026 e 05/08/2026 | mês × UF; mês × tipo (último mês: jun/2026) | mensal |
| EPE, PDE 2035 (S23), https://www.epe.gov.br/pt/publicacoes-dados-abertos/publicacoes/plano-decenal-de-expansao-de-energia-2035 | `PDE 2035_Dados_Relatório Final.zip` (planilhas dos capítulos 03, 04 e 12; abas atualizadas em 10, 11 e 12/06/2026), `PDE 2035_Relatório Final_Aprovado.pdf` (541 páginas) e a página da EPE (texto de aprovação) | o servidor não informa data de publicação | 2025 a 2035, por figura | por edição |

Licença da EPE: Creative Commons Atribuição 4.0, conforme o rodapé do portal da EPE.

Dicionários conferidos: SIGA (versão 1.2, 30/03/2023), RALIE usina, unidade geradora e leilão (versão 1.0, 16/06/2026), liberações detalhado (1.1, 13/10/2022) e resumido, atos, leilões de transmissão (30/08/2022), SIGET (módulo de linha: `NumEtnLinTms` "número de extensões da linha"; equipamento: `MdaPotAtvMdlEqp` "potência ativa do módulo MVA"; empreendimento: `DatOprComEpd` "data da operação comercial fixada pelo ato legal", `DatEfeOprComEpd` "data efetiva"), capacidade por UF e empreendimentos em operação. Achados:

* o dicionário da unidade geradora do RALIE tem descrições deslocadas uma linha (ex.: `DatLiberOpTesteRealizado` descrito como descida do rotor; `DatUGInicioOpComerOutorgado` como liberação de operação em teste). A leitura segue o nome do campo; a limitação está na proveniência;
* o dicionário do SIGA descreve fases desde antes da outorga até a revogação, mas o arquivo aberto só traz Operação, Construção e Construção não iniciada (22.801, 145 e 2.099 linhas);
* o dicionário do resumo de liberações chama o campo de `MdaSomaPotenciaMW`, mas desde 2014 os valores estão em kW (70 de 70 grupos iguais à soma do detalhado em kW, seção 4);
* `NumEtnLinTms` está em km: o bipolo Xingu × Terminal Rio aparece com 2.539 km por circuito, e Xingu × Estreito com 2.092 km;
* `PctDesagio` dos leilões é fração (0,34 = 34%), conferida contra 1 − RAP vencedora ÷ RAP do edital.

## 3. Método

### 3.1 Identidade e silver

A chave de usina é o núcleo do CEG (`IdeNucleoCEG`, inteiro): o sufixo de versão do CEG muda quando a usina é alterada, o núcleo não. A chave de unidade geradora é (núcleo, `NumUgUsina`). Proprietários do SIGA viram lista de CNPJ com 14 dígitos (`entidades.cnpj`), sem vínculo por nome.

Cadastros e cronogramas entram em `registros` (`base.grava_registros`) com histórico por captura: uma chave por usina (`usina:<núcleo>`), por unidade (`ug:<núcleo>:<unidade>`), por lote de leilão, por empreendimento do SIGET e por ato. Os campos cuja revisão importa (fase no SIGA; situação da obra, viabilidade e cronograma no RALIE; previsão SFG por unidade; situação do empreendimento no SIGET) são campos próprios; o restante vai num JSON por chave, que também registra qualquer mudança. Chave que some do arquivo tem os campos apagados (`''`), o que preserva a data em que a unidade saiu do RALIE. Séries agregadas do Parquet histórico e dos agregados oficiais vão para `observacoes`.

### 3.2 Estágios, carteira e desfechos (P040)

Estágio = fase do SIGA: Operação; Construção; Construção não iniciada (outorgado sem obra). Os estágios são disjuntos e exaustivos (25.042 usinas nos três para 25.042 núcleos). Encerramentos: atos com objeto "Autorização - Revogação" ou "Concessão - Extinção" (rótulos da fonte), contados por ano de publicação com a potência declarada no ato; revogação de DRO, DRI e DRS fica fora (registro anterior à outorga). Ato sem data de publicação (3 em 30/09/2026, 110,4 MW) fica fora da série anual e é contado à parte.

Desfecho de cada usina do Parquet histórico, nesta ordem: em implantação (consta na fotografia mais recente); operação (fase Operação no SIGA ou todas as unidades da primeira fotografia liberadas); outorga encerrada (ato de encerramento publicado depois da primeira aparição, ou ato sem data); sem desfecho. Ato anterior à primeira aparição não encerra a trajetória (Curuá-Una, extinção de 03/10/2016, primeira aparição em 17/06/2021). Coortes: estoque da primeira fotografia e ano de entrada; participação = 100 × Σ kW outorgado na primeira fotografia com o desfecho ÷ Σ kW da coorte. Das 360 usinas sem desfecho, 354 (16.111,2 MW) estão fora do arquivo aberto do SIGA sem ato vinculado ao núcleo do CEG, e 6 seguem como Construção não iniciada: publicado em `estagios.sem_desfecho_no_siga`.

### 3.3 Cronograma (P041)

Previsão = `DatPrevisaoOpComercialSFG` (previsão da fiscalização por unidade), sempre com a data da fotografia em que foi publicada (`data_base_ralie` em cada linha dos CSV da carteira e das unidades). Atraso previsto = previsão − `DatUGInicioOpComerOutorgado`, mediana ponderada por kW (menor valor cuja soma acumulada de pesos alcança metade do total).

Confiabilidade: para cada fotografia mensal S (última do mês), unidades com previsão em (S, S + 365 dias]; vínculo exato por (núcleo, unidade) com o arquivo de liberações (grupo "1 a 5" expandido; texto não numérico como "16 (desativada)" não é vinculado). Partição: liberada até S + 365 dias; depois; não liberada até a data do arquivo de liberações. Unidade já liberada antes de S sai do denominador e é contada. Só janelas encerradas pelo menos 15 dias antes da data do arquivo (defasagem de publicação). Deslizamento: mesma unidade nas fotografias mensais S e S + 12 meses, previsão preenchida nas duas.

Atraso realizado: `DatLiberOpComerRealizado` − `DatUGInicioOpComerOutorgado` por linha do arquivo detalhado, potência `MdaPotenciaLiberadaComercial` (kW; o campo unitário mistura MW e kW em linhas antigas), mediana ponderada por ano desde 2014.

Nenhuma promessa antiga é reconstruída com o estoque atual: o RALIE publica o histórico das fotografias desde 17/06/2021 (verificado), e a partir de 30/09/2026 cada captura do RALIE atual também guarda a previsão por unidade no silver (histórico próprio: `cronograma.historico_proprio`).

### 3.4 Transmissão (P042)

Leilões: somas por ano do leilão (`AnoLeilao`; o leilão 005/2016 foi realizado em 2017) de km, MVA, investimento previsto e RAP; deságio agregado = 100 × (1 − Σ RAP vencedora ÷ Σ RAP do edital) nos lotes com as duas; reais nominais. SIGET: km de circuito = Σ `NumEtnLinTms` dos módulos de linha distintos com obra do tipo Instalação (cada circuito é um módulo, então circuito duplo e bipolo contam cada circuito); MVA = Σ `MdaPotAtvMdlEqp` dos transformadores de potência (reatores e capacitores, em Mvar, ficam fora); adequação, ampliação, recapacitação, reconstrução e seccionamento alteram instalação existente e não somam km novo. Prazo vencido = em andamento ou planejado com data do ato legal anterior à data do arquivo; atraso realizado = data efetiva − ato legal. Por UF: linha interestadual entra nas duas UFs (a soma das UFs supera o total). Geração e rede por UF ficam lado a lado, nunca somadas nem divididas.

### 3.5 Cenários (P043)

Cada figura é lida da aba do caderno de dados só depois de conferidos o título e os rótulos das colunas (a leitura falha alto se a EPE mudar a planilha). Camadas: PDE (dez/2025 e dez/2035), realizado do SIGA (potência fiscalizada em operação) e carteira do RALIE (potência das unidades em implantação), por categoria com correspondência verificada (UHE, PCH, eólica, solar centralizada, biomassa); térmicas, MMGD, baterias e resposta da demanda não têm correspondência e ficam sem realizado. Nenhuma diferença entre camadas é calculada.

### 3.6 Validação física e de esquema (seção 5.2 do contrato)

Violação crítica vira stub (a sentinela mantém a publicação anterior): SIGA com menos de 1.000 usinas, potência negativa no SIGA ou no RALIE, data de geração do SIGA no futuro. Ressalvas visíveis na gold: usinas em operação com potência fiscalizada zero (10), fiscalizada mais de 20% acima da outorgada (1), coordenada fora do território (0), reconciliação por tipo ou UF fora de 1% (AM e MS em 30/09/2026) e conferência entre recursos divergente. Módulo de linha com extensão fora de 0 a 3.000 km é contado (0).

## 4. Evidências de aceite (conferidas em 30/09/2026)

| Conferência | Caminho independente | Módulo | Fonte | Diferença | Tolerância |
| --- | --- | --- | --- | --- | --- |
| RALIE atual × Parquet histórico, fotografia 18/09/2026 | CSV atual contra o Parquet (dois recursos do conjunto) | 76.591 unidades, 95.888,261 MW | 76.591 unidades, 95.888,261 MW | 0 unidades diferentes em potência e previsão | 0 (mesmo registro) |
| Liberações detalhado × resumo anual oficial | soma por ano e tipo do detalhado contra o resumo | 70 grupos desde 2014 | 70 grupos | 0 divergentes (ex.: UHE 2022 = 154.400 kW; UHE 2025 = 49.998 kW; CGH 2023 = 11.350 kW) | 0,5 kW por grupo |
| SIGA × agregado "empreendimentos em operação" (jun/2026), por tipo, descontadas as liberações entre 01/07 e 30/09/2026 | agregado oficial | UHE 103.235,141 MW; EOL 34.936,651; UTE 49.890,162; UFV 23.615,261; PCH 6.064,019; CGH 927,652; UTN 1.990,0 | UHE 103.235,221; EOL 34.810,654 + 126,0 liberados; UTE 49.084,721 + 1.140,657; UFV 22.564,521 + 1.184,097; PCH 6.057,02 + 7,0; CGH 925,909 + 3,2; UTN 1.990,0 | resíduo UHE −0,080 MW; EOL −0,003; PCH −0,001; UTN 0; CGH −1,457 (−0,16%); UFV −133,357 (−0,59%); UTE −335,216 (−0,68%) | 1% do agregado do grupo (justificativa na gold) |
| SIGA × agregado por UF (jun/2026), descontadas as liberações | agregado oficial | 27 UFs | 27 UFs | 25 dentro; AM +29,8 MW (+1,36%) e MS −134,9 MW (−3,95%) fora, publicados como ressalva | 1% |
| PDE 2035, Figura 3-25 × rótulos do relatório (p. 97) | texto do PDF | 249,37 GW (dez/2025) e 359,008 GW (dez/2035) | 249 GW e 359 GW | +0,37 e +0,008 GW | 0,5 GW (rótulo em GW inteiros) |
| PDE 2035, Figura 3-6 × texto (p. 72) | texto do PDF | 251,53 GW em 2025 | "aproximadamente 251 GW" | +0,53 GW | 1 GW |
| Leilões de transmissão de 2024 | releitura do CSV com `csv` da biblioteca padrão (teste) | 18 lotes, 7.247,0 km, 10.200 MVA, deságio 42,0% | 18 lotes, 7.246,96 km, 10.200 MVA, 1 − 2.053,2 ÷ 3.542,8 | 0 | arredondamento de 0,1 |
| Deságio publicado × RAP | cálculo pela RAP | 2 dos 488 lotes divergem | `PctDesagio` | 001/2009 lote 2 (fonte 87%, RAP 0,06%) e 005/2016 lote 9 (fonte 86%, RAP 31,75%) divergem: publicados em `desagio_inconsistente` | 0,6 ponto percentual |
| Hipóteses do PDE 2035 | leitura das páginas 72, 73, 74, 92 e 93 do relatório (pdftotext) | 10 hipóteses | texto do relatório | duas redações corrigidas na retomada (Caso Base inclui só ACL com alta viabilidade; Angra 3 em 2033 "após consulta ao MME") | texto |
| Aprovação do PDE 2035 | página da EPE capturada | "Portaria MME n° 923, de 30 de junho de 2026" | idem | 0 | texto |

Casos concretos nos testes (recortes reais): Portocém I (4 unidades × 392.972 kW = 1.571.888 kW, igual à outorga no SIGA; previsões de 03/11 a 30/12/2026); fotografia de 30/06/2021 com Da Mata liberada no prazo (50.000 kW), Curuá-Una depois do prazo (12.500 kW), Capivari nunca liberada (648 kW) e São Luiz excluída por já ter sido liberada em 2001 (12.000 kW); Cascata com revogação em 15/04/2025 (outorga encerrada); Novo Horizonte com revogação sem data (outorga encerrada, data desconhecida); LT 230 kV Lechuga × Tarumã em circuito duplo (2 × 12,5 km) com 2 × 300 MVA e prazo legal vencido há 9 dias; recondutoramento Recife II × Mirueira (Adequação, 0 km novo); Estreito (MA e TO) atribuída ao MA; UIO com coordenada 0 fora do mapa; Angra 3 com entrada em operação 1900-01-03 tratada como ausência.

Testes: `python3 -m unittest pipeline.tests.test_energia_expansao` (24 testes, 0,5 s, sem rede; os CSV que os blocos escrevem vão para diretório temporário). Tipos: a gold e uma amostra dos pontos foram verificadas contra `tipos-expansao.ts` com `tsc --strict` (literal da gold atribuído ao tipo; teste negativo com campo trocado falha).

## 5. Limitações materiais e o que não se pode concluir

### 5.1 Carteira

* Outorga não é capacidade que certamente entrará: do estoque de 17/06/2021 (1.116 usinas, 46.146 MW), 68,3% da potência entrou em operação, 17,8% teve a outorga encerrada, 12,9% segue em implantação e 0,9% saiu sem desfecho identificado. MW não é energia firme nem garantia física.
* Encerramentos anteriores a 2015 não constam do conjunto de atos.
* Usina multiestadual fica na UF principal (65 usinas, 35.832,0 MW em operação); a potência não é dividida.
* As coordenadas do SIGA são centróides aproximados; 465 usinas sem coordenada (0 na fonte) não aparecem no mapa.

### 5.2 Cronograma

* A previsão da fiscalização é convencional para boa parte da carteira: 38.568 unidades (45.112,9 MW) têm a mesma data, 13/09/2031, e 13.342 unidades (10.827,7 MW) não têm previsão por "revogação da outorga em avaliação". Por isso 90,3% da potência com previsão aparece depois da data outorgada, com mediana de 1.231 dias: isso descreve a classificação da fiscalização, não cronograma de obra.
* Em autorizações recentes (sobretudo solares) a data outorgada é um prazo limite anos à frente: em 2026, parcial, a mediana do atraso realizado é −1.209 dias (liberação muito antes do prazo; 2,4 GW liberados em 2026 tinham data outorgada em 2029).
* A data outorgada do arquivo de liberações é a vigente na publicação: cronograma alterado por ato posterior é medido contra a data alterada.
* Unidade renumerada entre a fotografia e a liberação aparece como não liberada; a janela mais recente tem menos tempo para liberação "depois do prazo".
* O deslizamento só contém unidades que continuam em implantação 12 meses depois (viés de sobrevivência).

### 5.3 Transmissão

* km de circuito, não km de traçado: circuito duplo e bipolo contam cada circuito.
* O atraso das obras em andamento é medido contra o ato legal: a previsão informada pela transmissora não está no arquivo aberto do SIGET.
* Reais nominais nos leilões; investimento é o previsto no edital.

### 5.4 Bloqueios externos (P042)

* Leilões depois de 27/09/2024: o CSV aberto (publicado em 01/09/2026) termina no leilão 002/2024. A página "Relatórios e indicadores / Leilões" da ANEEL (atualizada em 02/10/2025) aponta para `https://git.aneel.gov.br/publico/centralconteudo/-/raw/main/relatorioseindicadores/leiloes/Resultado_leiloes_transmissao.xlsx`, que respondeu 403 com página de desafio anti-robô ("Just a moment...") em 30/09/2026 23h05 UTC; não foi contornado. Consequência: 2025 e 2026 aparecem como ausência (null), nunca como ano sem leilão. Dependência: a ANEEL atualizar o recurso do portal de dados abertos ou liberar a planilha para acesso automatizado.
* Geometria das linhas: `https://sigel.aneel.gov.br/portal/home/` e `https://sigel.aneel.gov.br/arcgis/rest/services?f=json` terminaram com "Connection reset by peer" (curl 35) em 30/09/2026 23h07 UTC. O mapa da rede fica por UF das subestações (SIGET); o SIGET não traz coordenadas.

### 5.5 Cenários

* O PDE é cenário de uma edição (data-base janeiro de 2025), não previsão nem realizado. As categorias do PDE não correspondem uma a uma às do SIGA (térmicas do PDE incluem usinas sem contrato retiradas do Caso Base; UHE do PDE é 109,4 GW em dez/2025 contra 103,2 GW fiscalizados no SIGA em set/2026, diferença não atribuída a nenhuma causa sem documentação).
* O Balanço Energético Nacional (BEN) não foi integrado: o realizado de capacidade vem do SIGA; a geração realizada (TWh), comparável à Figura 12-4, é do módulo Geração (ONS).

## 6. Pedidos ao integrador

1. Navegação e página (`navegacao.ts`, rota `/setor-eletrico/expansao`) na fase de interface; os conjuntos entram no catálogo pelo `REGISTRO` do módulo, sem edição de `datasets.ts`.
2. Módulos Geração e Empresas podem ler `capacidade_instalada` de `expansao.json` (potência em operação por tipo, origem, fonte e UF, com reconciliação) e o CSV `expansao_usinas_siga.csv` (CNPJ dos proprietários com 14 dígitos) em vez de coletar o SIGA de novo.
3. O mapa de usinas deve carregar `public/energia/series/expansao_usinas_pontos.json` (3,1 MB) sob demanda, não pela gold (seção 5.1 do contrato).
4. `expansao_usinas_siga.csv` (4,7 MB) e `expansao_unidades_ralie.csv` (4,2 MB) estão perto do teto de 5 MB por arquivo: se a carteira crescer, dividir por tipo ou publicar Parquet.
5. Decisão humana sobre a planilha de leilões em `git.aneel.gov.br` (desafio anti-robô): pedir à ANEEL a atualização do recurso aberto ou autorização de acesso; nada foi contornado.
6. Tempo no `run.py`: a primeira coleta completa baixa cerca de 145 MB (Parquet histórico do RALIE de 40 MB, SIGET de 25 MB, relatório do PDE de 15 MB); a gold leva cerca de 30 s e 1,2 GB de memória.
