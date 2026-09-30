# Observatório Brasileiro do Setor Elétrico: descrição completa para revisão crítica externa

**Data de referência deste documento:** 30/09/2026
**Base desta descrição:** código do repositório `genarolins1975/scrutiniums`, commit `d95d8f8b4` (branch `claude/elegant-maxwell-77er9z`), e os arquivos de dados publicados em `public/energia/gold/*.json`, processados em 30/09/2026 02:20 UTC (29/09/2026 23:20 em Brasília), versão do pipeline `energia-0.1.0`, código `196905461ac0`.
**Finalidade:** dar a um revisor externo (ChatGPT ou outro) tudo o que ele precisa para criticar o painel sem acesso ao código: o que cada página e cada painel mostram, com que dado, com que regra, até que data, o que está incompleto e por quê.

Convenção usada em todo o documento:

* **Evidência:** o que está no código ou no dado publicado, com arquivo e data.
* **Inferência:** leitura minha a partir da evidência, marcada como tal.
* **Recomendação:** o que fazer, com prioridade.

Todos os números citados vêm dos arquivos gold listados acima. Quando digo "dado de 28/09/2026", é a data de referência do dado na fonte, não a data de captura.

---

## 1. Visão de conjunto

### 1.1 O que é

Um observatório público, dentro da plataforma Scrutiniums (que também hospeda o Observatório do Crédito), montado sobre dados abertos do ONS e da CCEE. Rota raiz: `/setor-eletrico`. Todas as páginas são públicas e geradas estaticamente (`force-static`) a partir dos arquivos gold; a atualização é diária por GitHub Actions (`.github/workflows/atualizar-energia.yml`, agendado para 23:40 UTC, 20:40 em Brasília, depois da atualização das 19h do ONS).

### 1.2 Os 13 módulos da navegação

Fonte: `src/lib/energia/navegacao.ts`.

| # | Módulo | Rota | Estado declarado no código | Pergunta que a página promete responder |
|:--|:--|:--|:--|:--|
| 1 | Mapa | `/setor-eletrico` | integrado | Por onde começar |
| 2 | Visão geral | `/setor-eletrico/visao-geral` | integrado | O que está acontecendo no sistema elétrico brasileiro? |
| 3 | PLD | `/setor-eletrico/pld` | integrado | A que preço se acerta a energia no curto prazo, hora a hora e em cada região? |
| 4 | Água e clima | `/setor-eletrico/agua-e-clima` | integrado | Quanta energia está guardada nos reservatórios, e quanta água está chegando? |
| 5 | Geração | `/setor-eletrico/geracao` | integrado | Com que fontes o sistema está atendendo a carga? |
| 6 | Carga | `/setor-eletrico/carga` | integrado | Quanto o sistema está consumindo? |
| 7 | Rede | `/setor-eletrico/rede` | integrado | A rede está limitando o sistema? |
| 8 | Mercado | `/setor-eletrico/mercado` | **em integração** | Como a energia é contratada e liquidada? |
| 9 | Empresas | `/setor-eletrico/empresas` | **em integração** | Quem é dono de quê no setor elétrico? |
| 10 | Expansão | `/setor-eletrico/expansao` | **em integração** | Quanta capacidade está chegando, e de que fontes? |
| 11 | Regulação | `/setor-eletrico/regulacao` | **em integração** | Que regras mudaram, quando e com qual efeito declarado? |
| 12 | Aprenda | `/setor-eletrico/aprenda` | integrado (referência) | Como funciona o sistema, conceito a conceito? |
| 13 | Dados | `/setor-eletrico/dados` | integrado (referência) | O que é público sobre o setor, e o que já está integrado? |

Páginas adicionais fora da navegação principal: `/setor-eletrico/pld/modelos` (registro de modelos de previsão), `/setor-eletrico/pld/modelos/[modelo]` (ficha de cada modelo), `/setor-eletrico/pld/previsoes` (arquivo imutável de previsões), `/setor-eletrico/metodologia`, `/setor-eletrico/aprenda/[conceito]` (verbetes) e `/setor-eletrico/dados/[dataset]` (ficha de cada conjunto).

### 1.3 Os sete conjuntos de dados integrados

Fonte: `public/energia/gold/meta.json` e `catalogo.json`.

| Conjunto | Órgão | Granularidade | Referência do dado mais recente | Última captura (UTC) | Origem da captura |
|:--|:--|:--|:--|:--|:--|
| PLD_HORARIO (2021 a 2026) | CCEE | horária, por submercado | 30/09/2026 23h | 30/09/2026 02:20 | 2021 a 2025 por captura versionada (seed) de 27/09/2026; 2026 por coleta direta |
| EAR diário por subsistema | ONS | diária | 28/09/2026 | 30/09/2026 02:19 | coleta direta |
| ENA diário por subsistema | ONS | diária | 28/09/2026 | 30/09/2026 02:19 | coleta direta |
| Carga de energia diária | ONS | diária | 28/09/2026 | 30/09/2026 02:19 | coleta direta |
| Balanço de energia nos subsistemas | ONS | horária | 28/09/2026 | 30/09/2026 02:19 | coleta direta |
| Intercâmbios entre subsistemas | ONS | horária | 28/09/2026 | 30/09/2026 02:20 | coleta direta |
| CMO semanal (DECOMP) | ONS | semana operativa, por patamar | semana de 02/10/2026 | 29/09/2026 02:43 | coleta direta |

Na execução de 30/09/2026 não houve falha de construção nem regressão retida (`builders_falhos: []`, `regressoes: []`). A captura do ONS registrou revisões de valores já publicados: 44 na EAR, 360 na ENA, 33 na carga e 2.620 no balanço horário (campo `ultima_tentativa.detalhe` de `meta.json`).

### 1.4 Padrões de interface que valem para todas as páginas

**Painel de evidência** (`src/components/evidencia/PainelEvidencia.tsx`). Quase todo gráfico está dentro de um painel com seis partes fixas:

1. **Pergunta** como título, com o número principal embutido quando existe (ex.: "O SIN guarda 61,6% da energia armazenável máxima...").
2. **Por que isso importa.**
3. **O que mudou** (variações recentes, sempre com data).
4. **Como interpretar** (regra de leitura do gráfico).
5. **O que não é possível concluir** (limites explícitos da inferência).
6. **Proveniência** ("Sobre este dado"): órgão, conjunto, URL, licença, período, data de captura, data de validação, fórmula, transformações, snapshot com sha256, revisões conhecidas, limitações e link de download CSV.

**Selo de natureza do dado** (`SeloNatureza.tsx`): OBSERVADO (valor publicado pela fonte), CALCULADO (transformação feita pela plataforma), ESTIMADO, PREVISTO e CENÁRIO. Nesta publicação só aparecem OBSERVADO e CALCULADO.

**Três modos de profundidade na mesma página** (`ModoProfundidade.tsx`): Entender (padrão), Analisar (mais séries e comparações) e Auditar (regras, versões, sha256, downloads). O modo fica na URL (`?modo=analisar`). Sem JavaScript, todo o conteúdo aparece em ordem.

**Selo de conferência documental** (`Conferido`): cada afirmação conceitual indica se foi conferida em documento primário acessado (CONFERIDO) ou não (PENDENTE). Afirmações correntes no setor mas não conferidas aparecem em caixa tracejada, rotuladas "Leitura usual do setor, ainda não conferida em documento primário".

**Regra de ausência:** o que não está integrado aparece como bloco "Indisponível" com motivo, nunca como estimativa ou número de exemplo.

---

## 2. Descrição página a página e painel a painel

Legenda de estado usada daqui em diante:

* **COMPLETO:** publica dado integrado e responde à pergunta do título.
* **PARCIAL:** publica dado, mas não responde integralmente à pergunta do título ou tem bloco interno indisponível ou pendente de conferência.
* **SEM DADOS:** nenhum número publicado; só escopo e fontes catalogadas.

### 2.1 Mapa do Observatório (`/setor-eletrico`)

**Função:** página inicial e índice. Não publica número novo; aponta para onde cada número está.

**Conteúdo:**

* Cabeçalho com contagens dinâmicas: 7 conjuntos integrados (ONS e CCEE), 6 módulos com dados e 4 em integração, 17 verbetes conferidos na fonte primária, quatro submercados. Linha com a data de referência de cada fonte.
* **Seção 1, O sistema em seis passos** (`src/lib/energia/mapa.ts`):
  1. A água nos reservatórios (EAR, ENA, MLT) → Água e clima.
  2. A geração por fonte → Geração, com a explicação da quebra de 29/04/2023.
  3. O consumo: a carga → Carga, com as quebras de mar/2021 e 29/04/2023.
  4. A rede entre as regiões → Rede, declarando que os limites de intercâmbio não estão integrados.
  5. O custo e o preço de curto prazo → PLD (cinco capítulos), Modelos e Previsões.
  6. Contratos, empresas, expansão e regras → os quatro módulos em integração, **sem fonte integrada e sem número**.
* **Seção 2, Por pergunta:** quatro grupos (Para começar; Operação do sistema; Preço; Em integração).
* **Seção 3, Trilhas por perfil:** "Quem está começando" (5 passos), "Analista do setor" (7 passos, em modo Analisar) e "Regulador, auditor ou pesquisador" (6 passos, em modo Auditar).
* **Seção 4, Como ler o Observatório:** explica selos de natureza, conferência documental, ausências (usa como exemplo real o bloco de limites de intercâmbio indisponíveis) e módulos em integração.
* **Seção 5, Fontes e atualidade:** tabela com conjunto, referência dos dados, última captura e páginas onde aparece.

**Estado:** COMPLETO como índice. O passo 6 é um passo vazio por construção.

### 2.2 Visão geral (`/setor-eletrico/visao-geral`)

Sete blocos numerados. Os blocos 2 a 6 reaproveitam os painéis das páginas temáticas.

| Bloco | Pergunta | Visual | Valor publicado (fonte, data) | Estado |
|:--|:--|:--|:--|:--|
| 1. O sistema em 60 segundos | Síntese do dia | Cinco frases geradas por regra fixa, cada trecho com link para a evidência | Ver abaixo | COMPLETO |
| 2. Preço | PLD de hoje nos quatro submercados | Cartões do PLD | PLD médio SE/CO R$ 135,25/MWh em 30/09/2026 (CCEE) | COMPLETO |
| 3. Água | Quanta energia temos armazenada e quanta água está chegando? | Linha da EAR do SIN em 12 meses com faixa P10 a P90 e mediana histórica; fichas por subsistema | EAR SIN 61,6% em 28/09/2026 (ONS) | COMPLETO |
| 4. Geração | Como estamos gerando? | Barras 100% por janela (dia, 7 dias, mesmos 7 dias de 2023 a 2025, 30 dias, 12 meses) | Hidráulica, eólica e solar 89,4% da geração verificada nos 7 dias até 28/09/2026 (ONS) | COMPLETO |
| 5. Carga | Quanto estamos consumindo? | Linha da carga diária do SIN em 12 meses | Carga SIN 10,5% acima da mesma semana de 2025, 7 dias até 28/09/2026 (ONS) | COMPLETO |
| 6. Rede | A rede está limitando o sistema? | Mapa esquemático dos submercados com setas de fluxo e caixas de PLD; tabela por fronteira | Ver Rede | **PARCIAL** |
| 7. O que observar | Regras ativas | Lista de regras explícitas com estado ativo ou inativo | 3 de 6 regras ativas, mais 1 evento | COMPLETO |

**Frases do bloco 1 nesta publicação** (`sintese.json`, 30/09/2026):

1. Reservatórios do SIN com 61,6% da energia armazenável máxima, 12,4 p.p. acima da mediana histórica para 28/09/2026.
2. ENA dos 30 dias até 28/09/2026 equivalente a 168,6% da MLT.
3. Carga do SIN nos 7 dias até 28/09/2026 10,5% acima dos mesmos dias de 2025.
4. Térmicas com 10,6% da geração verificada nos 7 dias até 28/09/2026; mediana dos 12 meses anteriores de 12,4%.
5. PLD médio do SE/CO de R$ 135,25/MWh em 30/09/2026, faixa central (percentil 60,3 desde 2021), diferença de R$ 10,32/MWh entre o maior e o menor submercado.

**Regras do bloco 7 nesta publicação:**

| Regra | Condição | Estado em 30/09/2026 | Evidência publicada |
|:--|:--|:--|:--|
| Armazenamento fora da faixa usual | EAR de algum subsistema fora do P10 a P90 da data | Ativa | Nordeste 68,9%, acima da faixa de 14,2% a 68,0% |
| Afluência de 30 dias fora da faixa usual | ENA 30 dias fora do P10 a P90 da mesma janela | Ativa | SE/CO 147,8% da MLT (acima); Sul 253,4% (acima); Norte 52,2% (abaixo) |
| Diferença de preço entre submercados | Ao menos uma hora com diferença acima de R$ 1,00/MWh em 30 dias | Ativa | 55 de 720 horas (7,6%); maior diferença R$ 187,71/MWh em 30/09/2026 às 20h |
| Série de PLD sem atualização recente | Último dia de PLD mais de 2 dias antes do processamento | Inativa | 0 dias de defasagem |
| Participação térmica incomum | Térmica 7 dias fora do P10 a P90 das janelas do ano anterior | Inativa | 10,6%, faixa de 9,2% a 17,4%, percentil 24,7 |
| Carga entre as mais altas do ano | Carga do dia acima do P95 dos 364 dias anteriores | Inativa | 88.896 MWmed em 28/09/2026, percentil 93,7 |
| Evento: CMO semanal publicado | Publicação semanal do ONS | Evento | Semana de 02/10/2026: SE/CO, Sul e NE R$ 42,43/MWh; Norte R$ 461,46/MWh |

**Por que a Visão geral é PARCIAL:** o bloco 6 carrega a pergunta "A rede está limitando o sistema?" e não tem como responder a ela, pela mesma razão da página Rede (seção 2.8). Os demais blocos herdam as lacunas das páginas temáticas.

### 2.3 PLD (`/setor-eletrico/pld`)

Página central do observatório, organizada em cinco capítulos com os três modos de profundidade.

#### Capítulo 1. O que é (Entenda em 90 segundos)

* Texto principal: no Mercado de Curto Prazo, a CCEE apura o balanço de energia de cada perfil de agente por submercado e hora; o PLD é o preço desse mercado; é calculado diariamente para cada hora do dia seguinte, por NEWAVE, DECOMP e DESSEM, com base no CMO e dentro dos limites mínimo e máximos. Base: descrições oficiais dos conjuntos PLD_HORARIO, SUMARIO_BE_HORARIO_SUBMERCADO e SUMARIO_MENSAL_COMPRA_VENDA_SUBMERCADO no portal da CCEE, capturadas em 27 e 28/09/2026. Marcado CONFERIDO.
* Exemplo com preço real, em caixa tracejada: na hora mais cara de 30/09/2026 no SE/CO (18h), o PLD foi R$ 577,20/MWh. A leitura de liquidação (quem fecha a hora negativo compra a diferença a esse preço) é rotulada como "leitura usual do setor; regra ainda não conferida". **A plataforma não mostra valores de liquidação** porque as Regras de Comercialização da CCEE não foram conferidas.
* "A ideia central": hidráulica respondeu por 57,7% da geração verificada do SIN nos 12 meses até 28/09/2026 (ONS, CALCULADO). O mecanismo do valor da água (sistema hidrotérmico e intertemporal) aparece como leitura usual **não conferida** ("documentação dos modelos não acessada nesta fase").
* Coluna "O que o PLD não é", quatro cartões: não é tarifa (CONFERIDO); não é simplesmente o preço da última usina (**PENDENTE**); não é cotação de bolsa por lances (CONFERIDO); não é previsão meteorológica (CONFERIDO).
* Modo Auditar: íntegra do trecho da CCEE.

**Estado:** PARCIAL. A definição está conferida; o mecanismo econômico e a regra de liquidação não.

#### Capítulo 2. De onde vem o preço

* **Diagrama interativo de formação** (`DiagramaFormacao.tsx`, conteúdo em `src/lib/energia/conteudo/pld.ts`), com 10 nós: Chuva e afluências (ENA) → Reservatórios e valor da água (EAR) → Carga → Eólica, solar e outras → Disponibilidade e custo das térmicas (CVU) → Rede, intercâmbios e restrições → Modelos oficiais (NEWAVE, DECOMP, DESSEM) → CMO → Regras e limites → PLD. Cada nó mostra o que é, fonte, estado atual com número e link para o histórico, e a ligação com o nó seguinte com tipo de relação e estado de conferência.
* Tipologia de relações declarada: relação física, mecanismo econômico, informação usada pelos modelos, resultado dos modelos, regra regulatória, associação estatística, interpretação analítica, contribuição de modelo proprietário.
* **Painel CMO semanal** (modo Analisar): linha do CMO semanal por subsistema, últimas 104 semanas operativas, DECOMP. Semana de 02/10/2026: SE/CO, Sul e NE R$ 42,43/MWh; Norte R$ 461,46/MWh (semana anterior: R$ 97,89 e R$ 1.866,74).

**Estado:** PARCIAL. Motivos, com evidência:

1. Das 9 ligações entre nós, **5 estão PENDENTES** de conferência documental (afluências→reservatórios; reservatórios→otimização; carga→otimização; renováveis→otimização; rede→otimização) e 4 CONFERIDAS (térmicas→otimização; otimização→CMO; CMO→limites; limites→PLD). Fonte: `pld.ts`.
2. O nó "Modelos oficiais" não tem estado atual (`otimizacao: null` em `pld/page.tsx`). É o único nó sem número.
3. O nó "Regras e limites" mostra apenas o menor valor horário observado no ano (R$ 57,31/MWh em 2026 até 30/09), explicitamente "não é o piso regulatório". Os limites vigentes não foram auditados.
4. O CMO semi horário do DESSEM, que é a base temporal do PLD horário, está catalogado (conjunto "CMO semi horário" do ONS) e não integrado. O painel mostra só o CMO semanal do DECOMP.
5. O painel não explica por que o CMO do Norte (R$ 461,46 e R$ 1.866,74 nas duas últimas semanas) está dez vezes acima do PLD do Norte (R$ 135,25 em 30/09/2026, igual ao do SE/CO). Ver achado A1 na seção 4.

#### Capítulo 3. O que está acontecendo

* **Cartões do PLD** (um por submercado), dia 30/09/2026 (CCEE):

| Submercado | Média do dia (R$/MWh) | Mínimo horário | Máximo horário | Variação sobre o dia anterior | Percentil desde 2021 | Faixa |
|:--|--:|--:|--:|--:|--:|:--|
| SE/CO | 135,25 | 57,31 (6h) | 577,20 (18h) | +12,84 (+10,5%) | 60,3 | central |
| Sul | 127,86 | 57,31 (1h) | 577,20 (18h) | +13,03 (+11,4%) | 59,0 | central |
| Nordeste | 124,93 | 57,31 (6h) | 577,20 (18h) | +2,53 (+2,1%) | 64,4 | central |
| Norte | 135,25 | 57,31 (6h) | 577,20 (18h) | +12,84 (+10,5%) | 65,7 | central |

  Base do percentil: 2.099 médias diárias desde 01/01/2021, em valores nominais.

* **Painel de períodos** (`PldPeriodos.tsx`): alterna dia de referência (curva horária), 7 dias e 30 dias (valores horários), 12 meses (médias diárias) e histórico (médias mensais desde jan/2021). Para cada período: média, mínimo, máximo, volatilidade (desvio padrão amostral horário), permanência por faixa e horas com diferença entre submercados. Nos 30 dias até 30/09/2026: 55 horas com diferença acima de R$ 1,00/MWh.
* **Como classificamos** (modo Analisar): sete regras publicadas (dia de referência, média diária, posição histórica, volatilidade, permanência, menor valor do ano, diferença entre submercados).
* **Menor valor horário observado por ano** (modo Auditar): 2021 R$ 49,77; 2022 R$ 55,70; 2023 R$ 69,04; 2024 R$ 61,07; 2025 R$ 58,60; 2026 R$ 57,31 (até 30/09). Iguais nos quatro submercados. Rotulado "não é o piso regulatório".
* Snapshot `ccee_pld_horario@2026-09-30T02:20:14Z`, sha256 `673208f9...b8f2`, série de 01/01/2021 00h a 30/09/2026 23h.

**Estado:** COMPLETO nos dados. Lacunas declaradas: limites regulatórios não auditados; percentil calculado em valores nominais sobre anos com limites diferentes; a CCEE não informa data de publicação por hora (`publicacao_confiavel: false` no snapshot).

#### Capítulo 4. Submercados

* Mapa esquemático com PLD médio por submercado (30/09/2026) e fluxos por fronteira (28/09/2026), tabela com os dados do mapa.
* Texto: a CCEE calcula um PLD por submercado; o ONS mede o intercâmbio. A explicação de separação de preços por limite de transferência aparece como leitura usual **não conferida**.
* Painel de amplitude (modo Analisar): diferença diária entre o maior e o menor PLD médio. 30/09/2026: R$ 10,32/MWh; média de 30 dias R$ 2,42/MWh; maior nos 30 dias R$ 10,99/MWh em 24/09/2026.

**Estado:** PARCIAL. O mecanismo de separação está PENDENTE e os limites de intercâmbio não estão integrados; a página mostra que os preços se separam, mas não por quê.

#### Capítulo 5. Previsão

* Ilustração conceitual de distribuição (sem número) e a frase "Previsão é distribuição de possibilidades, não um único número".
* Bloco principal: **"Previsão indisponível"**. Motivo publicado: "Nenhum modelo de previsão do PLD está em produção: os quatro estão em pesquisa". Última execução: rodada interna de 27/09/2026 com o modelo B0 (em pesquisa), 28 previsões tentadas, nenhuma com número, motivo "nenhum PLD do período exigido havia sido capturado até o horário de corte", alerta de atraso após 08h.
* Três cartões explicativos para quando houver previsão: como ler, o que mudou desde a previsão anterior, se o modelo tem acertado. Todos dizem que ainda não há publicação.
* Modo Auditar: regras de governança (estados, imutabilidade, calibração, vazamento de informação futura).

**Estado:** SEM DADOS. É o capítulo que responde à pergunta mais demandada por um analista ("para onde o PLD pode ir?") e hoje não tem número.

### 2.4 Registro de modelos (`/setor-eletrico/pld/modelos`) e fichas

* Quatro modelos, todos em estado PESQUISA (`modelos.json`, 30/09/2026):

| Código | Nome | Descrição publicada |
|:--|:--|:--|
| B0 | Persistência | Repete a média do período mais recente encerrado no corte; serve de régua |
| C1 | Mistura fixa | Combina referências simples com pesos fixos; referências e pesos em arquivo de configuração **ainda não publicado** |
| C2-P | Correção por preços | Parte da persistência e corrige com informação recente de preço |
| C2-H | Correção com hidrologia | Parte da persistência e corrige com preço e hidrologia |

* Definições comuns: alvo é o PLD médio do período de entrega por submercado; horizontes W1 a W4 (semanas sábado a sábado) e M1 a M3 (meses civis); 7 horizontes × 4 submercados = 28 previsões por rodada; corte às 07h de Brasília, prazo de emissão às 08h; quantis de 5% a 95%; regra de defasagem LAT1D.
* `em_producao: []`.
* **Resultados retrospectivos retidos:** `publicacao_resultados.liberada = false`. Condições pendentes: conclusão da última etapa de validação (G4, não enviada), documentação de uma limitação encontrada na revisão (registro G23-R1), aceite da revisão do documento de origem (prévia interna `PLD_PREVISOES_EXPLICADAS v1-previa-r4`) e liberação formal pelo responsável.

**Estado:** PARCIAL. O registro existe e é transparente; não há nenhum número de desempenho publicado e a configuração do C1 não está pública.

### 2.5 Histórico de previsões (`/setor-eletrico/pld/previsoes`)

* Arquivo imutável com 28 registros, todos da rodada interna de 27/09/2026, todos sem número (`com_numero: 0`), calibração `NAO_CALIBRADO_NO_PILOTO`, 0 publicações, 0 apurações.
* Estado do pipeline declarado: "o registro de modelos e o arquivo de previsões estão ativos; não há previsão oficial publicada; **as rodadas ainda não são agendadas automaticamente**".

**Estado:** PARCIAL (estrutura pronta, conteúdo vazio).

### 2.6 Água e clima (`/setor-eletrico/agua-e-clima`)

| Painel | Modo | Pergunta e visual | Valor publicado (ONS, 28/09/2026) | Estado |
|:--|:--|:--|:--|:--|
| EAR do SIN | Entender | Linha de 12 meses com faixa P10 a P90 e mediana da mesma data desde 2001 | 61,6% da EAR máxima; mediana 49,3%; faixa 25,5% a 67,5%; percentil 80; queda de 0,8 p.p. em 7 dias e de 2,7 p.p. em 30 dias | COMPLETO |
| EAR por subsistema contra o padrão da data | Entender | Linhas de 3 anos e tabela com valor, mediana, P10 a P90, percentil e leitura | SE/CO 56,9% (perc. 72); Sul 82,6% (72); NE 68,9% (92, acima da faixa); Norte 73,1% (88). Maior desvio frente à mediana: Norte, +23,4 p.p. | COMPLETO |
| ENA por subsistema | Entender | Linhas de 18 meses em % da MLT e tabela de 30 dias | ENA 30 dias: SIN 168,6%; SE/CO 147,8% (perc. 96); Sul 253,4% (100); NE 67,0% (64); Norte 52,2% (4, abaixo da faixa) | COMPLETO |
| EAR de longo prazo | Analisar | Médias mensais desde jan/2000 | Set/2026 parcial: SIN 62,7% | COMPLETO |
| Regras, fonte e downloads | Auditar | Regras de cálculo e descrição do ONS | Cinco regras publicadas | COMPLETO |

**Lacunas declaradas na própria página:** a relação ENA → EAR (balanço hídrico) não é calculada porque a documentação do ONS não foi conferida; o período de referência da MLT não é informado pelo ONS; a EAR máxima mudou ao longo das décadas; a página não relaciona hidrologia a preço.

**Lacunas não declaradas, mas relevantes (inferência):** não há recorte por REE, bacia ou reservatório (conjuntos "EAR Diário por REE", "ENA Diário por REE", "EAR Diário por Bacia", "Dados Hidráulicos por Reservatório" estão catalogados); não há precipitação observada (catalogada, ONS) nem clima (INMET e ANA catalogados). O nome do módulo promete "clima" e não entrega nenhuma variável climática.

**Estado geral:** COMPLETO para a pergunta do título; PARCIAL para o que o nome "Água e clima" sugere.

### 2.7 Geração (`/setor-eletrico/geracao`)

| Painel | Modo | Visual | Valor publicado (ONS, balanço, 28/09/2026) | Estado |
|:--|:--|:--|:--|:--|
| Matriz por janela | Entender | Barras 100% (dia, 7 dias, mesmos 7 dias de 2025, 2024 e 2023, 30 dias, 12 meses) e tabela em MWmed | 7 dias: hidráulica 54,7%, térmica 10,6%, eólica 16,8%, solar 17,9%. Mesmos 7 dias de 2025: 47,2%, 16,8%, 22,4%, 13,5% | COMPLETO |
| Despacho térmico em contexto | Entender | Linha da participação térmica em janelas móveis de 7 dias, com mediana e faixa do ano anterior | 10,6%; mediana 12,4%; faixa 9,2% a 17,4%; percentil 24,7 | PARCIAL |
| Perfil horário do dia | Entender | Linhas por fonte, hora a hora | 28/09/2026 | COMPLETO |
| Trajetória desde 2021 | Analisar | Linhas diárias por fonte com marco em 29/04/2023 | 12 meses contra 12 anteriores: hidráulica 57,7% (antes 58,5%); térmica 12,5% (12,4%); eólica 15,3% (16,6%); solar 14,5% (12,5%) | COMPLETO |
| Composição por subsistema, 30 dias | Analisar | Barras por subsistema | | COMPLETO |
| Regras e downloads | Auditar | | Cinco regras | COMPLETO |

**Tratamento da quebra de regime:** em 29/04/2023 a solar do SIN no balanço passa de 1.991 para 4.377 MWmed de um dia para o outro (Sul: de 0,9 para 641,9 MWmed). A plataforma lê o salto como a inclusão da estimativa de MMGD, **leitura própria, não conferida em documento do ONS**, e por isso exclui 2021 e 2022 das comparações de composição.

**Lacunas declaradas:** a térmica não é separada por combustível nem por motivo de despacho (mérito, restrição, segurança); por isso "hidráulica, eólica e solar" não é chamada de participação renovável; participação não é capacidade instalada.

**Lacunas não declaradas, mas relevantes (inferência):** nada sobre corte de geração eólica e solar (constrained off), tema central da operação em 2025 e 2026; os seis conjuntos do ONS sobre isso estão catalogados e o verbete está PENDENTE. Não há capacidade instalada nem fator de capacidade (catalogados). Não há geração por usina (catalogada). Nuclear não aparece separada.

**Por que o painel térmico é PARCIAL:** ele mostra quanto as térmicas geraram, mas não por quê. Sem o conjunto "Geração Térmica por Motivo de Despacho" (catalogado), a pergunta implícita do analista (despacho por mérito ou fora da ordem de mérito) fica sem resposta.

### 2.8 Carga (`/setor-eletrico/carga`)

| Painel | Modo | Visual | Valor publicado (ONS, 28/09/2026) | Estado |
|:--|:--|:--|:--|:--|
| Carga do SIN contra o ano anterior | Entender | Linha diária de 3 anos com marcos de regime | Dia: 88.896 MWmed. 7 dias: +10,5% sobre 22 a 28/09/2025. 30 dias: +6,0%. Máximo em 12 meses: 92.081 MWmed em 19/02/2026 | COMPLETO |
| Carga por subsistema | Entender | Linhas por subsistema, mesma régua | 7 dias sobre o ano anterior: SE/CO +10,1%; Sul +12,8%; NE +10,5%; Norte +9,6% | COMPLETO |
| Carga desde 2000 | Analisar | Médias mensais com marcos em mar/2021 e mai/2023 | Set/2026 parcial (28 dias): 81.312 MWmed | COMPLETO |
| Regimes metodológicos | Auditar | Lista dos três regimes declarados pelo ONS | Até fev/2021; mar/2021 a 28/04/2023; desde 29/04/2023 | COMPLETO |

**Lacunas declaradas:** sem ajuste por temperatura, feriados ou dias úteis; variação de carga não mede atividade econômica; desde 29/04/2023 a série inclui MMGD estimada pelo ONS com dados meteorológicos previstos.

**Lacunas não declaradas, mas relevantes (inferência):** uma alta de 10,5% em uma semana, com todos os subsistemas entre +9,6% e +12,8%, é incomum para carga e a página não oferece nenhum elemento para separar clima, calendário e revisão da estimativa de MMGD. A captura de 30/09/2026 registrou 33 revisões de valores de carga já publicados. Não há a MMGD estimada separada da carga, o que impede saber quanto da variação vem da estimativa.

**Estado:** COMPLETO para "quanto", sem instrumento para "por quê".

### 2.9 Rede (`/setor-eletrico/rede`)

| Painel | Modo | Visual | Valor publicado | Estado |
|:--|:--|:--|:--|:--|
| Fluxos do dia | Entender | Mapa com setas e PLD; tabela por fronteira com verificado, programado, média de 30 dias e dias com diferença de preço | 28/09/2026 (ONS): NE→N 3.861 MWmed; N→SE/CO 668; NE→SE/CO 5.184; S→SE/CO 849 (programado 2.283) | PARCIAL |
| Intercâmbio líquido por subsistema | Entender | Quatro fichas | 28/09/2026: NE exportador 9.045 MWmed; Sul exportador 849; SE/CO importador 6.701; Norte importador 3.193 | PARCIAL |
| Fluxos em 12 meses | Analisar | Linhas por fronteira | | COMPLETO |
| Diferença de PLD entre submercados | Analisar | Amplitude diária | 30/09/2026: R$ 10,32/MWh | COMPLETO |
| Regras e downloads | Auditar | | Cinco regras, incluindo "nenhuma afirmação de congestionamento" | COMPLETO |

**Por que a página Rede é PARCIAL, e é a mais incompleta entre as integradas:**

1. **A pergunta do título não é respondida.** O título é "A rede está limitando o sistema?" e a própria página diz, no cabeçalho, que os limites de intercâmbio "ainda não estão integrados, e essa é a primeira informação que falta para responder à pergunta do título". O campo `limites_integrados` em `rede.json` é `false`.
2. **O saldo do SIN não fecha e não é explicado.** O balanço do ONS publica um valor de intercâmbio para o SIN inteiro; em 211 dos 365 dias até 28/09/2026 esse valor passou de 1 MWmed em módulo, e nesses dias os quatro saldos não somam zero. A página declara que não sabe o que esse valor representa.
3. **O desvio entre programado e verificado não é tratado.** Na fronteira S→SE/CO, em 28/09/2026, o verificado foi 849 MWmed contra 2.283 programados (37%). O dado está na tabela, sem comentário nem regra.
4. **Não há mapa de fronteiras com o exterior.** O conjunto "Intercâmbio do SIN com Outros Países" está catalogado.

### 2.10 Mercado (`/setor-eletrico/mercado`)

**Estado:** SEM DADOS. Componente `ModuloEmIntegracao`: aviso de módulo em integração, perguntas, pendências, verbetes relacionados e fontes catalogadas; nenhum número.

* **Escopo prometido:** ACL e ACR, agentes, contratos quando públicos, MRE, GSF, encargos de serviços do sistema e demais mecanismos da CCEE.
* **Perguntas prometidas:** participação do mercado livre e do regulado no consumo; agentes por categoria; trajetória do GSF; custo dos encargos de serviços do sistema.
* **Por que está incompleto (evidência do código):**
  1. Acesso automatizado ao portal da CCEE instável: recusado e aceito horas depois em 28/09/2026 para o PLD_HORARIO. A integração depende de coleta estável.
  2. As definições de ACL, ACR, MRE, GSF, ESS e garantia física não foram conferidas nas Regras de Comercialização e na Lei nº 10.848/2004; os seis verbetes estão PENDENTES.
  3. O catálogo tem **uma única entrada** para o tema mercado, genérica e com metadados não verificados: "Demais conjuntos do portal de dados abertos da CCEE (preços médios, contabilização, MRE e GSF, encargos, consumo, agentes)". Os conjuntos da CCEE não foram catalogados um a um.
* **Inferência:** o módulo está bloqueado mais por catalogação e conferência documental do que por coleta. A coleta do PLD_HORARIO funcionou por coleta direta em 29 e 30/09/2026, o que indica que o portal é alcançável.

### 2.11 Empresas (`/setor-eletrico/empresas`)

**Estado:** SEM DADOS.

* **Escopo prometido:** ligação entre grupo econômico, companhias, usinas, linhas, concessões e distribuidoras por identificadores oficiais (CNPJ, CEG, código ANEEL, código CVM), sem ligação por semelhança de nome.
* **Perguntas prometidas:** ativos por grupo; capacidade por grupo e fonte; DEC, FEC, perdas e tarifas por distribuidora; ativos e demonstrações das listadas.
* **Por que está incompleto:** falta o cadastro mestre de entidades com regras de ligação documentadas; faltam as integrações da ANEEL (SIGA, agentes, composição societária, DEC e FEC, tarifas) e da CVM. Catalogados no tema: 5 conjuntos (agentes, beneficiários da CDE, composição societária, cotações B3, DFP, ITR e FRE da CVM); no tema distribuição, 13 conjuntos da ANEEL.
* **Inferência:** é o módulo de maior esforço de engenharia (resolução de entidades) e o que mais depende de regra documentada antes de publicar.

### 2.12 Expansão (`/setor-eletrico/expansao`)

**Estado:** SEM DADOS.

* **Escopo prometido:** leilões de geração e transmissão, RALIE, outorgas, liberação para operação comercial e PDE da EPE (com selo CENÁRIO, nunca previsão).
* **Por que está incompleto:** integrações da ANEEL pendentes; catalogação verificada das publicações da EPE pendente. Catalogados no tema: apenas 3 (acréscimo anual de potência, hidrelétricas em estudo, PDE); RALIE, SIGA e resultado de leilões estão catalogados sob o tema geração.

### 2.13 Regulação (`/setor-eletrico/regulacao`)

**Estado:** SEM DADOS.

* **Escopo prometido:** linha do tempo de mudanças da ANEEL, CCEE, ONS e MME, com documento primário, contexto e efeito declarado.
* **Perguntas prometidas:** limites do PLD por ano e ato que os fixou; mudanças de formação de preço, bandeiras e contratação; consultas e audiências abertas.
* **Por que está incompleto:** integração de pautas, atas, audiências e consultas da ANEEL pendente; **levantamento dos limites anuais do PLD com documento primário pendente**, o que também trava a classificação do piso no capítulo 3 do PLD e o nó "Regras e limites" do diagrama.
* **Inferência:** esta é a pendência com maior efeito colateral no observatório: um único levantamento (atos anuais da ANEEL com PLD mínimo, máximo horário e máximo estrutural de 2021 a 2026) destrava três pontos do PLD e a primeira pergunta deste módulo.

### 2.14 Aprenda (`/setor-eletrico/aprenda`)

* 25 verbetes (`src/lib/energia/conteudo/conceitos.ts`), cada um com fonte oficial.
* **17 CONFERIDOS:** PLD, MCP, CMO, submercado, SIN, CVU, EAR, EAR máxima, ENA, MLT, carga, geração verificada, MMGD, intercâmbio, NEWAVE, DECOMP, DESSEM.
* **8 PENDENTES** ("em preparação", sem definição publicada e com `noindex`): REE, constrained off, ACL, ACR, MRE, GSF, ESS, garantia física.

**Estado:** PARCIAL. Os pendentes são exatamente os conceitos de mercado e de operação renovável que um analista mais consulta.

### 2.15 Dados (`/setor-eletrico/dados` e fichas)

* Catálogo vivo com 169 entradas (`catalogo.json`): 162 CATALOGADO, 4 UTILIZADO EM INDICADOR, 3 UTILIZADO EM MODELO. Por órgão: ONS 85, ANEEL 72, EPE 3, CCEE 2, e 1 cada de ANA, ANP, B3, CVM, IBGE, INMET e MME. 11 entradas descontinuadas; 11 com metadados não verificados (cadastro manual).
* Ficha por conjunto integrado: mudanças metodológicas, capturas (vintages) com sha256, downloads, como citar.
* Os estados intermediários previstos na documentação (EM INTEGRAÇÃO, INTEGRADO, VALIDADO) **não têm nenhuma entrada** nesta publicação: o catálogo salta de CATALOGADO para UTILIZADO.

**Estado:** COMPLETO como catálogo; a granularidade é desigual (ONS e ANEEL entrada a entrada pela API CKAN; CCEE com uma entrada agregada).

### 2.16 Metodologia (`/setor-eletrico/metodologia`)

Seções: taxonomia de natureza, unidades, regra editorial, linhagem e vintages, regras de classificação, frases e alertas da Visão geral, governança de previsão, limitações gerais, versão da publicação.

**Estado:** COMPLETO, com uma afirmação a corrigir (achado A6).

---

## 3. Quadro de completude

| Página ou painel | Estado | Motivo principal da incompletude |
|:--|:--|:--|
| Mapa | COMPLETO | Passo 6 vazio por construção |
| Visão geral | PARCIAL | Bloco Rede não responde à pergunta |
| PLD cap. 1, O que é | PARCIAL | Regras de Comercialização e mecanismo do valor da água não conferidos; sem valores de liquidação |
| PLD cap. 2, Formação | PARCIAL | 5 de 9 ligações pendentes; nó dos modelos sem estado; CMO DESSEM não integrado; limites não auditados |
| PLD cap. 3, O que acontece | COMPLETO | Percentil sobre regimes de limites diferentes; piso não classificado |
| PLD cap. 4, Submercados | PARCIAL | Mecanismo de separação pendente; sem limites de intercâmbio |
| PLD cap. 5, Previsão | SEM DADOS | Nenhum modelo em produção; rodadas não agendadas |
| Registro de modelos | PARCIAL | Resultados retidos; configuração do C1 não publicada |
| Histórico de previsões | PARCIAL | 28 registros, nenhum com número |
| Água e clima | COMPLETO / PARCIAL | Sem REE, bacia, precipitação e clima |
| Geração | COMPLETO / PARCIAL | Térmica sem combustível e motivo; sem constrained off; sem capacidade |
| Carga | COMPLETO | Sem ajuste de clima e calendário; MMGD não separada |
| Rede | **PARCIAL** | Pergunta do título sem resposta: limites não integrados |
| Mercado | SEM DADOS | Catalogação CCEE agregada; verbetes pendentes; conferência das Regras |
| Empresas | SEM DADOS | Cadastro mestre de entidades inexistente |
| Expansão | SEM DADOS | ANEEL e EPE não integradas |
| Regulação | SEM DADOS | Limites do PLD e linha do tempo não levantados |
| Aprenda | PARCIAL | 8 de 25 verbetes pendentes |
| Dados | COMPLETO | Granularidade desigual do catálogo |
| Metodologia | COMPLETO | Afirmação sobre limites catalogados a corrigir |

Síntese numérica: de 20 unidades avaliadas, 5 completas, 2 completas com lacuna de escopo, 8 parciais e 5 sem dados (os quatro módulos em integração e o capítulo de previsão).

---

## 4. Achados de consistência desta leitura

Cada achado separa evidência, inferência e recomendação. Nenhum deles está hoje sinalizado na interface como problema.

**A1. CMO do Norte dez vezes acima do PLD do Norte, sem explicação.**
* Evidência: CMO semanal DECOMP do Norte R$ 1.444,32 (semana de 18/09/2026), R$ 1.866,74 (25/09/2026) e R$ 461,46 (02/10/2026), contra R$ 42,43 a R$ 97,89 nos outros subsistemas (`cmo.json`). PLD médio do Norte em 30/09/2026 de R$ 135,25/MWh, idêntico ao do SE/CO (`pld.json`). O painel diz genericamente que CMO e PLD "podem diferir muito".
* Inferência: o descolamento é o fato mais chamativo da página e o usuário não tem como interpretar o dado. Pode refletir restrição local modelada no DECOMP que não aparece no DESSEM, o teto do PLD ou diferença de discretização; nenhuma dessas hipóteses foi conferida.
* Recomendação: integrar o CMO semi horário do DESSEM (catalogado) para comparar com a base efetiva do PLD horário e criar regra "CMO semanal de um subsistema acima de N vezes o PLD médio da semana", com texto neutro.

**A2. CMO igual a zero em todos os subsistemas por 61 semanas seguidas, sem nota na interface.**
* Evidência: de 30/12/2022 a 23/02/2024, 61 semanas consecutivas com CMO 0,0 no SE/CO, Sul, NE e Norte, nos três patamares e na média; outras semanas isoladas com zero em 2007, 2008, 2010, 2011, 2019, 2020 e nov/2022 (`public/energia/series/cmo_semanal.csv`). O valor vem assim do ONS; não é preenchimento da plataforma. No mesmo período, o PLD médio mensal do SE/CO ficou em R$ 69,04/MWh de jan a ago/2023 e subiu para R$ 74,09 a R$ 84,40 de set a dez/2023 (`pld.json`).
* Inferência: o CMO zero é compatível com o ano úmido de 2023 e reforça o achado A4 (PLD no menor valor do ano por oito meses). De set a dez/2023, porém, o PLD saiu desse valor com CMO semanal ainda em zero, o que é outro caso do descolamento do achado A1. O gráfico do painel (104 semanas) já não alcança o período; o CSV publicado sim.
* Recomendação: registrar na proveniência do CMO que zero é valor publicado pelo ONS e usar o episódio de 2023 como exemplo didático de CMO semanal e PLD horário com bases diferentes.

**A3. Unidade do CMO declarada de forma ambígua pela fonte.**
* Evidência: limitação publicada: o dicionário do ONS indica R$/MW para a média semanal e R$/MWh para os patamares; a plataforma trata ambas como R$/MWh.
* Recomendação: manter a limitação e registrar a confirmação quando obtida.

**A4. O "menor valor observado no ano" coincide, ano a ano, com o valor usualmente citado como piso regulatório.**
* Evidência: menores valores horários por ano: 49,77 (2021), 55,70 (2022), 69,04 (2023), 61,07 (2024), 58,60 (2025), 57,31 (2026 até 30/09), idênticos nos quatro submercados; em 30/09/2026 o PLD ficou nesse valor por 10 a 14 horas, conforme o submercado (`pld.json`).
* Inferência, não conferida em documento primário nesta sessão: os valores de 2021 a 2025 coincidem com os PLD mínimos homologados pela ANEEL que conheço. A plataforma faz certo ao não chamar de piso sem documento, mas o custo de conferir é baixo e o ganho é alto.
* Recomendação: levantar os atos anuais da ANEEL (PLD mínimo, máximo horário e máximo estrutural de 2021 a 2026) e integrar esses valores ao pipeline. Destrava o nó "Regras e limites", a classificação de horas no piso e no teto, a comparação entre anos e a primeira pergunta do módulo Regulação.

**A5. Saldos por subsistema não fecham no SIN em 211 de 365 dias.**
* Evidência: `rede.json`, bloco `balanco_sin`.
* Recomendação: conferir o significado do campo "intercâmbio do SIN" no dicionário do ONS; se for troca internacional, integrar "Intercâmbio do SIN com Outros Países" e fechar o balanço.

**A6. A Metodologia afirma que os limites de intercâmbio estão catalogados; o catálogo não tem conjunto com esse conteúdo.**
* Evidência: `metodologia/page.tsx` diz "Limites de intercâmbio, CVU por usina, geração por usina e por motivo de despacho estão catalogados". Busca nos 169 títulos de `catalogo.json`: CVU, geração por usina e motivo de despacho existem; limites de intercâmbio não. O mais próximo é "Dados dos indicadores de confiabilidade da rede básica: ATLS" e "Dados de Intercâmbio de Energia por Modalidade".
* Inferência: a lacuna central da página Rede pode não ter fonte aberta pronta; se não tiver, a pergunta do título precisa mudar ou declarar que depende de fonte não publicada.
* Recomendação: identificar a fonte dos limites (ONS, dados abertos ou documentos da programação) e corrigir a frase da Metodologia.

**A7. Carga com alta de 10,5% em uma semana, sem ferramenta de explicação.**
* Evidência: `carga.json`, 7 dias até 28/09/2026; 33 revisões de carga na captura de 30/09/2026 (`meta.json`).
* Inferência: variação atípica para carga agregada; pode combinar calor, calendário e revisão da estimativa de MMGD.
* Recomendação: publicar a MMGD estimada separada e uma regra de alerta para variação anual acima de um limiar em 7 dias, com o texto "sem ajuste de clima".

**A8. Previsão com desenho operacional que falhou na primeira rodada.**
* Evidência: corte às 07h de Brasília com prazo às 08h; atualização diária agendada para 20:40 de Brasília; única rodada emitida em 27/09/2026 às 16:10 de Brasília, 28 células sem número por falta de PLD capturado até o corte; "rodadas ainda não são agendadas automaticamente" (`previsoes.json`).
* Inferência: o PLD do dia seguinte é publicado pela CCEE no fim da tarde; uma coleta às 20:40 da véspera cobre o corte das 07h. A falha de 27/09 vem de rodada manual fora de horário, não de desenho impossível.
* Recomendação: agendar a rodada logo após a coleta noturna, com verificação de corte; só então avaliar gates.

**A9. Data de publicação do PLD não confiável para reconstrução no tempo.**
* Evidência: `publicacao_confiavel: false` no snapshot do PLD; `publicado_pela_fonte_em: null`; a CCEE não informa a publicação por hora.
* Inferência: testes retrospectivos da previsão dependem da regra LAT1D, não de datas de publicação observadas; isso deve estar explícito no registro de modelos quando os resultados forem liberados.

**A10. Governança prevista e não executada.**
* Evidência: `PLANO_IMPLEMENTACAO.md` exige nota de 0 a 10 por página em dez dimensões, registrada em `docs/observatorios/AVALIACAO_PAGINAS.md`. O arquivo não existe no repositório em 30/09/2026.
* Recomendação: criar o arquivo com a avaliação das páginas centrais (PLD, Visão geral, Rede) antes de nova rodada de expansão.

---

## 5. Lacunas de escopo (o que o observatório não promete e deveria considerar)

Inferência, a partir do catálogo e das perguntas de um público profissional:

1. **Consumidor e tarifa.** O PLD explica que não é tarifa, mas nenhum módulo mostra tarifa, bandeira tarifária ou componentes tarifários. "Bandeiras Tarifárias", "Componentes Tarifárias", "Tarifas de aplicação das distribuidoras" e "Subsídios Tarifários" (ANEEL) estão catalogados. O plano (fase 6) cita distribuição, mas a navegação não tem módulo de Distribuição; o tema está diluído em Empresas.
2. **Corte de renováveis (constrained off).** Seis conjuntos do ONS catalogados, verbete pendente, nenhuma menção nas páginas de Geração e Rede.
3. **Custo de operação e encargos.** ESS aparece só como pergunta futura de Mercado.
4. **Clima.** O módulo "Água e clima" não tem variável climática.
5. **Comparação PLD × CMO DESSEM.** Seria o elo que falta entre o capítulo 2 e o capítulo 3 do PLD.

---

## 6. Recomendações priorizadas

| Prioridade | Ação | Destrava | Esforço estimado (inferência) |
|:--|:--|:--|:--|
| 1 | Levantar e integrar os limites anuais do PLD (atos ANEEL, 2021 a 2026) | Nó "Regras e limites", classificação de piso e teto, comparação entre anos, 1ª pergunta de Regulação | Baixo |
| 2 | Identificar a fonte dos limites de intercâmbio e integrar, ou reformular a pergunta da Rede | Pergunta título de Rede e bloco 6 da Visão geral; capítulo 4 do PLD | Médio a alto |
| 3 | Integrar CMO semi horário do DESSEM e explicar o descolamento CMO × PLD | Capítulo 2 do PLD; achado A1 | Médio |
| 4 | Agendar as rodadas de previsão após a coleta noturna | Capítulo 5 do PLD, histórico de previsões | Baixo |
| 5 | Conferir Regras de Comercialização e Lei 10.848/2004 | 6 verbetes de mercado, exemplo de liquidação, módulo Mercado | Médio |
| 6 | Catalogar a CCEE conjunto a conjunto | Módulo Mercado | Baixo |
| 7 | Integrar Geração Térmica por Motivo de Despacho e constrained off | Painel térmico; lacuna de renováveis | Médio |
| 8 | Publicar MMGD estimada separada da carga | Leitura da carga; achado A7 | Médio |
| 9 | Conferir a documentação do ONS sobre balanço hídrico e modelos | 5 ligações pendentes do diagrama | Médio |
| 10 | Criar `AVALIACAO_PAGINAS.md` e rodar a avaliação prevista no plano | Governança | Baixo |

---

## 7. Perguntas para o revisor

Para orientar a crítica, peço atenção especial a estes pontos:

1. **Didática contra rigor.** A regra de marcar tudo que não foi conferido (caixas tracejadas, selos PENDENTE) protege a auditabilidade. Ela deixa a página do PLD mais difícil de ler para um público não especialista? Há excesso de ressalvas no capítulo 1?
2. **Rede.** É aceitável manter um título que a página declara não conseguir responder? Qual reformulação preserva o interesse sem prometer o que não entrega?
3. **Percentil em valores nominais desde 2021.** É a régua certa para "faixa baixa, central, alta" dado que os limites mudam por ano? Alternativas: percentil por ano, por regime de limites, ou distância ao piso.
4. **Síntese por regra.** As cinco frases e as seis regras do bloco "O que observar" cobrem o que um leitor profissional espera ver no topo? O que falta (por exemplo, CMO muito acima do PLD, carga atípica, horas no piso)?
5. **Governança de previsão.** Os quatro estados de modelo, os gates e o arquivo imutável são proporcionais para um observatório público? Faz sentido publicar o B0 como referência mesmo em pesquisa, rotulado como tal?
6. **Priorização.** A ordem da seção 6 está correta do ponto de vista de valor para o usuário? O que você colocaria antes?
7. **Escopo.** A ausência de um módulo de tarifa e distribuição é uma falha de desenho ou uma escolha defensável para um observatório de operação e preço?
8. **Leitura dos números de 28 a 30/09/2026.** Algum dos valores publicados (ENA do Sul 253,4% da MLT, ENA do SE/CO 147,8% em setembro, carga +10,5% em 7 dias, CMO do Norte R$ 1.866,74) parece implausível a ponto de exigir verificação antes de publicação?

---

## Anexo A. Arquivos de referência

| Tema | Arquivo |
|:--|:--|
| Navegação e estados dos módulos | `src/lib/energia/navegacao.ts` |
| Mapa, passos e trilhas | `src/lib/energia/mapa.ts`, `src/app/setor-eletrico/page.tsx` |
| Visão geral | `src/app/setor-eletrico/visao-geral/page.tsx` |
| PLD | `src/app/setor-eletrico/pld/page.tsx`, `src/lib/energia/conteudo/pld.ts` |
| Modelos e previsões | `src/app/setor-eletrico/pld/modelos/`, `src/app/setor-eletrico/pld/previsoes/`, `pipeline/energia/registro_modelos.json`, `pipeline/energia/previsoes/arquivo.jsonl` |
| Páginas temáticas | `src/app/setor-eletrico/{agua-e-clima,geracao,carga,rede}/page.tsx` |
| Módulos em integração | `src/app/setor-eletrico/{mercado,empresas,expansao,regulacao}/page.tsx`, `src/components/energia/ModuloEmIntegracao.tsx` |
| Verbetes | `src/lib/energia/conteudo/conceitos.ts` |
| Componente de painel | `src/components/evidencia/PainelEvidencia.tsx` |
| Dados publicados | `public/energia/gold/*.json`, `public/energia/series/*.csv` |
| Pipeline | `pipeline/energia/` (coletores ONS e CCEE, gold por tema, governança) |
| Documentação de arquitetura | `docs/observatorios/` |

## Anexo B. Números citados, com fonte e data

| Número | Valor | Fonte | Data de referência |
|:--|:--|:--|:--|
| PLD médio SE/CO | R$ 135,25/MWh | CCEE, PLD_HORARIO | 30/09/2026 |
| PLD máximo horário (4 submercados) | R$ 577,20/MWh às 18h | CCEE, PLD_HORARIO | 30/09/2026 |
| Menor PLD horário do ano | R$ 57,31/MWh | CCEE, PLD_HORARIO | 01/01 a 30/09/2026 |
| Horas com diferença entre submercados acima de R$ 1/MWh | 55 de 720 (7,6%) | CCEE, cálculo Scrutiniums | 30 dias até 30/09/2026 |
| EAR do SIN | 61,6% da EAR máxima | ONS, cálculo Scrutiniums | 28/09/2026 |
| ENA 30 dias do SIN | 168,6% da MLT | ONS, cálculo Scrutiniums | 30 dias até 28/09/2026 |
| Carga do SIN | 88.896 MWmed | ONS | 28/09/2026 |
| Variação da carga, 7 dias | +10,5% sobre 2025 | ONS, cálculo Scrutiniums | 22 a 28/09/2026 |
| Participação térmica, 7 dias | 10,6% | ONS, cálculo Scrutiniums | 22 a 28/09/2026 |
| Hidráulica, 12 meses | 57,7% | ONS, cálculo Scrutiniums | 12 meses até 28/09/2026 |
| Fluxo NE→SE/CO | 5.184 MWmed | ONS | 28/09/2026 |
| CMO semanal Norte | R$ 461,46/MWh | ONS, DECOMP | semana de 02/10/2026 |
| Entradas no catálogo | 169, das quais 7 em uso | Scrutiniums, catálogo | 30/09/2026 |
| Verbetes conferidos | 17 de 25 | Scrutiniums | 30/09/2026 |
| Previsões com número | 0 de 28 | Scrutiniums, arquivo de previsões | rodada de 27/09/2026 |
