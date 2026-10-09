# Avaliação independente de dados e método, rodada 3

Painéis de educação do OBEE (Observatório Brasileiro de Eficiência Estatal), "Educação nas capitais".

## 1. Identificação e natureza

* **Avaliador**: avaliador de dados e método, independente, rodada 3 (agente Claude Code, contexto limpo). Não implementou correções: não alterou `src/`, `scripts/`, `public/`, `pipeline/`, `docs/` fora desta pasta, nem testes. Escreveu apenas este relatório e os arquivos de `docs/obee/avaliacao/rodada-3/evidencias/dados/`; os temporários ficaram na pasta de rascunho da sessão.
* **Escopo**: os seis painéis (Panorama, Gastos, Atendimento, Resultados, Comparar capitais, Dados e métodos) nos critérios E (indicadores, referências e comparabilidade), F (rigor metodológico), G (rastreabilidade e reprodutibilidade) e K (confiabilidade técnica e desempenho) de `docs/obee/avaliacao/RUBRICA.md`. Os demais critérios são de outro avaliador.
* **Independência**: li apenas a rubrica dentro de `docs/obee/avaliacao/`. Não li rodadas anteriores, EXECUCAO.md nem a pasta depois/. Não usei `git log`, `git diff` nem `git show`. Li o código (`src/`, `pipeline/eficiencia/`), a gold, as séries, o catálogo, os seeds e a documentação de método em `docs/obee/` (exceto `avaliacao/`). Avaliei o que encontrei, do zero.
* **Natureza das notas**: privadas, sobre a qualidade dos painéis, não das administrações. Inspeção heurística e recálculo por um agente; não há teste com usuários reais, e nenhum tempo ou taxa de sucesso humano é afirmado.
* **Data da avaliação**: 09/10/2026. Gold avaliada: `hash_dados` 326adb15ec058bd4, `versao_catalogo` 2026-10-09.1, `versao_codigo` gerador-ce6dd2df1dd5, `gerado_em` 2026-10-09T07:05:07Z, `dados_capturados_ate` 2026-10-08T20:41:34Z.
* **Build avaliado**: `http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais` (respondeu 200 durante toda a avaliação; não reconstruí nem encerrei processos).

## 2. Resultado em uma linha

Os números dos indicadores estão corretos (140.693 checagens de exibição contra recálculo próprio sem divergência de valor e 100% das fontes oficiais conferidas, incluindo 130 DCA, 130 RREO, 104 populações e 3.016 valores do INEP), a rastreabilidade é excelente e a gold se reconstrói bit a bit; o conjunto **não é aprovável** nesta rodada por dois bloqueios localizados (série da mediana com conjunto variável de capitais na despesa por matrícula, sem n por ano; e a parcela intraorçamentária de Boa Vista 2024 calculada com um RREO declarado errado), mais o rótulo omitido da disciplina do Saeb na Tabela completa e o pouco destaque das limitações de comparabilidade da despesa; notas de 8,3 a 9,3, média 8,9.

## 3. Matriz de notas (painel | critério | nota | justificativa | evidência | correção necessária)

Avaliador: agente de dados e método, rodada 3. Notas com uma casa decimal. "E1" a "E14" referem-se aos grupos de arquivos de evidência listados na seção 14; os códigos de problema (A1 a A5, M1 a M11, B1 a B5) estão na seção 11.

| Painel | Critério | Nota | Justificativa | Evidência | Correção necessária |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,7 | Mediana, média, menor e maior com empates, faixa central (n ≥ 8), referência nacional do mesmo universo (INEP, Brasil, rede municipal) para alunos por turma e Ideb, e referência calculada pelo OBEE (5.060 municípios) rotulada como outro universo. Todos os valores do Panorama (por exemplo R$ 702, R$ 1.160, R$ 2.362; 20,5, 25,0, 29,5; 4,8, 6,1, 6,9) batem com o recálculo. Desconto: a aba Por matrícula mostra São Paulo como máximo (R$ 23.747) sem a participação das conveniadas (40,7%) nem a parcela indeterminada (20,3%); a parcela intraorçamentária por capital (0,0% a 32,2%) não é corrigida; o bloco "Contexto nacional" (R$ 2.125, mediana de 5.060 municípios) fica ao lado de capitais com universo e perímetro distintos, embora rotulado. | E4, E7, E8; `src/lib/eficiencia/panorama.ts`; rota `/` | Mostrar junto da aba Por matrícula a participação das conveniadas e a parcela indeterminada; destacar no gráfico de despesa as capitais com parcela intraorçamentária alta. |
| Panorama | F | 8,7 | Perímetro (função 12, exceto intraorçamentárias, estágio liquidado) dito junto do número, valores correntes avisados, "Por matrícula" definido como razão orçamentária e não custo, ausência nunca vira zero, ano escolhido por regra explícita (maior ano com metade das capitais). Desconto: caveats do denominador da razão por matrícula ficam em "Fonte e critérios". | E4, E8; rota `/` | Trazer ao nível do cartão a ressalva do denominador (rede municipal, sem conveniadas). |
| Panorama | G | 8,8 | Cada medida tem "Fonte e critérios", link para Fontes e metodologia e download da gold (JSON de 6,7 MB, tamanho informado). Data de captura no cabeçalho (08/10/2026). Como página de entrada, o acesso às fontes e a correspondência com os módulos são claros. Desconto: o download oferecido é a gold inteira, sem opção de CSV de recorte na própria entrada. | E8, E9; rota `/`; `src/app/eficiencia-estatal/educacao-municipal-capitais/page.tsx` | Link direto para o CSV de série do indicador exibido. |
| Panorama | K | 9,2 | Sem erro de cálculo, de navegação ou de console (0 erros de console em 5 cargas desktop, 3 móvel 4× e 3 móvel lento); CLS 0 (0,033 no perfil móvel lento, abaixo de 0,1); FCP e LCP de 200 ms (laboratório, desktop) e 1,26 s no perfil móvel lento; HTML de 31 kB comprimidos; conteúdo principal no HTML estático. Desconto: 163 kB de JS comprimido (18 a 19 arquivos) compartilhados com o site inteiro; TBT de 0,7 s com CPU 4× mais lenta. | E12; ver seção 10 | Nenhuma correção obrigatória. |
| Gastos | E | 8,5 | Três escalas com mediana, média, extremos nomeados com empates, faixa central, razão agregada distinta da média simples (com denominador), referência nacional calculada (mediana R$ 2.125, razão agregada R$ 1.720, 90,8% dos municípios, 93,2% da população) e contexto da OCDE em seção própria, com as incompatibilidades declaradas. As 27.147 checagens de exibição e CSV não tiveram divergência de valor. Desconto: série da mediana sem capital compara conjuntos diferentes de capitais (bloqueio, seção 12); parcela intraorçamentária heterogênea só na Tabela completa e no CSV; razão por matrícula com denominador que exclui conveniadas (até 49,7%) e numerador com parcela indeterminada (2,3% a 27,9%), sem esses dados no gráfico; sem grupo de pares por porte. | E4, E6, E7, E8; `ExploradorTema.tsx:178-190`; `consulta.ts:313-323` | Ver problemas A1, A3, A4 (seção 11). |
| Gastos | F | 8,3 | Estágio liquidado, preços correntes e IPCA (média anual do número-índice, conferida na fonte), quebra da população (2021 e 2023) com variação bloqueada, Campo Grande 2021 fora de gráfico, resumo e CSV de modo consistente, Boa Vista 2024 incluída com a ressalva. A frase da Evolução "Na mediana das capitais, a razão ... passou de R$ 9.631 em 2021 para R$ 14.254 em 2025" compara medianas de 24 e 26 capitais; com painel equilibrado a variação seria +64,7% e não +48,0% (real) ou +106,4% e não +85,4% (nominal), e a frase vizinha diz "Há dados comparáveis para as 26 capitais". | E6, E8; `frases.ts:148-174`; rota `/gastos?med=despesa_mat&moeda=real&vis=evolucao` | Mostrar n por ano na frase e na tabela da série, ou usar painel equilibrado, ou suspender a frase de variação da mediana quando n muda; teste de regressão. |
| Gastos | G | 9,1 | Cada linha do CSV traz registro de origem, versão metodológica, `dados_gerados_em` e `hash_dados`; a gold, os 12 CSV por indicador, o manifesto (49 capturas, URL, data, sha256) e a página concordam; o hash é reproduzível por fora; reproduzi Aracaju 2025 da fonte à razão por matrícula (R$ 16.558,01) com a documentação pública. Desconto: dicionário público cobre só os 32 campos das séries por indicador. | E7, E8, E9 | Ver M2, M3. |
| Gastos | K | 8,9 | Sem erro de valor em 27.147 checagens; CLS 0; HTML de 81 kB comprimidos; conteúdo oculto 0,3 a 0,4 s para links com recorte (desktop). Desconto: nenhum teste cobre a composição da série da mediana nem compara o DOM com a gold; roteiros de interação em `scripts/obee/` não rodam no CI. | E10, E12, E13; seção 10 | Teste da composição da mediana; teste de DOM contra a gold. |
| Atendimento | E | 9,0 | Referências nacionais oficiais do mesmo universo (INEP, rede municipal do Brasil) para alunos por turma em quatro etapas, com a diferença na unidade certa; OCDE como contexto separado (ISCED 1 e 2, instituições públicas, ano da OCDE dito); matrículas e conveniadas sem referência nacional por dependerem do tamanho da rede, e isso é dito. 34.901 checagens sem divergência. Desconto: série da mediana com n variável (alunos por turma, anos finais, 23 a 24 capitais: variação publicada −4,5% contra −1,9% no painel equilibrado). | E4, E6, E8 | n por ano na frase da Evolução. |
| Atendimento | F | 9,0 | Matrícula de escola municipal, conveniadas à parte e nunca somadas, zero só quando a fonte informa zero, não aplicável distinto de não divulgado (Rio Branco, Macapá, Boa Vista), partição por etapa que soma o total em 260 de 260 casos por tabela, e matrículas de 2025 (total, creche e pré-escola, 78 valores) iguais à Sinopse Estatística do INEP. Desconto menor: mesmo mecanismo da composição da mediana na Evolução, com efeito pequeno (no máximo 2,5 pontos percentuais). | E4, E7, E8 | n por ano na frase da Evolução. |
| Atendimento | G | 9,1 | Trilhas de reprodução para matrículas, conveniadas e alunos por turma (Aracaju 2025), regra de elegibilidade, recorte versionado do Censo com sha256 e MD5 do INEP; exportação com universo, nota e fonte. | E8, E9 | Ver M2, M3. |
| Atendimento | K | 9,2 | 0 erros de console; CLS 0; HTML de 65 kB comprimidos; sem divergência em 500 páginas e 500 CSV. | E4, E10, E12; seção 10 | Nenhuma obrigatória. |
| Resultados | E | 9,0 | Aprovação, Ideb e Saeb (Matemática e Língua Portuguesa) com referência nacional do mesmo universo, bienalidade tratada (ano par aponta a edição anterior, dita no título), pandemia anotada em 2021, metas do Ideb não exibidas por induzirem leitura de cumprimento, ND e ND* preservados. 30.244 checagens e 3.016 valores conferidos contra os arquivos do INEP sem divergência. Desconto: série da mediana com n variável (Ideb, anos finais, 2005 a 2025: n de 22 a 26; +55,6% publicado contra +60,3% equilibrado). | E4, E6, E8 | n por ano na frase da Evolução. |
| Resultados | F | 8,9 | Nenhum alinhamento artificial entre despesa anual e resultado bienal; "ano letivo" para aprovação; V11 (Ideb = N × P, 542 combinações) refeito por mim com tolerância de 0,1 e sem exceção. Desconto: mesmo mecanismo da composição da mediana. | E4, E7, E8 | Idem. |
| Resultados | G | 9,1 | Ideb 2025 com sha256 do pacote, MD5 do INEP, nota informativa de 2021 citada; trilha do Ideb mostra N, P e a conta; as 11 edições vêm da mesma planilha de 2025 (declarado). | E8, E9 | Ver M2, M3. |
| Resultados | K | 9,2 | 0 erros de console; CLS 0; HTML de 69 kB comprimidos; recorte via URL aparece em cerca de 0,3 s no desktop. | E4, E12; seção 10 | Nenhuma obrigatória. |
| Comparar capitais | E | 8,6 | Gráfico e Tabela completa com cinco destaques, grupos todas/região, linhas de resumo (mediana, média, menor, maior, n com valor e na comparação) e 32.236 checagens de células, resumos e CSV sem divergência. Desconto: coluna "Saeb" da Tabela completa e do CSV não diz a disciplina (Matemática por padrão); média simples da despesa total (R$ 2,42 bilhões) é dominada por São Paulo; aviso de que gasto, atendimento e resultado são de períodos próprios está presente. | E4, E13; `consulta.ts:869-881, 1033-1055` | Ver A2. |
| Comparar capitais | F | 8,6 | Ano par com Ideb e Saeb mostra traço, com a explicação da bienalidade acima da tabela, e não um número; creche e pré-escola corretas na tabela; Campo Grande 2021 fora da comparação no gráfico, na tabela, no resumo e no CSV. Desconto: Saeb sem disciplina rotulada (valor correto, identificação insuficiente); com Medida=Ideb o ano da tabela inteira muda para uma edição, sem aviso. | E4, E13 | Ver A2. |
| Comparar capitais | G | 9,0 | CSV da tabela com `coluna`, `valor_numerico`, `valor_exibido`, `unidade`, estado, elegibilidade, nota, versão, data e hash; dicionário baixável. Desconto: o CSV usa ponto e vírgula e decimal com ponto; aviso "leia antes de usar" só no dicionário. | E4, E11 | Ver M4. |
| Comparar capitais | K | 9,0 | Sem erro de valor; CLS 0; HTML de 113 kB comprimidos (661 kB descomprimidos, dados embutidos); tabela e CSV concordam em 126 recortes. Desconto: peso maior que as demais rotas. | E4, E12 | Nenhuma obrigatória. |
| Dados e métodos | E | 9,1 | Matriz de referências aceitas, de contexto e rejeitadas, com fonte, universo, unidade, período, método, compatibilidade e decisão; SIOPE examinado e não adotado com medição; OCDE conferida contra a API SDMX ao vivo (Brasil, ISCED 1 e 2, instituições públicas, 2023 e 2024, iguais). | `/metodos`; E8 (`verificacao_ocde_tamanho_turma.csv`) | Nenhuma obrigatória. |
| Dados e métodos | F | 8,7 | Fichas completas, política de conferência explícita (125 confere, 3 diferença menor, 1 reconciliada pela MSC, 1 perímetro distinto), reprodução da razão por matrícula com a regra publicada em 7 pares. Descontos: o Glossário e "Como ler" dizem "modalidade 90" onde a fórmula é 90, 93 e 94; o Glossário descreve os elementos 18, 48 e 45 como "indenizações e ressarcimentos", quando o pipeline os trata como auxílios financeiros a estudantes e a pessoas físicas, subvenções e serviços; "Incluí-la" em primeira pessoa. | `/metodos`; `derivados.py:85-90`; `metodos/page.tsx` | Corrigir os textos do Glossário e de "Como ler". |
| Dados e métodos | G | 9,3 | Onze trilhas da fonte ao número, manifesto de capturas, versões por indicador e histórico de revisões (1.0 a 1.4), comandos de reprodução, nota sobre a cadeia TLS do INEP sem desligar a verificação; reprodução isolada idêntica; Siconfi (234 conferências) e INEP (3.016) refeitos. Desconto: 3 CSV públicos sem descrição de colunas e sem link; `hash_dados` cobre só observações; gold gerada com código não commitado. | E7, E8, E9 | Ver M2, M3, M9, M11. |
| Dados e métodos | K | 9,2 | Testes: 41 de `pipeline.tests.test_eficiencia` e 73 de `obee-educacao.test.ts` aprovados; portão de publicação por validação reprovada; CLS 0; HTML de 97 kB comprimidos. | E10 | Ver M10. |

Média simples das 24 notas: 8,9 (E 8,8; F 8,7; G 9,1; K 9,1). Nenhum critério de nenhum painel atinge 9,5; nenhuma nota depende de "não verificado".

## 4. Exigências da rubrica por nota

Escala usada: 9,0 a 9,4 só com requisitos demonstrados e apenas problemas menores; 9,5 a 10 só com validação adicional. Nenhuma nota chegou a 9,5. "Não verificado" nunca foi convertido em nota alta: os itens não verificados estão na seção 13 e não sustentam nenhuma nota.

Resumo numérico (24 células): média simples 8,9. Por critério: E 8,8; F 8,7; G 9,1; K 9,1. Por painel: Panorama 8,9; Gastos 8,7; Atendimento 9,1; Resultados 9,1; Comparar 8,8; Dados e métodos 9,1. Catorze das 24 células estão em 9,0 ou mais; nenhum painel cumpre o mínimo de 9,0 em todos os quatro critérios, e há bloqueios (seção 12).

| Exigência da rubrica para a nota | Como foi atendida | Onde está a evidência |
| --- | --- | --- |
| (1) Evidência observável, com rota, estado e captura ou referência ao código | Cada linha da matriz cita a rota e a URL com parâmetros (campo `id` dos arquivos de conferência é a própria combinação de recorte) ou o arquivo e a linha do código. Capturas de tela não foram necessárias: a evidência é o texto do DOM, as tabelas e os CSV baixados, gravados em JSON Lines. | `coleta_navegador.mjs`, `amostra_*.json`, `divergencias_navegador.csv` |
| (2) Requisitos atendidos | Recálculo independente (só a gold), conferência com as fontes oficiais ao vivo, reprodução da gold em área isolada, medição de desempenho com protocolo. | seções 6, 9 e 10 |
| (3) Limitações remanescentes | Seção 11 (problemas priorizados) e seção 13 (não verificado). | seções 11 e 13 |
| (4) Justificativa para não receber nota inferior | Está na coluna "Justificativa" da matriz: o que foi demonstrado (por exemplo 0 divergências em 140.693 checagens) pesa a favor; o defeito citado pesa contra. | seção 3 |
| (5) Identificação de quem avaliou | Avaliador de dados e método, independente, rodada 3. | seção 1 |
| 9,0 a 9,4: requisitos demonstrados | Valores recalculados sem divergência; fontes conferidas; reprodução idêntica; testes rodados por mim (41 + 73 aprovados, mais as suítes citadas na seção 10). | seções 6, 9 e 10 |
| 9,5 a 10: validação adicional | Fiz validação adicional (fontes ao vivo, reprodução isolada, controle negativo do conferidor), mas os defeitos A1 a A5 impedem notas dessa faixa. | `controle_negativo.py`, seção 6 |

## 5. Protocolo, amostra e ambiente

**Ambiente.** Linux (container de nuvem), Node com Playwright em `/opt/node-tools/node_modules`, Chromium 1194 headless, Python 3 com biblioteca padrão e openpyxl para as planilhas do INEP. Build de produção em `http://localhost:3100`, que não reconstruí. Rede liberada por proxy do ambiente com CA própria; a verificação TLS nunca foi desligada.

**Recálculo próprio (sem código do projeto).** `esperado.py` reimplementa formatação pt-BR, mediana, média, quartis tipo 7, razão agregada, regra de elegibilidade, frases, diferenças e rótulos a partir só da gold. Arredondamento por meio para cima sobre 12 algarismos significativos (o painel entrega 12 ao cliente). Controle negativo: com o valor de Recife 2025 por habitante alterado em 25 reais no esperado, o mesmo conferidor acusou 62 divergências em 27.147 checagens (61 de valor, em mediana, média, frase da capital e CSV, e 1 de console que já existia), o que mostra que ele detecta erro.

**Amostra estratificada de páginas** (1.930 cargas, 140.693 checagens de valor exibido, referência, frase, tabela e CSV):

| Lote | Cargas | Estratos | Checagens por carga |
| --- | --- | --- | --- |
| Gastos, gráfico e CSV | 510 | 3 medidas × 5 anos × 2 moedas × 9 capitais (nenhuma, Recife, Campo Grande, Boa Vista, Macapá, Porto Alegre, São Paulo, Palmas, Vitória) × grupo todas ou região | frase de amplitude, cobertura, frase da capital, 7 campos de referência, perímetro, CSV (valor, inclusão, motivo, mediana, média, extremos, razão, quartis) |
| Gastos, Evolução | 54 | 3 medidas × 2 moedas × 9 capitais | frase da série, tabela da série, CSV da série (valor, base, elegibilidade, mediana e n por ano) |
| Atendimento | 500 | matrículas, conveniadas (8 etapas), alunos por turma (4 etapas) × 5 anos × 5 capitais (nenhuma, Recife, Rio Branco, São Paulo, Palmas) | idem Gastos |
| Resultados | 434 | aprovação, Ideb e Saeb (2 disciplinas), anos iniciais e finais, 21 edições do Ideb (com anos pares pedidos) × capitais (nenhuma, Recife, Natal, São Paulo, Boa Vista) | idem Gastos |
| Comparar, gráfico | 306 | 9 medidas × anos × etapas × grupo todas ou Sul | idem Gastos |
| Comparar, Tabela completa | 126 (122 recortes distintos) | 5 anos × 6 etapas × 2 moedas × grupo todas ou Nordeste, mais Ideb em anos pares | 11 células por capital, 4 linhas de resumo, diferença para a mediana, CSV (célula a célula) |

**Panorama e Dados e métodos** não entram nessa amostra automática. Li o texto renderizado por inteiro e conferi à mão com `esperado.py` os valores que o Panorama abre por padrão (despesa por habitante: menor, mediana, média, maior, faixa central; alunos por turma e Ideb dos anos iniciais: menor, maior, empates, mediana e média) e a referência nacional; as abas Total e Por matrícula do Panorama usam a mesma função de comparação dos cartões de Gastos, que conferi. De Métodos conferi as contagens (125 + 3 + 1 + 1 declarações, 123 de 130 razões, 7 pares sem valor, 9.137 observações) e a cobertura de alunos por turma e aprovação dos anos finais; refiz a gold, com as mesmas validações, na reprodução isolada.

**Fontes oficiais consultadas** (ao vivo em 09/10/2026, exceto onde indicado): Siconfi DCA (130 declarações), Siconfi RREO (130), Siconfi MSC (7 pares, documentação aplicada por mim), IBGE SIDRA 6579 e 4714 (104 populações), IBGE SIDRA 1737 (IPCA), INEP (Ideb AI e AF 2025, ATU 2025, taxas de rendimento 2025, Sinopse 2025, baixados por HTTP simples porque o TLS de `download.inep.gov.br` falha neste ambiente; a integridade foi provada pelo sha256 igual ao do manifesto), OCDE (SDMX, tamanho de turma). Itens fora do alcance estão na seção 13.

**Medição de desempenho.** Laboratório, não experiência real. Chromium headless, sem cache, uma página por contexto limpo, 3,5 s de repouso após a carga para capturar deslocamento tardio e erros. Perfis: desktop 1440 × 900 sem limitação (5 repetições por rota); móvel 390 × 844 com CPU 4× mais lenta (3 repetições); móvel 390 × 844 com CPU 4× e rede de 1,6 Mbps e 150 ms de latência (3 repetições). Nove rotas: as seis do painel e três links com recorte na URL. Medi transferência (bytes comprimidos e descomprimidos) por CDP, FCP e LCP por PerformanceObserver, CLS sem entrada recente, TBT como soma do excesso de 50 ms das tarefas longas após o FCP, e o tempo até o atributo `data-recorte` sair de `<html>`. Os valores são medianas das repetições.

## 6. Tabela de recálculos

Cada linha compara o que o navegador exibiu com o que calculei só com a gold (e, onde indicado, com a fonte oficial). A lista completa de divergências está em `divergencias_navegador.csv`; a amostra aleatória de 354 conferências aprovadas está em `amostra_valores_exibidos_x_recalculados.csv`; as 35 conferências escolhidas abaixo estão em `recalculos_selecionados.csv`.

| Recorte (rota e parâmetros) | Grandeza | Exibido | Recalculado | Fonte e data | Diferença |
| --- | --- | --- | --- | --- | --- |
| `/gastos` 2025 nominal | Amplitude da despesa total | R$ 354,2 milhões (Rio Branco) a R$ 23,58 bilhões (São Paulo), 26 capitais | idem | gold 09/10/2026; DCA conferida ao vivo (130 de 130 iguais, R$ 0,00) | 0 |
| `/gastos` por habitante 2025 | Mediana, média, menor, maior, faixa central | R$ 1.160; R$ 1.243; R$ 702 (Belém); R$ 2.362 (Vitória); R$ 960 a R$ 1.464 | idem | gold; população SIDRA 6579 (104 de 104 iguais) | 0 |
| `/gastos` por habitante 2025 | Razão agregada | R$ 1.361 sobre 46.295.650 habitantes | R$ 1.361 | soma da despesa ÷ soma da população das 26 | 0 |
| `/gastos?cap=recife` por habitante 2025 | Frase da capital | "Recife (PE) registra R$ 1.172; a mediana das 26 capitais é R$ 1.160 (R$ 12 acima)" | R$ 1.172,21; mediana R$ 1.159,81; diferença exibida 1.172 − 1.160 = 12 | gold | 0 |
| `/gastos` por habitante 2021 com Campo Grande | Capitais na comparação | 25 de 26; Campo Grande "fora da comparação" com R$ 1.125 | 25 de 26; valor oficial R$ 1.125,42 | DCA 2021, MSC 2021 (modalidade 91 de R$ 124,2 milhões) | 0 |
| `/gastos` por matrícula 2024 (Boa Vista) | Frase da capital | R$ 12.709; mediana R$ 13.126 (R$ 417 abaixo) | R$ 12.709,03; R$ 13.126; 417 | MSC dezembro 2024 refeita por mim: numerador R$ 656.180.084,34 ÷ 51.631 matrículas | 0 |
| `/gastos` por matrícula 2025 | Menor e maior | R$ 11.030 (Teresina) a R$ 23.747 (São Paulo) | idem | São Paulo refeito por mim da MSC ao vivo: R$ 16.692.288.050,85 ÷ 702.936 = R$ 23.746,53 | 0 |
| `/gastos` por habitante 2023 | Faixa central | R$ 852 a R$ 1.134 | idem | população do Censo 2022 (relação do DOU), gold | 0 |
| `/gastos?vis=evolucao&moeda=real` mediana por matrícula | Frase da série | R$ 9.631 em 2021 para R$ 14.254 em 2025 | R$ 9.631 (24 capitais) e R$ 14.254 (26); painel equilibrado de 22: R$ 9.800 e R$ 16.143 | gold; `composicao_mediana_serie.csv` | valor correto, comparação incompatível (A1) |
| `/atendimento` alunos por turma, anos iniciais 2025 | Amplitude, mediana, média | 20,5 (Recife) a 29,5 (São Paulo); 25,0; 25,1 | idem | INEP ATU 2025, 104 valores conferidos ao vivo | 0 |
| `/atendimento` alunos por turma, pré-escola 2022 | Mediana | 21,1 | 21,05 (média de 20,9 e 21,2), exibida 21,1 | gold; arredondamento sobre 12 algarismos significativos | 0 |
| `/atendimento` conveniadas 2025 | Amplitude e empates | 0 em Boa Vista, João Pessoa e mais 6; 285.770 em São Paulo | idem | Censo Escolar 2025 (gold) | 0 |
| `/resultados` Ideb, anos iniciais 2025 | Amplitude e empate no máximo | 4,8 (Natal) a 6,9 (Curitiba e Teresina) | idem | INEP Ideb 2025: 3.016 valores conferidos | 0 |
| `/resultados?med=ideb&ano=2024` | Ano par pedido | exibe a edição 2023, escrito "na edição 2023" | edição 2023 | regra da bienalidade | 0 |
| `/resultados?med=saeb&ano=2023&etapa=anos_finais&disc=portugues&cap=natal` | Frase da capital | idem ao recálculo | idem | INEP | 0 |
| `/resultados` Ideb 2017, anos iniciais | Capitais na comparação | 25 de 26 (Porto Alegre "não divulgado") | 25 de 26 | INEP | 0 |
| `/comparar?vis=tabela` anos iniciais 2025 | Célula despesa por habitante de Recife | R$ 1.172 | R$ 1.172 | gold | 0 |
| `/comparar?vis=tabela` 2025 | Resumo: mediana da despesa por matrícula | R$ 14.254 | R$ 14.254 | gold | 0 |
| `/comparar?vis=tabela` Nordeste 2023, reais | Resumo: média da despesa total | R$ 1,25 bilhão | R$ 1,25 bilhão | gold; fator IPCA 1,0960332175 conferido na fonte | 0 |
| `/comparar?vis=tabela` | Conveniadas ÷ rede (Porto Alegre) | 49,7% | 22.295 ÷ 44.862 = 49,70% | Censo 2025 | 0 |
| `/comparar?vis=tabela` | Parcela intraorçamentária (Porto Alegre) | 32,2% | RREO ao vivo: 32,2% | Siconfi RREO 6º bimestre | 0 |
| `/comparar?vis=tabela` 2024 | Parcela intraorçamentária (Boa Vista) | 23,0% | 5,3% pela MSC (R$ 36,69 milhões ÷ R$ 694,77 milhões); o RREO usado diverge 81,4% da DCA | MSC dezembro 2024 | 17,7 pontos percentuais (A5) |
| `/comparar?vis=tabela` 2025 | Diferença para a mediana (São Paulo) | +R$ 821 (+70,8%), acima da mediana | +R$ 821 (+70,8%) | gold | 0 |
| `/comparar?vis=tabela` anos finais 2025 | Coluna Saeb (Aracaju) | 240,19 | 240,19 (Matemática) | INEP | 0 no valor; disciplina não identificada (A2) |
| Todas as páginas | CSV baixado × gold | 9.137 observações | 9.137, 0 diferenças | gold | 0 |
| Todas | Estatísticas de grupo (média, mediana, menor, maior, quartis, empates, exibição de quartis) | 1.530 referências | 1.530 recalculadas | gold | 0 |
| Todas | Razão agregada | 120 | 120 recalculadas | gold | 0 |
| Todas | Despesa real (130), por habitante nominal e real (260), por matrícula nominal e real (246), soma das subfunções igual ao total (130 pares) | valores da gold | recalculados | gold e IPCA da fonte | 0 |
| Fonte | DCA função 12, liquidada | 130 | 130 | Siconfi ao vivo, 09/10/2026 | R$ 0,00 |
| Fonte | População | 104 | 104 | IBGE SIDRA 6579 e 4714 ao vivo | 0 |
| Fonte | IPCA, 5 fatores | 1,2527654899 a 1,0 | 1,25276548989 a 1,0 | IBGE SIDRA 1737 ao vivo | menos de 1e-10 |
| Fonte | Ideb, P, N, Saeb (2005 a 2025), ATU 2025, aprovação 2025 | 3.016 | 3.016 | INEP, pacotes com sha256 do manifesto | 0 |
| Fonte | RREO 6º bimestre, Educação, exceto e com intraorçamentárias | 130 pares | 130 iguais | Siconfi ao vivo, 09/10/2026 (`verificacao_fontes_rreo.csv`) | R$ 0,00 |
| Fonte | Razão por matrícula, 4 pares publicados | Aracaju, São Paulo, Porto Alegre e Boa Vista | iguais até o centavo | MSC ao vivo e documentação | 0 |
| Fonte | Pares sem razão, 3 reconferidos | Natal 2023, São Luís 2022, Campo Grande 2021 | MSC abaixo da DCA ou sem função 12, como declarado | MSC ao vivo | 0 |

## 7. Consistência entre apresentações

Gráfico, frase, tabela, resumo e CSV foram comparados em cada carga do lote (mesmo recorte, cinco formas de apresentação).

| Situação testada | Resultado |
| --- | --- |
| Capitais fora da comparação (Campo Grande 2021; Rio de Janeiro, São Luís e Natal na razão por matrícula) | Nelas o gráfico lista "fora da comparação" com o valor oficial quando existe; a frase de amplitude usa 25 capitais; o resumo diz "25 de 26"; o CSV traz `incluida_na_comparacao = nao`, motivo e `elegivel_comparacao = nao`; a razão agregada e a média usam as mesmas 25. Nenhum caso de exclusão aplicada só ao gráfico foi encontrado. |
| Ideb e Saeb em ano par | Explorador: a edição anterior é exibida e escrita no título ("na edição 2023") e no rótulo do período. Tabela completa: as colunas mostram traço, e o texto acima da tabela diz "Ideb e Saeb são bienais e não há edição em 2024: essas colunas ficam sem valor (a edição mais recente é a de 2023)"; o CSV traz "Sem edição neste ano (medida bienal)". Nenhum ano par foi preenchido com número. |
| Etapas sem a medida | Aprovação, Ideb e Saeb na educação infantil, no médio e na EJA: coluna fora do escopo; alunos por turma em ensino médio: fora do escopo; nenhuma delas aparece como zero. |
| Creche e pré-escola na Tabela completa | Alunos por turma exibido; aprovação, Ideb e Saeb fora do escopo; rótulos das colunas mudam com a etapa (cabeçalho agrupado). |
| Ausência | "Sem registro", "Não aplicável", "Sem valor publicável (ver ressalvas)" e traço; nenhuma célula ausente exibiu dígito (conferido célula a célula). |
| Capitais em regiões com menos de 8 valores | Faixa central escondida, com aviso; quartis marcados `nao` no CSV. |
| Tabela × CSV da tabela completa | Valor exibido igual em todas as células; única diferença textual: a célula de Campo Grande 2021 leva o sufixo "fora das comparações", que no CSV está na coluna de elegibilidade. |
| Série em Evolução × CSV da série | 1.876 conferências sem divergência (valor, base, elegibilidade, mediana e n por ano). |
| Dicionário × colunas | Ver seção 9 (M2) para os CSV públicos fora da interface. |
| Frase × composição da mediana | Inconsistência de conteúdo na Evolução sem capital (A1): a frase diz "Há dados comparáveis para as 26 capitais" para o último ano e compara com um ano de 24. |

## 8. Achados metodológicos

1. **Perímetro da despesa.** Função 12, estágio liquidado, exceto intraorçamentárias, fixado igual para todas as capitais e dito junto de todo número de despesa. A parcela excluída varia de 0,0% (Macapá) a 32,2% (Porto Alegre) em 2025 e chega a 41,4% (Porto Alegre) em 2021; a DCA não abre intraorçamentárias por função, de modo que não há correção possível com a mesma fonte. A diferença é quantificada por capital na Tabela completa e no CSV, mas no gráfico de Gastos só aparecem o menor e o maior. Avaliei como limitação material declarada, não como bloqueio.
2. **Preços constantes.** Fator = média anual do número-índice do IPCA de 2025 ÷ média do ano (reproduzido na fonte). Declarado no Glossário e na ficha. O deflator anual não distingue a sazonalidade da execução, o que é razoável e dito.
3. **População e quebra de série.** 2021 (estimativa do Censo 2010), 2022 (Censo), 2023 (Censo 2022 pela relação do DOU, sem estimativa de julho de 2023), 2024 e 2025 (estimativas pós-Censo). Variações que envolvem 2021 e 2023 são bloqueadas e a frase da Evolução diz por quê. A nota de 2023 que esclarece "é a mesma população de 2022" está em "Ver o restante".
4. **Estágio, zero e ausência.** V09 passa; verifiquei que 823 zeros de matrícula por etapa vêm de contagem zero da fonte; escolas sem contagem só entram como contribuição nula com confirmação da Sinopse. Conveniadas igual a zero significa nenhuma escola que declare parceria exclusiva com o município; se isso reflete ausência de convênio ou de declaração não foi verificado.
5. **Elegibilidade DCA, RREO e MSC.** 125 conferem, 3 com diferença abaixo de 0,1%, 1 reconciliada pela MSC (Boa Vista 2024), 1 de perímetro distinto (Campo Grande 2021, fora de gráfico, resumo e CSV). Os números do texto de Métodos batem com a gold. Defeito: a parcela intraorçamentária de Boa Vista 2024 é calculada com o RREO que o próprio painel declara errado (A5).
6. **Razão por matrícula.** Não é chamada de custo; numerador e denominador estão definidos; transferências a instituições privadas ficam fora do numerador e as conveniadas fora do denominador; a parcela de beneficiário indeterminado (2,3% a 27,9% do numerador em 2025) é medida e publicada na ponte. Reproduzi o cálculo com a documentação pública para quatro pares, sem diferença. Não considerei a razão um "denominador inadequado" no sentido do bloqueio: o denominador (matrículas de escolas municipais) corresponde ao conceito declarado. Mas as capitais onde as conveniadas pesam muito (Porto Alegre 49,7%, São Paulo 40,7%, São Luís 37,7%) e a parcela indeterminada podem incluir vagas contratadas, e isso não aparece no gráfico (A4).
7. **Grupos de comparação.** Todas as capitais ou a região da capital escolhida (3 a 9 capitais). O grupo regional com menos de 8 valores esconde quartis. Não há grupo de pares por porte entre as capitais; o corte de 500 mil habitantes existe apenas para os municípios do país, em detalhe recolhido.
8. **Referências nacionais.** Do mesmo universo (INEP, Brasil, rede municipal, todas as localizações) para alunos por turma, aprovação, Ideb e P e N, com a diferença na unidade certa, sem chamar o agregado nacional de média das capitais. A referência do OBEE para a despesa por habitante (5.060 municípios, 90,8% dos municípios e 93,2% da população) é rotulada "outro universo, não é comparação direta"; mesmo assim a linha "Municípios do país R$ 2.125" é desenhada no gráfico das capitais. O cálculo foi reproduzido no pipeline (V19).
9. **Referências internacionais.** Contexto separado, com o ano da OCDE dito, a média recalculada pelo OBEE sobre os 38 membros, ISCED mapeado com fonte, e a incompatibilidade registrada na matriz (alunos por turma na educação infantil, taxa de repetência, PISA, matrículas). Valores do Brasil conferem com a API SDMX ao vivo. A ausência de benchmark internacional para despesa por habitante é explicada, e isso não reduz a nota.
10. **Bienalidade.** O Ideb e o Saeb nunca são alinhados à despesa do mesmo ano de modo artificial; a Tabela completa diz a edição usada e, em ano par, explica a bienalidade e deixa as colunas sem valor.
11. **Séries da mediana.** Defeito A1.
12. **Rótulo do Saeb.** Defeito A2.
13. **Textos de método.** Três imprecisões: "modalidade 90" em "Como ler", no Glossário e na ponte, onde a fórmula é 90, 93 e 94; Glossário descreve os elementos 18, 48 e 45 como "indenizações e ressarcimentos"; a primeira pessoa em "Incluí-la".
14. **Linguagem.** 9.542 linhas únicas de texto das páginas coletadas foram varridas por termos de julgamento e causalidade (melhor, pior, eficiente, desperdício, excesso, causa, efeito, impacto, recomend, deve e afins). Nenhum julgamento; "causa" e "efeito" aparecem apenas em avisos de que não há causalidade. O princípio editorial é respeitado.

## 9. Rastreabilidade e reprodução

**Tarefas orientadas da rubrica, pelo ângulo de dados (inspeção heurística, sem usuários).**

| Tarefa | Resultado | Obstáculos e observações |
| --- | --- | --- |
| 1. Gasto por habitante e por matrícula de uma capital | Sucesso: `/gastos?cap=recife` mostra R$ 1.172 por habitante e R$ 18.590 por matrícula em 2025, com a mediana ao lado | Nenhuma intervenção. |
| 2. Comparar com um grupo elegível e identificar a referência | Sucesso: "Todas as capitais" ou região, com n, mediana, média, extremos e a razão agregada rotulada | Nenhum grupo por porte (B1). |
| 3. Interpretar mudança em reais constantes | Sucesso com ressalva: a opção "Reais de 2025 (IPCA)" e a unidade na legenda existem; a frase da Evolução da mediana tem o problema A1 | A frase não diz "reais de 2025" no próprio texto, só na unidade do subtítulo. |
| 4. Entender por que uma observação foi excluída | Sucesso: Campo Grande 2021 e São Luís 2022 mostram estado, motivo e ressalva logo abaixo do gráfico | Motivo longo em "Ver o motivo completo". |
| 5. Distinguir rede municipal, função Educação e população | Sucesso: universo curto em cada cartão, perímetro em cada número de despesa | Ver A3 e A4 para o que não está à vista. |
| 6. Atendimento e resultado sem confundir períodos | Sucesso: "Censo Escolar 2025" e "edição 2025" nos rótulos; ano par aponta a edição anterior | Nenhum. |
| 7. Exportar e reconhecer limitações fora do site | Sucesso com obstáculos (M4) | CSV em formato para Excel em português exige cuidado. |
| 8. Reproduzir um indicador a partir da documentação | Sucesso | Passos abaixo. |

**Tarefa 7, exportar o recorte e reconhecer limitações fora do site.** Concluída com obstáculos pequenos. O CSV de um indicador traz, por linha, universo, grupo de comparação, período, etapa, componente, valor numérico e exibido, unidade, estado, elegibilidade, inclusão, motivo de exclusão, nota, mediana, média, extremos, quartis, razão agregada, parcela intraorçamentária, versão, data de geração, `hash_dados` e fonte. A frase "leia antes de usar" e a citação sugerida ficam no dicionário, que é outro arquivo. Obstáculos: o CSV usa ponto e vírgula, BOM e decimal com ponto (leitores de planilha em português podem tratar "1172.210012" como texto); o aviso de que gasto elevado não é desperdício está só no dicionário (M4).

**Tarefa 8, reproduzir um indicador a partir da documentação.** Concluída. Para Aracaju 2025, segui os passos de Dados e métodos, "Exemplos de reprodução":

| Passo | Valor do painel | Valor obtido por mim | Fonte consultada hoje |
| --- | --- | --- | --- |
| Despesa liquidada na função 12 (DCA) | R$ 566.422.643,48 | R$ 566.422.643,48 | API do Siconfi, DCA 2025, Anexo I-E |
| População 2025 | 621.408 | 621.408 | SIDRA 6579, variável 9324 |
| Despesa por habitante | R$ 911,51 | 566.422.643,48 ÷ 621.408 = R$ 911,5149 | cálculo |
| MSC sem intraorçamentárias | R$ 566.422.643,48 (igual à DCA) | R$ 566.422.643,48 | Siconfi MSC, dezembro 2025, função 12 |
| Aplicação direta (modalidades 90, 93 e 94), sem 364 e sem inativos | R$ 561.863.001,98 | R$ 561.863.001,98 | MSC, regras do texto de Métodos |
| Matrículas da rede municipal 2025 | 33.933 | 33.933 (tabela 1.2, coluna Municipal) | Sinopse Estatística do Censo Escolar 2025, INEP (outra publicação do INEP; os microdados de 537 MB não foram baixados) |
| Razão por matrícula | R$ 16.558,01 | 561.863.001,98 ÷ 33.933 = R$ 16.558,0114 | cálculo |

Reproduzi também São Paulo e Porto Alegre 2025 e Boa Vista 2024 (iguais ao centavo). A documentação foi suficiente. A única etapa não refeita por mim foi a soma de `QT_MAT_BAS` nos microdados do Censo (537 MB); no lugar, comparei as matrículas de 2025 (total, creche e pré-escola das 26 capitais, 78 valores) com a Sinopse Estatística do INEP, todas iguais (`verificacao_sinopse_2025.csv`). Isso é conferência contra outra publicação do INEP, como a V06 do painel, e não contra os microdados.

**Reconstrução isolada.** Copiei o pipeline e o seed para fora do repositório e rodei `python3 -m pipeline.eficiencia.run` sem rede (22 s): `hash_dados` e `versao_codigo` idênticos, 16.299 linhas de CSV idênticas exceto o carimbo `dados_gerados_em` (`reproducao_isolada.txt`).

**Coerência entre catálogo, gold, CSV e página.** Catálogo `2026-10-09.1`, 13 fichas, versões metodológicas 1.1, 1.2 e 1.3 por indicador e histórico 1.0 a 1.4; a página de Métodos mostra a mesma tabela de versões, a mesma identificação de processamento (obee-0.2.0, gerador-ce6dd2df1dd5, gerado em 09/10/2026) e o mesmo `hash_dados`; todas as 9.137 linhas dos CSV de séries carregam o mesmo `hash_dados` e a mesma data de geração da gold. A divergência que encontrei é de documentação: `docs/obee/METODOLOGIA.md` abre com "Versão metodológica 1.3" enquanto o histórico do catálogo chega à revisão 1.4 (09/10/2026, sem mudança de fórmula); `docs/obee/README.md` fala em "Estado em 08/10/2026". O `hash_dados` é verificável por fora (sha256 do JSON canônico das observações), mas cobre apenas as observações. A gold publicada traz `codigo_com_mudanca_nao_commitada = true` com `commit_de_partida` 8322a6b: o código foi identificado pelo conteúdo (sha256), o que preserva a reprodução, mas o commit do código gerador não está registrado na gold (M9).

**Colunas sem descrição.** Os 12 CSV por indicador têm as 32 colunas descritas no `dicionario_das_colunas.csv` (34 linhas, nenhuma coluna sem descrição). Os três CSV restantes, servidos publicamente em `/eficiencia/series/` e não linkados da interface, não são cobertos pelo dicionário: `referencias_educacao_capitais.csv` (18 colunas sem descrição), `referencia_nacional_despesa_habitante_2025.csv` (11) e `edu_diagnostico_pares_msc.csv` (19) (M2). No navegador, o dicionário baixado (79 entradas, nenhuma sem texto) cobre todas as colunas dos três CSV da interface: comparação de um indicador (36 colunas), tabela comparativa (21) e série (19), ver `dicionario_x_csv.txt`.

## 10. Desempenho e estabilidade (protocolo na seção 5; laboratório, não experiência real)

Máquina de nuvem compartilhada, Chromium headless, build de produção estático em `localhost:3100`, sem CDN, sem cache, uma página por contexto limpo, medianas de 5 repetições (desktop) e 3 (móvel). Os números absolutos dependem do hardware; servem para comparar rotas e para dimensionar riscos. Tabela completa em `desempenho_resumo.csv`.

| Rota | HTML (comprimido, descomprimido) | JS (comprimido, descomprimido, arquivos) | Total transferido | FCP = LCP desktop | FCP = LCP móvel 4× | FCP = LCP móvel lento | TBT desktop, móvel 4×, lento | CLS |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Panorama | 31 kB, 170 kB | 163 kB, 510 kB, 19 | 832 kB | 200 ms | 256 ms | 1.256 ms | 0, 719, 312 ms | 0 (0,033 no lento) |
| Gastos | 81 kB, 407 kB | 163 kB, 510 kB, 19 | 761 kB | 240 ms | 292 ms | 1.152 ms | 11, 1.087, 631 ms | 0 |
| Atendimento | 65 kB, 392 kB | 163 kB, 510 kB, 19 | 761 kB | 244 ms | 364 ms | 1.872 ms | 0, 971, 500 ms | 0 |
| Resultados | 69 kB, 380 kB | 163 kB, 510 kB, 19 | 760 kB | 320 ms | 272 ms | 1.228 ms | 0, 1.046, 634 ms | 0 |
| Comparar | 113 kB, 661 kB | 163 kB, 510 kB, 19 | 761 kB | 352 ms | 324 ms | 1.172 ms | 10, 942, 1.028 ms | 0 |
| Dados e métodos | 97 kB, 740 kB | 162 kB, 510 kB, 18 | 803 kB | 440 ms | 424 ms | 2.020 ms | 17, 1.388, 859 ms | 0 |

Em todas as rotas e perfis: 0 erros de console, 0 rolagem horizontal da página, maior tarefa longa de 0 a 774 ms (774 ms na página de métodos com CPU e rede lentas).

**Links com recorte na URL** (tempo até o recorte pedido aparecer; antes disso o conteúdo da página fica oculto por um atributo em `<html>` e o leitor vê a casca com o cabeçalho e a página em branco, sem números do recorte errado):

| Link | Desktop (mediana, máximo) | Móvel 4× | Móvel 4× e rede lenta | LCP desktop | LCP móvel lento |
| --- | --- | --- | --- | --- | --- |
| `/gastos?cap=recife&med=despesa_mat&ano=2024&moeda=real&vis=evolucao` | 346 ms, 385 ms | 1.667 ms, 1.907 ms | 3.620 ms, 3.719 ms | 456 ms | 3.748 ms |
| `/comparar?vis=tabela&ano=2023&etapa=anos_finais&reg=NE` | 400 ms, 410 ms | 1.733 ms, 2.003 ms | 4.056 ms, 4.140 ms | 472 ms | 4.232 ms |
| `/resultados?med=saeb&ano=2023&etapa=anos_finais&disc=portugues&cap=natal` | 314 ms, 356 ms | 1.602 ms, 1.604 ms | 3.487 ms, 3.712 ms | 396 ms | 3.600 ms |

O recorte pedido aparece depois de 0,3 a 0,4 s no desktop, 1,6 a 2,0 s no móvel com CPU lenta e 3,5 a 4,1 s com CPU e rede lentas. O script de proteção libera o recorte padrão após 5 s se a hidratação não terminar. No pior caso medido (4.140 ms) a margem é de 0,9 s, de modo que um aparelho ou rede um pouco piores mostrariam os números do recorte padrão sob um endereço que pede outro, sem aviso (M5). Em compensação, nas 33 cargas com recorte (3 links × 11 repetições) o texto do `main` estava vazio em DOMContentLoaded, isto é, o recorte errado nunca ficou visível antes da hidratação; nas outras seis rotas o texto estático (de 500 caracteres em diante) já está no HTML. Com JavaScript desligado, o painel mostra o recorte padrão (a frase de Belém e Vitória no lugar da razão por matrícula pedida) e o aviso "Sem JavaScript, o painel mostra o recorte padrão e não o do link" aparece, mas ao fim da página, depois dos números.

**Erros de console.** Em condições controladas (99 cargas completas com 3,5 s de repouso: 45 no desktop, 27 no móvel 4× e 27 no móvel lento; 10 cargas em contexto novo, com e sem clique em download; e a sequência de interação), nenhum erro de console ou de página. Na coleta em lote da amostra apareceram erros "Failed to fetch RSC payload ... Falling back to browser navigation" em 20% das cargas (todos de links de rodapé, como `/cadastro` e `/setor-eletrico/pld`). Reproduzi o fenômeno apenas ao reusar a mesma aba para carregar a URL seguinte (a navegação do coletor interrompe o prefetch de links da página anterior, e o erro é registrado pelo documento que está sendo descartado); com contexto novo e repouso de 4 s os erros desaparecem. Trato como artefato do meu coletor, não do painel, e deixei os registros em `divergencias_navegador.csv` com o campo `console` para quem quiser conferir. Não é um erro que o leitor veja.

**Estabilidade visual.** CLS 0 em 26 das 27 combinações de rota e perfil; 0,033 no Panorama com CPU e rede lentas (abaixo do limite de 0,1).

**Peso.** O painel traz cerca de 760 kB por rota (160 kB de JavaScript comprimido, quase todo do conjunto do site, e 31 a 113 kB de HTML com os dados do tema embutidos). A página Comparar embute os dados de todas as medidas (661 kB descomprimidos) para permitir a Tabela completa sem nova requisição; Gastos, Atendimento e Resultados embutem só os indicadores do tema. O download da gold inteira (6,7 MB) é opcional e informado na entrada. Não encontrei transferência sem utilidade imediata no painel; o JavaScript comum do site é o item que não se justifica só pelo painel.

**Testes automatizados** (executados por mim, sem modificá-los; `testes_executados.txt`):

| Comando | Resultado |
| --- | --- |
| `python3 -m unittest pipeline.tests.test_eficiencia` | 41 testes, OK (60 s) |
| `python3 -m unittest pipeline.tests.test_eficiencia_comparacoes` | 56 testes, OK (23 s) |
| `npx vitest run src/tests/obee-educacao.test.ts` | 73 testes, OK |
| `npx vitest run src/tests/obee-` | 7 arquivos, 160 testes, OK |
| `npx vitest run` | 142 arquivos, 2.668 aprovados, 1 ignorado |

Cobertura frente aos riscos: bem coberto o pipeline (política de conferência, ausência não vira zero, bloqueio de publicação com validação reprovada, estatísticas, ponte, referências nacionais), a consulta (`comparar`, CSV, ano par, Campo Grande, Boa Vista, grupo regional) e a neutralidade de linguagem e cores. Não coberto: composição de conjunto nas séries da mediana (A1), rótulo da disciplina do Saeb na Tabela completa (A2), parcela intraorçamentária calculada com RREO divergente (A5) e a comparação do texto do DOM com a gold. Os roteiros de navegador em `scripts/obee/` (interações, casos, larguras e axe) não rodam no CI. Meus conferidores cobrem esse buraco para o estado atual, mas não são testes do repositório.

**Valores preservados ao alternar apresentações.** `interacao_preserva_valores.mjs`: gráfico para tabela para evolução para reais e volta mantêm capital, ano e valor (Recife 2023: R$ 995 nominais e R$ 1.091 em reais de 2025, igual a 995,30 × 1,0960); o botão Voltar restaura o estado; o link copiado reabre o mesmo recorte; nenhum erro de página ou de console.

## 11. Problemas priorizados

### Alta

* **A1. Série da mediana sem capital compara conjuntos diferentes de capitais e a frase não diz isso.** Rota `/gastos?med=despesa_mat&moeda=real&vis=evolucao` (padrão da Evolução quando nenhuma capital é escolhida). O número de capitais com valor por ano é 24, 23, 24, 26 e 26 (2021 a 2025). A frase "Na mediana das capitais, a razão da despesa de aplicação direta por matrícula passou de R$ 9.631 em 2021 para R$ 14.254 em 2025" fica ao lado de "Há dados comparáveis para as 26 capitais" (que vale só para o último ano). A tabela "Ver tabela" mostra Ano, Valor e Estado, sem n. Com as 22 capitais que têm valor nos cinco anos, a variação real seria +64,7% (R$ 9.800 para R$ 16.143) e não +48,0%; em valores correntes, +106,4% e não +85,4% (`composicao_mediana_serie.csv`, 28 séries; nas outras o desvio é de no máximo 5 pontos percentuais: Ideb anos finais 4,8; alunos por turma anos finais 2,5). Código: `ExploradorTema.tsx:178-190` e `:456`; `consulta.ts:313-323`; `frases.ts:148-174`. Correção: mostrar n por ano na frase e na tabela da série, ou calcular a variação em painel equilibrado, ou suspender a frase de variação quando n muda; incluir teste de composição. (Bloqueio de comparação materialmente incompatível, confirmado neste recorte: seção 12.)
* **A2. Tabela completa de Comparar e seu CSV não identificam a disciplina do Saeb.** O cabeçalho é "Saeb" e `unidade` é "pontos na escala Saeb"; o valor é Matemática por padrão e muda para Língua Portuguesa se o leitor escolher Medida = Saeb e a disciplina, sem que o cabeçalho mude. Código: `consulta.ts:869-881` (`COLUNAS`, rótulo "Saeb") e `:1033-1055` (CSV). Correção: rotular "Saeb, Matemática" (ou "Saeb, Língua Portuguesa") no cabeçalho e preencher uma coluna de disciplina no CSV.
* **A3. Heterogeneidade do perímetro intraorçamentário só aparece no extremo.** Parcela de 0,0% a 32,2% em 2025 (41,4% em 2021) fora do valor, não corrigível com a DCA. No gráfico, na tabela e na frase de Gastos aparecem só a menor e a maior; a parcela por capital está na Tabela completa de Comparar e no CSV (coluna `parcela_intraorcamentaria_pct_da_funcao`). Correção: mostrar a parcela junto do rótulo de cada capital no gráfico e na tabela de Gastos, ou marcar visualmente as capitais acima de um limiar declarado.
* **A4. Ressalvas do denominador da razão por matrícula longe do gráfico.** Conveniadas fora do denominador (0,0% a 49,7% da rede em 2025; São Paulo 40,7%, São Luís 37,7%, Porto Alegre 49,7%) e parcela de beneficiário indeterminado dentro do numerador (2,3% a 27,9%) estão na ponte (exige capital escolhida e a aba "Do total ao numerador"), na ficha e em Métodos, não no cartão do Panorama nem no gráfico de Gastos. A frase à vista diz "Razão orçamentária, não custo do aluno", o que é correto mas insuficiente. Correção: incluir as duas colunas (conveniadas ÷ rede, indeterminado ÷ numerador) na tabela e no CSV de Gastos > Por matrícula e uma linha de contexto no cartão.
* **A5. Parcela intraorçamentária de Boa Vista 2024 calculada com RREO que o painel declara errado.** Exibida 23,0% (Comparar, Tabela completa, coluna "Parcela intraorçamentária da função (RREO)", e `parcela_intraorcamentaria_pct_da_funcao` = 23,0431 no CSV) com estado "Observado", elegível "sim" e sem nota na célula. O RREO informa R$ 122,5 milhões "exceto intra" e R$ 36,7 milhões de intra, enquanto a DCA e a MSC têm R$ 658,1 milhões; a MSC dá 36,69 ÷ 694,77 = 5,3%. Erro de 17,7 pontos percentuais em 1 das 130 células. Código: `dados.ts:59-71` (`intraPct`, usa `conferencia.rreo` sempre). Correção: usar a MSC quando a situação for RECONCILIADA_MSC, ou não calcular e dizer por quê.

### Média

* **M1. Textos de método imprecisos.** "Modalidade 90" em "Como ler" (Recursos), no Glossário ("Razão da despesa de aplicação direta") e na ponte, onde a fórmula é modalidades 90, 93 e 94. O Glossário define a parcela indeterminada com "indenizações e ressarcimentos (18, 48 e 45)"; o pipeline trata 18 como auxílio financeiro a estudantes, 48 como outros auxílios a pessoas físicas, 45 como subvenções e 39 como serviços de terceiros pessoa jurídica (`derivados.py:85-90`). Correção: alinhar os textos à fórmula e ao pipeline. Em "Limitações gerais" o verbo "Incluí-la" está na primeira pessoa do singular, fora do tom do restante.
* **M2. Três CSV públicos sem dicionário e sem link.** `referencias_educacao_capitais.csv` (18 colunas), `referencia_nacional_despesa_habitante_2025.csv` (11) e `edu_diagnostico_pares_msc.csv` (19) são servidos em `/eficiencia/series/` (HTTP 200) e não aparecem em Métodos nem no dicionário. Correção: descrever as colunas ou retirar do diretório público.
* **M3. Escopo do hash.** `hash_dados` cobre só `observacoes`. As tabelas de referência (médias, medianas, razões), as referências externas e internacionais e o catálogo podem mudar sem alterar o hash que os CSV carregam. Correção: segundo hash para as referências ou hash do conjunto.
* **M4. Exportação fora do site.** CSV com ponto e vírgula e decimal com ponto; o aviso editorial ("leia antes de usar") e a citação só no dicionário. Correção: coluna ou linha inicial `aviso` no próprio CSV, ou formatar `valor_numerico` com ponto e deixar isso dito.
* **M5. Conteúdo oculto até a hidratação.** Links com recorte escondem o conteúdo (`data-recorte`) por cerca de 0,3 s no desktop, 1,6 a 2,0 s no móvel com CPU 4× mais lenta e 3,5 a 4,1 s com CPU e rede lentas (seção 10). Se a hidratação não terminar em 5 s, o script libera o recorte padrão sem aviso; o leitor passaria a ver números diferentes dos do link. O pior caso medido foi 4,14 s, abaixo de 5 s nos três perfis, de modo que o risco é de aparelho ou rede piores que os do protocolo, ou de falha de script. O aviso para quem não tem JavaScript fica ao fim da página.
* **M6. Série de uma capital cujo primeiro ano é inelegível.** A frase de Campo Grande "passou de R$ 981,8 milhões em 2022 para R$ 1,63 bilhão em 2025" omite que 2021 existe e está fora da comparação (o gráfico o marca; a frase não).
* **M7. Nota decisiva da população de 2023 atrás de "Ver o restante".** A parte à vista diz que a população é do Censo 2022; a frase que diz "é a mesma população de 2022 e a despesa por habitante de 2023 não acompanha o crescimento populacional" fica recolhida.
* **M8. Documentação com versões divergentes.** `METODOLOGIA.md` "Versão metodológica 1.3" contra catálogo com revisão 1.4; `README.md` "Estado em 08/10/2026" contra gold de 09/10/2026.
* **M9. Gold gerada com código não commitado.** `meta.proveniencia.git.codigo_com_mudanca_nao_commitada = true`, `commit_de_partida` 8322a6b. O código é identificado por sha256 e minha reprodução confirmou que o código atual gera a mesma gold; falta registrar o commit do gerador.
* **M10. Testes não cobrem os riscos A1, A2 e A5; scripts de interface fora do CI.** Os 7 arquivos de teste do OBEE em vitest e as suítes Python não comparam o DOM com a gold nem testam composição de séries; `scripts/obee/*.mjs` (interações, casos, larguras e axe) não rodam no CI (`.github/workflows/ci.yml` roda vitest e unittest).
* **M11. Rótulo de proveniência da população de 2023.** O painel cita a "relação do DOU de 31/08/2023"; o arquivo capturado é a tabela dos Primeiros Resultados do Censo 2022 de 22/12/2023, posterior ao DOU, e o próprio manifesto diz que a relação do DOU não foi baixada. Os números são os do Censo 2022 (SIDRA 4714), e a ressalva sobre a população de 2023 está correta; o que pode estar impreciso é a atribuição ao DOU. Correção: descrever a fonte como "Censo 2022, segunda apuração", ou obter a relação do DOU.

### Baixa

* **B1. Linha "Municípios do país R$ 2.125" no gráfico das capitais.** Rotulada como outro universo, mas desenhada no mesmo eixo; o grupo mais próximo (municípios elegíveis com 500 mil habitantes ou mais: n = 46, mediana R$ 1.188, razão agregada R$ 1.323) existe na gold e só aparece em "Cobertura, grupos e exclusões", recolhido.
* **B2. Zero de conveniadas.** 0 significa nenhuma escola que declare parceria exclusiva; não verifiquei se corresponde a ausência de convênio (Boa Vista, João Pessoa, Maceió, Palmas, Porto Velho, Rio Branco, Teresina e Vitória têm 0 em 2025).
* **B3. Com Medida = Ideb a Tabela completa muda de ano.** Pedir `ano=2024` com `med=ideb` mostra a tabela inteira da edição 2023, inclusive despesa de 2023, sem aviso na própria tabela.
* **B4. Saeb de 2005 a 2021 vem da planilha do Ideb de 2025.** Declarado, mas a série histórica depende de uma só publicação.
* **B5. Reprodução depende de pacotes de até 537 MB.** `--inep <pasta>` exige baixá-los; o seed versionado atenua, e a nota sobre a cadeia TLS do INEP é honesta.

## 12. Bloqueios de aprovação

Testei os nove bloqueios da rubrica.

| Bloqueio | O que testei | Resultado |
| --- | --- | --- |
| Valores incorretos | 140.693 checagens de exibição, 9.137 observações contra o CSV, 1.530 referências, 130 DCA, 104 populações, 3.016 valores do INEP, 130 RREO, 4 razões por matrícula | **Encontrado em 1 célula**: parcela intraorçamentária de Boa Vista 2024 (A5). Nenhum valor dos indicadores principais está incorreto. |
| Comparação materialmente incompatível | Perímetro entre capitais; grupos; séries de mediana; ano par; etapas | **Encontrado**: série da mediana com conjunto variável de capitais, material na razão por matrícula (A1). A heterogeneidade intraorçamentária foi avaliada e **não** confirmada como bloqueio: está dita junto do número, quantificada por capital e a fonte não permite corrigir (A3 é de apresentação). |
| Gasto por matrícula com denominador inadequado | Numerador e denominador, reprodução de 4 pares, 7 pares sem valor | **Não encontrado**: o denominador é o do conceito declarado e as conveniadas ficam fora dos dois lados; o ponto A4 é de visibilidade. |
| Ausência tratada como zero | V09, 823 zeros de matrícula por etapa, células ausentes das tabelas, CSV | **Não encontrado.** |
| Exclusão no gráfico mas não no resumo ou CSV | Campo Grande 2021, Rio de Janeiro, São Luís e Natal na razão por matrícula, em todos os lotes | **Não encontrado**: gráfico, frase, resumo e CSV usam a mesma regra em 100% dos casos. |
| Ressalva essencial escondida | Notas materiais, caso a caso | **Não confirmado**: as ressalvas materiais têm a primeira frase à vista e o restante por clique ou teclado. Registrei M7 e A4 como risco. |
| Afirmação causal ou julgamento sem suporte | Varredura de 9.542 linhas | **Não encontrado.** |
| Perda funcional | Download, link do recorte, grupo regional, ordem, tabela, série | **Não encontrado.** |
| Barreira a tarefa essencial | Tarefas 1 a 8 | **Não encontrado**; o obstáculo de exportar (M4) não impede a tarefa. |

**Conclusão sobre aprovação**: o conjunto não é aprovável nesta rodada por A1 (comparação) e A5 (valor); A2 e A3 a A4 impedem notas de 9,0 em Gastos e Comparar.

## 13. Limitações e itens não verificados

* **Microdados do Censo Escolar** (537 MB por ano): não baixei; a soma de `QT_MAT_BAS` por escola municipal não foi refeita por mim. As matrículas de 2025 (total, creche e pré-escola) foram conferidas com a Sinopse Estatística 2025 do INEP (78 valores, `verificacao_sinopse_2025.csv`), outra publicação do mesmo órgão. Não verificado contra a fonte: matrículas de 2021 a 2024, matrículas por etapa de 2025 além de creche e pré-escola, e conveniadas.
* **Aprovação e alunos por turma de 2021 a 2024**: arquivos anuais do INEP não baixados (2025 foi conferido; Ideb, P, N e Saeb de 2005 a 2025 vêm da planilha de 2025 e foram conferidos para todas as edições). Não verificado contra a fonte: aprovação e alunos por turma de 2021 a 2024.
* **Referência nacional do INEP (Brasil, rede municipal)**: li os valores da gold e do painel (por exemplo 22,0 alunos por turma e Ideb 6,1 nos anos iniciais em 2025); não baixei os arquivos nacionais. Não verificado contra a fonte.
* **Referência nacional calculada pelo OBEE (5.060 municípios)**: reproduzida só pelo código e pelos testes do pipeline (V19); não refiz as 5.570 consultas ao Siconfi.
* **MSC**: refeitos 7 pares (4 publicados e 3 sem valor); os outros 119 pares publicados da razão por matrícula não foram refeitos por mim. As subfunções da DCA foram conferidas só pela soma igual ao total na gold, não linha a linha contra o Siconfi.
* **População de 2023**: o painel a chama de "relação do DOU de 31/08/2023"; o manifesto registra que esse arquivo não foi obtido (ibge.gov.br respondeu 403) e que os valores vêm da tabela dos Primeiros Resultados do Censo 2022 (segunda apuração, 22/12/2023), iguais ao SIDRA 4714. Os valores de 2023 são idênticos aos de 2022 nas 26 capitais, como declarado; que o DOU de agosto de 2023 tenha os mesmos números não foi verificado por mim (M11).
* **OCDE**: confere o tamanho de turma (Brasil, ISCED 1 e 2, instituições públicas, 2023 e 2024); não refiz a despesa por estudante nem a lista dos 38 membros.
* **Edições do Censo**: o texto de cobertura diz que 2024 foi republicado em 08/07/2026 e 2025 "v2" em 31/07/2026; não verifiquei essas datas no site do INEP (HTTP simples e TLS indisponível aqui).
* **Desempenho**: medição de laboratório de uma máquina, sem usuários reais, sem rede móvel real; os números absolutos de TBT dependem do hardware.
* **Leitor de tela e acessibilidade** são de outro avaliador. Não avaliei hierarquia visual, didática, layout nem gráficos.
* **Três imprecisões de redação** (M1) e o tom do trecho "Incluí-la" são observações de leitura, não de método.
* **Build e CI**: não reconstruí o build nem executei a suíte Python completa do repositório (1.351 testes citados na documentação); rodei as suítes do OBEE e o vitest completo (seção 10).

## 14. Arquivos de evidência

Todos em `docs/obee/avaliacao/rodada-3/evidencias/dados/`.

| Arquivo | Conteúdo |
| --- | --- |
| E1 `esperado.py` | Recálculo próprio a partir da gold (formatação, estatísticas, razão, frases, elegibilidade). |
| E2 `confere_exploracao.py`, `confere_comparar_tabela.py`, `confere_evolucao.py`, `confere_dicionario.py` | Conferidores do que o navegador exibiu. |
| E3 `coleta_navegador.mjs`, `gera_amostra.py`, `gera_amostra_tabela.py`, `amostra_*.json` | Coletor Playwright e listas de URLs da amostra estratificada. |
| E4 `resumo_conferencias_navegador.csv`, `divergencias_navegador.csv`, `amostra_valores_exibidos_x_recalculados.csv`, `recalculos_selecionados.csv`, `checagens_completas/*.csv.gz`, `brutos/*.jsonl.gz` | Resultado das 140.693 checagens (completas em `checagens_completas`), divergências (340 linhas: 298 de console, que são artefato do coletor, e 42 de sufixo textual "fora das comparações"; nenhuma de valor), amostra, seleção e o que o navegador devolveu (texto, tabelas e CSV baixados, em JSON Lines comprimido). |
| E5 `controle_negativo.py` | Controle negativo do conferidor. |
| E6 `composicao_mediana_serie.py`, `composicao_mediana_serie.csv` | Efeito da composição variável sobre 28 séries da mediana. |
| E7 `recalculo_gold.py`, `recalculo_estatisticas_grupo.csv`, `recalculo_razao_agregada.csv`, `recalculo_derivados.csv`, `recalculo_csv_x_gold.csv` | Recálculo da gold e dos CSV (1.530 referências, 120 razões, derivados, 9.137 linhas). Os arquivos de divergência vazios mostram 0; o de estatísticas lista só os 673 casos sem referência por desenho (subfunção e ponte). |
| E8 `verifica_fontes_siconfi_sidra.py`, `verificacao_fontes_dca_sidra.csv`, `verifica_fontes_inep.py`, `verificacao_fontes_inep.csv`, `verifica_rreo.py`, `verificacao_fontes_rreo.csv`, `verifica_msc_por_matricula.py`, `verificacao_msc_por_matricula.csv`, `verifica_sinopse_2025.py`, `verificacao_sinopse_2025.csv`, `verifica_ocde.py`, `verificacao_ocde_tamanho_turma.csv` | Conferências contra as fontes oficiais (234 DCA e populações, 130 RREO, 3.016 INEP, 78 Sinopse, 8 OCDE, 7 pares de MSC). |
| E9 `reproducao_isolada.txt` | Reconstrução da gold em área isolada. |
| E10 `testes_executados.txt` | Saída dos testes que rodei. |
| E11 `dicionario_x_csv.txt` | Colunas dos CSV da interface contra o dicionário baixado. |
| E12 `desempenho.mjs`, `desempenho_desktop.json`, `desempenho_movel_4x.json`, `desempenho_movel_lento.json`, `desempenho_resumo.csv` | Protocolo e resultados das medições. |
| E13 `interacao_preserva_valores.mjs`, `interacao_preserva_valores.txt`, `console_download.mjs`, `semjs.mjs`, `saeb_header.mjs` | Interações, console com e sem download, página sem JavaScript e cabeçalho do Saeb. |
| E14 `confere_tabela_simples.py`, `resultado_tabela_simples.csv`, `amostra_tabela_simples.json` | Visão Tabela dos exploradores contra o recálculo e o CSV (55 tabelas, 110 checagens, 0 divergências). |
