# Validação da primeira entrega

Data: 14/10/2026. Todas as notas abaixo são **autoavaliação do autor da entrega, não revisão independente**, com uma exceção: a revisão em contexto limpo de 16/10/2026, feita por agente sem participação na construção, está registrada no fim deste documento e em [REVISAO_2026-10-16.md](./REVISAO_2026-10-16.md). Ela não substitui revisão por pessoa. "Não verificado" significa que o teste não foi feito.

## Evidências automatizadas

| Verificação | Comando | Resultado |
|---|---|---|
| Gold reproduzível byte a byte a partir do seed; conferências zeradas; ausência não vira zero; SISAGUA | `python3 -m unittest pipeline.tests.test_observatorio_saneamento` | 28 testes em 17/10/2026, todos passam |
| Somas municipais reproduzem IBGE e consolidado SINISA; 429 valores iguais aos da Eficiência Estatal; agregação por soma; zero e ausência; capítulos sem promessa; sem travessão | `npx vitest run src/tests/saneamento-gold.test.ts` | 25 testes em 17/10/2026, todos passam |
| Correções da revisão de 16/10/2026: GFI1037 fora da ficha, tarifa por prestador e soma, razão acima de 100 sinalizada e fora das classes do mapa, N efetivo dos pares, ressalva dos índices da NR 8; itens 1.11 c, d, e, f e h (duração média com divisão por zero, retificação da água por UF, contagens que fecham, estações acima da capacidade sem arredondar, data da Deliberação ARSESP 1.699; colunas GTA0019, GTA3006 e GTA1014 sem soma) | `npx vitest run src/tests/saneamento-revisao-out26.test.ts` | 22 testes em 17/10/2026, todos passam |
| Simulador: exemplos dos reguladores ao centavo, limites de faixa, municípios associados, diferença de arredondamento entre parcelas e total (item 1.11 i) | `npx vitest run src/tests/saneamento-conta.test.ts` | 15 testes em 17/10/2026, todos passam |
| Registro de domínios (seis observatórios), rotas públicas, sitemap | `npx vitest run src/tests/dois-observatorios.test.ts src/tests/rotas-publicas.test.ts` | passam |
| Suíte completa da plataforma | `npx vitest run` | 4.932 passam; 1 falha por tempo limite em `trabalho-renda-dados.test.ts` sob carga, que passa isolado (6 de 6) e não toca o saneamento |
| Tipos e lint | `npx tsc --noEmit`, `npx next lint` | sem erros |
| Build de produção | `npm run build` | concluído; 23 rotas do saneamento geradas (2 dinâmicas: fichas de município e de prestador) |

## Inspeção em navegador (build de produção, Playwright/Chromium)

Script: `scripts/saneamento/verificacao.mjs`, sessão de auditoria local. 24 rotas × larguras 320, 390, 768 e 1440 px = 96 medições: HTTP 200, exatamente um H1, nenhuma rolagem horizontal da página e nenhum erro de JavaScript em todas. Capturas de página inteira revisadas a olho por amostra: esgoto, planejamento, investimento, tarifa social e ficha da SABESP em 1440 px; comparador de prestadores e ficha de Alta Floresta D'Oeste em 390 px; tarifa social em 320 px; páginas do capítulo 5 em 390 e 1440 px. As demais capturas existem e não foram lidas uma a uma.

Não verificado: leitor de tela real, zoom de texto a 200%, contraste por ferramenta automatizada (axe), navegação só por teclado de ponta a ponta, desempenho de campo e rede lenta.

## Rubrica por página (autoavaliação)

Critérios: dado real com fonte e período (D), método e ressalvas visíveis (M), comportamento técnico verificado (T), resposta à pergunta do capítulo (R). Nota de 0 a 10.

| Rota | D | M | T | R | Nota | Observação |
|---|---|---|---|---|---|---|
| `/saneamento` | sim | sim | sim | sim | 9 | Índice dos eixos com situação de cada capítulo |
| `/saneamento/acesso` | sim | sim | sim | sim | 9 | Atlas, pessoas e proporção, composição das fontes, evolução |
| `/saneamento/continuidade` | sim | sim | sim | parcial | 8 | SISAGUA de 2014 a 2025 integrado: seis parâmetros do controle, vigilância, plano de SAA e SAC desde 2023 e população cadastrada; substâncias químicas, radioatividade e cianotoxinas só em 2024 e 2025; paralisações e racionamento são declaração do prestador, sem auditoria |
| `/saneamento/esgoto` | sim | sim | sim | sim | 9 | Mapa de estações não publicado por coordenadas inconsistentes |
| `/saneamento/preco-regulado` e 5.1 a 5.5 | sim | sim | sim | parcial | 8 | Amostra de oito prestadores; série da conta contra inflação ausente; Saneago com cobrança por faixa inferida; Corsan só a Residencial B |
| `/saneamento/tarifa-social` | sim | sim | sim | parcial | 8 | Economias com tarifa social por 100 famílias elegíveis do CadÚnico; famílias beneficiadas não publicadas |
| `/saneamento/prestadores` e fichas | sim | sim | sim | parcial | 8 | Controle societário só das 17 companhias abertas com FRE na CVM; os demais prestadores seguem sem esse dado |
| `/saneamento/prestadores/comparar` | sim | sim | sim | parcial | 8 | Sem seleção automática de pares |
| `/saneamento/investimento` | sim | sim | sim | parcial | 8 | Sem ligação a obras |
| `/saneamento/financiamento` | sim | sim | sim | parcial | 7 | Sem BNDES, CAIXA e Transferegov |
| `/saneamento/planejamento` | sim | sim | sim | parcial | 8 | Aproximação da NR 8 sem ICA, ICE e soluções alternativas; não declara cumprimento de meta; índices acima de 100% contados e explicados |
| `/saneamento/saude-ambiente` | sim | sim | sim | parcial | 8 | Três grupos de doenças, 2022 a 2024, sem ajuste por idade; associação entre grupos de municípios, não causa; água bruta, dengue e hepatite A fora |
| `/saneamento/responsaveis` | sim | sim | sim | parcial | 7 | Sem fiscalizações e sanções |
| `/saneamento/resiliencia` | sim | sim | sim | parcial | 7 | Sem mananciais e eventos extremos |
| `/saneamento/municipio` e fichas | sim | sim | sim | parcial | 8 | Busca, comparação com UF, Brasil e pares com N efetivo; razão de tarifa social sinalizada; categoria Água Solidária da SANEPAR não registrada |
| `/saneamento/comparar` | sim | sim | sim | sim | 8 | Até quatro municípios, link e CSV |
| `/saneamento/metodologia` (pública) | sim | sim | sim | sim | 9 | Fontes com sha256, matriz, conferências, downloads |

Páginas abaixo de 9 ficam abaixo por lacuna de dado declarada, não por defeito conhecido de interface. Na primeira entrega, capítulos 2 e 13 não tinham página. A entrega de desigualdades está registrada abaixo; saúde e ambiente, comparação internacional e explorador de prioridades seguem sem página.

## Recomendação

Antes de abrir o domínio ao público, revisão em contexto limpo por pessoa ou agente sem participação na construção, cobrindo: conferência amostral dos números da ficha municipal contra as planilhas do SINISA, leitura dos estudos de caso tarifários contra as notas técnicas, e acessibilidade com leitor de tela.

## Integração do CadÚnico (14/10/2026)

- Fonte: MDS, SAGI, API MI Social, meses 202412 e 202609, sha256 de cada consulta em `meta.json`.
- Conferência: até meio salário-mínimo + acima = total de famílias em 11.141 de 11.141 registros municipais; um município sem dado em dez/2024 (510183, instalado depois).
- Testes: `saneamento-gold.test.ts` passa a exigir que a soma municipal reproduza o total do Brasil, que a razão seja razão de somas no mesmo universo, que "não oferece" conte zero e que "sem resposta" fique sem dado.
- Navegador (servidor de desenvolvimento): tarifa social, ficha de Recife, metodologia e investimento em 320, 390 e 1440 px, HTTP 200, um H1, sem transbordo, sem erro de JavaScript.
- Não verificado: número oficial independente do total de dezembro de 2024 (o total vem da própria base do MDS).

## Desigualdades e correção da tarifa social (14/10/2026)

**Autoavaliação, não revisão independente.** A correção `5028844bd` foi incorporada por cherry-pick. A referência nacional da tarifa social mostra 26.643.139 famílias elegíveis; 3.808.156 economias / 26.643.139 famílias mantém 14,3 por 100 (SINISA 2024 e CadÚnico dez/2024). A correção isolada não mudou a gold. O capítulo 2 acrescenta campos derivados do Censo 2022, sem alterar as medidas anteriores.

### Dados e código

- 56 respostas de dados e 6 metadados do IBGE preservados com SHA-256; 14 medidas municipais e referências oficiais de Brasil, regiões e UFs.
- `python3 -m pipeline.observatorio_saneamento.gold`: gold reconstruída; os 8 testes de `pipeline.tests.test_observatorio_saneamento` passaram em Python 3.11, 3.12 e 3.13, incluindo comparação byte a byte de todos os arquivos, hashes, universos e divergências publicadas.
- Tipos e lint sem erros. Build de produção aprovado com 620 páginas.
- 55 testes específicos passaram (saneamento-gold, saneamento-conta, rotas-publicas e dois-observatorios).
- Suíte completa após implementação do capítulo: 4.920 passaram e 1 ignorado. Repetição após o ajuste de texto ampliado, concorrendo com Chromium: 4.918 passaram, 1 ignorado e 2 timeouts de 5 s em `obee-mobilidade.test.ts`. Reexecução isolada do arquivo, sem mudar timeout ou assertions: 14/14 passaram. São resultados distintos, não uma suíte final integralmente verde. Nenhuma falha de asserção foi observada.

### Navegador e acessibilidade

Build de produção com sessão local de auditoria. `scripts/saneamento/verificacao.mjs` em `/saneamento/desigualdades` e `/saneamento/tarifa-social`, larguras 320, 390, 768 e 1440 px: 8/8 verificações com HTTP 200, um H1, sem transbordamento horizontal ou erro JavaScript. Capturas de página inteira registradas; leitura visual do capítulo em desktop e do atlas com favelas/Pernambuco.

Conferência adicional da rota nova: números nacionais comparados com a gold, seleção de medida e UF preservada na URL após recarga, alternância de proporção para domicílios por foco e Espaço, CSV com todas as 392 linhas (Brasil + 27 UFs × 14 medidas), sem limitar a exportação às 20 linhas inicialmente exibidas. Texto a 200% em viewport de 390 px: sem transbordamento após limitar a largura mínima da busca do mapa ao espaço disponível e manter a marca tipográfica nas dimensões do logotipo.

Axe, regras WCAG 2 A/AA e 2.1 AA: nenhuma violação automática; `color-contrast` permaneceu na lista de conferência incompleta. Não equivale a certificação WCAG. Não verificados: leitor de tela real, todas as tarefas de ponta a ponta só por teclado, contraste manual de todos os estados, rede lenta e as demais rotas nesta rodada. As capturas e relatórios da execução estão no workspace, em `/workspace/cloud-setup/desigualdades-final-visual/` e `/workspace/cloud-setup/desigualdades-visual/`.

### Rubrica da rota nova

| Critério | Autoavaliação | Evidência e limite |
|---|---|---|
| Direção de arte | 9/10 | Tokens existentes, peças editoriais e gráficos da plataforma, sem cores novas |
| Hierarquia | 9/10 | Pergunta, síntese factual, comparação nacional, recortes e exploração territorial |
| Tipografia e acabamento | 8/10 | Valores tabulares e rótulos completos; notas metodológicas extensas |
| Densidade e profundidade | 9/10 | Contagens, razões, denominadores, atlas, tabelas, cobertura e CSV completo |
| Didática visual | 9/10 | Moradores e domicílios separados; água e esgoto em figuras distintas |
| Comparabilidade | 9/10 | Referências oficiais por grupo, sobreposição e supressões explícitas |
| Interação e acessibilidade | 8/10 | URL, exportação, rádio por teclado e axe; leitor de tela e contraste manual pendentes |
| Responsividade | 9/10 | Quatro larguras e texto a 200%, sem transbordamento; tabelas com rolagem própria |

### Cobertura parcial

Ainda não integram o capítulo: ligação à rede de água para quilombolas e indígenas pela identificação ampliada, urbano/rural e renda individual cruzada com saneamento. Não se inferiu ligação a partir de forma principal de abastecimento. As próximas entregas do roteiro (SISAGUA, DATASUS, expansão tarifária e outras integrações) não foram implementadas nesta entrega 4.1.

## Ajustes pós-revisão do capítulo 2 (14/10/2026)

- As 28 colunas do capítulo 2 saem de `municipios.json` para `desigualdades_municipios.json|csv`, carregado só pelo atlas do capítulo. `municipios.json` volta a 1.865.949 bytes, o tamanho anterior ao capítulo; o arquivo novo tem 654.199 bytes.
- O comparador de municípios usa só as medidas gerais (`MEDIDAS_GERAIS`); os recortes por grupo ficam na página do capítulo.
- Os dois CSVs da página do capítulo baixam com a extensão `.csv`, e a tabela de quilombolas, indígenas e favelas passa a ser região rolável por teclado.
- Verificação: 56 testes específicos, 8 testes de pipeline (Python 3.11 e 3.13), tipos, lint e build sem erro; suíte completa com 4.926 testes aprovados e 1 ignorado. Navegador: capítulo 2, acesso, tarifa social, comparador e metodologia em 320, 390 e 1440 px, HTTP 200, um H1, sem transbordo e sem erro de JavaScript; o atlas do capítulo 2 carrega os valores do arquivo próprio.
- Achado fora do escopo, não corrigido aqui: em 320 px, o cabeçalho público da home e do Crédito transborda 57 px pelos botões "Entrar / Criar acesso". Não decorre da troca de `text-lg` por `text-[18px]` no logotipo, que mantém o tamanho da fonte.

## Qualidade da água, SISAGUA (14/10/2026)

- Fontes: controle mensal (parâmetros básicos e plano de amostragem) e vigilância (parâmetros básicos) de 2024 e 2025, e amostras fora do padrão, baixados do S3 do Ministério da Saúde. Arquivos atualizados pelo Ministério entre 02 e 04/10/2026; sha256 e `Last-Modified` em `meta.json.sisagua`. Inventário completo antes de codificar: 10,4 milhões de linhas no controle de 2024, 3,08 milhões de análises na vigilância de 2024, 12 meses nos dois anos.
- Números verificados (Brasil, soma de análises): controle 2024, E. coli presente em 3.929 de 1.744.151 análises (0,23%); vigilância de rotina 2024, 18.762 de 463.493 (4,0%); plano de amostragem 2024, 1.145.079 de 1.961.604 análises de coliformes exigidas na rede de SAA cobertas (58,4%). Registro em 2024: 4.563 municípios com controle, 5.071 com vigilância, 4.351 com os dois e 288 com nenhum, de 5.571.
- Conferência publicada: E. coli no controle mensal de 2024, 3.929 contadores; no arquivo de amostras fora do padrão, 964 linhas. O dicionário informa que o registro por amostra não é obrigatório; a diferença não é ajustada.
- Pipeline: 16 testes Python (inclui ZIP sintético com latin-1, vírgula decimal, rótulo de turbidez em duas grafias, RA do DF, amostra duplicada, resultado abaixo do LQ, motivo de denúncia, rótulo novo e cabeçalho mudado), aprovados em Python 3.11, 3.12 e 3.13; gold reproduzível byte a byte; seed com sha256 conferido pela gold.
- Front: 23 testes da gold (colunas `qa_` fora da tabela geral e do comparador, registro igual ao de `meta.json`, ausência nunca zero, Brasil como soma, plano até 100%, ficha igual ao arquivo próprio); tipos, lint e build sem erro; suíte completa com 4.930 testes aprovados e 1 ignorado.
- Navegador: capítulo 3, fichas de São Paulo e Brasília, metodologia e comparador em 320, 390, 768 e 1440 px, HTTP 200, um H1, sem transbordo e sem erro de JavaScript.
- Não verificado: leitor de tela real e contraste por ferramenta automatizada na seção nova.

## SISAGUA: cor, fluoreto, plano de SAC, cadastro e série 2014 a 2025 (14/10/2026)

- Inventário de rótulos em todos os anos antes da coleta: controle de 2014 com cabeçalho antigo (mapeado por aliases); vigilância até 2022 com "Bactérias Heterotróficas" sem unidade; a partir de 2023, linhas repetidas para o mesmo campo com outro nome de ETA/UTA (com o mesmo valor, contam uma vez; com valor diferente, o grupo sai). Rótulo de parâmetro, ponto, tipo ou motivo não previsto interrompe a coleta.
- Plano de amostragem: CSV de 2014 a 2021 indisponível (404 e ausente no S3); 2022 com outro layout e exigência total de 3.106.260 análises de coliformes na rede de SAA, contra 1.985.700 em 2023 e 1.962.324 em 2024. Em todos os anos, o total anual é 12 vezes o mensal nos sistemas de frequência mensal. A série do plano começa em 2023.
- Números de 2024 (Brasil, soma de análises): cor acima de 15 uH em 60.142 de 2.184.137 análises do controle (2,75%); fluoreto acima de 1,5 mg/L em 12.830 de 502.545 (2,55%), em 1.435 municípios; vigilância, fluoreto acima do máximo em 2.179 de 166.982 (1,30%). Plano das SAC: 170.699 de 3.143.964 análises exigidas cobertas (5,4%); 41.068 de 52.502 soluções com plano sem controle informado. Cadastro: 126.103.284 de 136.748.971 pessoas cadastradas sob SAA com controle (92,2%); 2.582.064 de 8.255.091 sob SAC (31,3%).
- Série: municípios com controle registrado passam de 3.634 (2014) a 4.563 (2024); E. coli na vigilância de rotina, de 5,8% (2014) a 4,0% (2024). A série descreve o registro: a mudança de quem informa altera a média.
- Os números de 2024 da primeira entrega não mudaram (E. coli no controle, 3.929 de 1.744.151; plano de SAA, 58,4%).
- Verificação: 19 testes Python em 3.11, 3.12 e 3.13 (gold reproduzível byte a byte; nenhum código fora do universo em nenhum ano); 24 testes da gold no Vitest (série nacional igual à soma das UFs em todos os anos e igual à soma municipal nos anos do atlas); tipos, lint e build sem erro. Navegador: capítulo 3, fichas de São Paulo e Porto Alegre e metodologia em 320, 390, 768 e 1440 px, HTTP 200, um H1, sem transbordo e sem erro de JavaScript.

## SISAGUA: substâncias químicas, radioatividade e cianotoxinas (14/10/2026)

- Fontes: controle semestral de 2024 e 2025 (151 e 199 MB), vigilância de demais parâmetros, vigilância de cianobactérias e cianotoxinas e controle mensal de demais parâmetros (arquivos únicos), atualizados pelo Ministério entre 18/09 e 05/10/2026 e extraídos em 14/10/2026; tabelas dos Anexos 9, 10 e 11 da Portaria 888 extraídas do texto oficial.
- Números de 2024 (água tratada, Brasil): controle semestral em 1.858 municípios; agrotóxicos acima do VMP em 135 de 428.279 análises (0,03%); inorgânicas em 531 de 160.567 (0,33%); subprodutos da desinfecção em 1.975 de 76.525 (2,58%, contagem pontual; a norma usa média de 12 meses); organoléptico em 3.099 de 247.161 (1,25%). Vigilância química em 830 municípios. Cianotoxinas na água tratada pela vigilância: 21 municípios com análise, 1 com resultado acima do VMP.
- Conferências: nenhum código fora do universo; VMP do arquivo diferente do da Portaria 888 contado por grupo (norma anterior); unidades divergentes e resultados abaixo de limite maior que o VMP contados e excluídos.
- Verificação: 25 testes Python em 3.11 e 3.13 (inclui casamento com a Portaria, sinônimos, classificação, água tratada e arquivo sintético); testes da gold no Vitest reproduzem os totais por grupo de `meta.json`.

## Revisão em contexto limpo (16/10/2026)

Revisão somente leitura por agente sem participação na construção, com acesso às fontes originais; o relatório completo, com evidência, inferência, recomendação e o que não foi verificado, está em [REVISAO_2026-10-16.md](./REVISAO_2026-10-16.md). Não é revisão por pessoa, e acessibilidade com leitor de tela continua sem verificação.

- **Fidelidade dos dados:** gold reconstruída idêntica byte a byte; 5.571 municípios reproduzem o seed e os indicadores oficiais do SINISA; 21 planilhas do seed iguais célula a célula aos XLSX originais; amostra de 28 municípios, somas de 33 territórios e 62 contas tarifárias recalculadas em Decimal sem diferença.
- **Defeitos de apresentação encontrados e corrigidos na PR de 16/10/2026:** valor médio da tarifa social (GFI1037) impresso na ficha apesar de documentado como não publicado; bloco de tarifa mostrando só o primeiro prestador ao lado de razão calculada sobre a soma; razão de tarifa social sem checagem de plausibilidade; IAA e IAE acima de 100% sem ressalva na ficha e no KPI do capítulo 11; N dos pares superdimensionado; universo de UF e Brasil não rotulado na ficha; frase de comparabilidade dos Censos mais forte que a ressalva; investimento por residente com denominador diferente do mapa e da METODOLOGIA.
- **Rebaixamentos:** capítulo 11 passa de Publicado a Parcial; fichas de município e planejamento passam de nota 9 a 8, com R parcial.
- **Água Solidária (achado 1.8):** registrada depois, em PR separada, com a tabela do Anexo Único da Resolução AGEPAR 23/2026, esgoto a 50%, fontes com sha256 e critérios de enquadramento publicados pela Sanepar registrados e enquadramento declarado como não verificado (texto do decreto estadual não lido). Teste: `src/tests/saneamento-agua-solidaria.test.ts`.
- **Abertos:** ajustes menores de texto listados no relatório (item 1.11).

## Saúde e ambiente, SIH e SIM (16/10/2026)

- Fontes: DATASUS, TabNet, SIH/SUS (internações e óbitos hospitalares, `sih/cnv/nrbr.def`, arquivos mensais `nrbrYYMM`) e SIM (óbitos, `sim/cnv/obt10br.def`, arquivos `obtbrYY`), ambos por local de residência, janela de 2022 a 2024, extração de 16/10/2026 (SIM com dados finais até 2024). Nove consultas (três grupos × internações SIH, óbitos SIH, óbitos SIM) guardadas em `pipeline/observatorio_saneamento/seed/saude/` com sha256 do original e das definições do TabNet. O ambiente bloqueia `ckan-dadosabertos.saude.gov.br`; os dados vieram do TabNet.
- Totais da fonte na janela (Brasil): infecções intestinais, 459.216 internações SIH, 5.857 óbitos hospitalares SIH e 17.851 óbitos SIM; leptospirose, 6.322 internações, 428 óbitos SIH e 1.036 óbitos SIM; esquistossomose, 425 internações, 20 óbitos SIH e 1.191 óbitos SIM.
- Conferências: em cada uma das nove consultas, soma dos municípios mais casos sem município de residência igual ao total devolvido pelo TabNet (diferença 0); linha a linha, soma dos anos igual à coluna Total; 5.571 municípios com linha; casos sem município declarados (3 de óbitos SIM de infecções intestinais e 1 de leptospirose).
- Taxas: casos ÷ (3 anos × moradores do Censo 2022) × 100 mil, calculadas na camada de apresentação; Brasil e UFs por razão de somas. 5.570 municípios com valor e 1 sem moradores do Censo.
- Verificação: 12 testes Python (`pipeline/tests/test_saude.py`, incluem rejeição de soma divergente, município repetido, valor desconhecido e resposta sem tabela) e 11 testes no Vitest (`src/tests/saneamento-saude.test.ts`: contagens inteiras, total igual à soma dos grupos, conferência com o TabNet, taxa recalculada fora da página, quintis recalculados, ausência de NaN e travessão). Gold reconstruída reproduzível; só `meta.json` mudou, mais os dois arquivos novos.
- Navegador (Chromium, servidor de desenvolvimento, 1440 e 390 px): HTTP 200, um H1, sem rolagem horizontal, atlas com 5.570 municípios com valor e 1 sem dado, troca entre as seis medidas funcionando, sem avisos no console. Build de produção e orçamento de 400 KB do HTML não verificados aqui (o `next build` local falha por falta dos tipos do Playwright); HTML do servidor medido em cerca de 64 KB e o teste `html-gerado` decide na CI. Acessibilidade com leitor de tela não verificada.
- Leitura permitida: nos municípios agrupados por carência de esgoto do Censo 2022, a taxa de internações por infecções intestinais sobe de 32,0 no primeiro quinto para 265,8 no último (por 100 mil ao ano), enquanto os óbitos hospitalares ficam estáveis (2,8 a 3,2) e a leptospirose não é monotônica. É associação entre grupos de municípios, sem ajuste por idade, renda, acesso ao hospital ou prática de internar; não é efeito do esgoto.
- Limites declarados na página: taxas de municípios com poucos casos são instáveis (máximo municipal de 8.146,9 por 100 mil ao ano); o SIH registra internações no SUS, não toda a doença; os seis últimos meses do SIH estão sujeitos a atualização; a ligação do ano de atendimento do SIH com o mês de internação não foi verificada além da definição da fonte; dengue, hepatite A (dentro de outras hepatites virais na Lista de Morbidade) e qualidade da água bruta ficam fora. Capítulo 13 permanece Parcial.

## Controle societário, CVM (16/10/2026)

- Fonte: CVM, dados abertos, `fre_cia_aberta_2026.zip` (8.144.189 bytes, Last-Modified 11/10/2026, capturado em 16/10/2026), índice de documentos e arquivo `posicao_acionaria`. Seed com 585 linhas das 17 companhias do recorte, sem CPF e sem as colunas que a gold não usa, sha256 do ZIP e dos dois arquivos lidos em `seed/cvm/manifesto.json`.
- Ligação com o SINISA: 17 CNPJs declarados por municípios como prestadores de água ou esgoto (prestação existente) têm FRE em 2026; os 17 foram ligados a uma ficha de prestador, com cobertura de 99,5% a 100% dos municípios declarados e sem empate. Não houve casamento por nome. Dois prestadores de mesma sigla (SANEPAR em PR e em PA) não se confundem porque só a ficha que cobre os municípios do CNPJ é ligada.
- Conferências: posições diretas somam 100% em todas as 17 (maior desvio 0,001 ponto percentual); cadeia de cada acionista fecha 100% (maior desvio 0,004); nenhum acionista relacionado órfão ou ciclo; documento usado é a maior versão do índice em todas.
- Números na gold: 323 acionistas na árvore publicada e 48 pessoas físicas não controladoras somadas; nenhum CPF em `controle_societario.json`, no CSV nem no seed `seed/cvm/posicao_acionaria.csv.gz` (testes procuram o padrão; o seed leva 15 colunas e troca por "Pessoa física" o nome das 48 pessoas físicas não controladoras; achado do Codex na PR, corrigido antes do merge).
- Achados sobre a fonte: a data de referência dos documentos (31/12/2026) é posterior à data de recebimento (maio a outubro de 2026), então a página usa o recebimento; Sabesp, Copasa, Saneago e Sanasa não declaram controlador; Sabesp e Corsan têm participantes de acordo de acionistas declarados entre os acionistas diretos; uma posição de 30 ações ordinárias (Companhia Paulista de Parcerias na Sabesp) tem percentual arredondado a zero e é exibida como "menos de 0,001%", não como zero.
- Cobertura nacional: as 17 companhias respondem por 87.721.109 de 174.018.231 pessoas atendidas com rede de água declaradas ao SINISA 2024 (50,4%), soma das populações dos prestadores sobre o consolidado do Brasil, mesma fórmula usada para os prestadores regionais. Os outros 1.780 prestadores não têm posição acionária neste formato.
- Verificação: 14 testes Python (`pipeline/tests/test_controle.py`: árvore, pessoa física, CPF, órfão e ciclo, soma de 100%, escolha da ficha, seed) e 10 no Vitest (`src/tests/saneamento-controle.test.ts`: gold, soma de 100% recalculada, privacidade, CSV, capítulo e 17 fichas renderizadas); vigília ganhou os cheques da CVM e do DATASUS com 5 testes novos (25 no arquivo) e, rodados contra as fontes reais em 16/10/2026, ficaram em silêncio.
- Navegador (Chromium, servidor de desenvolvimento, 1440 e 390 px): capítulo 7, ficha da Corsan (árvore de 5 níveis, 21 linhas) e ficha da Sanepar com HTTP 200, um H1, sem rolagem horizontal e sem avisos no console. Build de produção, orçamento de 400 KB do HTML do capítulo 7 e acessibilidade com leitor de tela não verificados aqui.
- Não verificado: significado exato do denominador dos percentuais ("em circulação" no dicionário da CVM); a leitura como participação no capital se apoia na soma de 100% das posições diretas e das cadeias. Texto dos acordos de acionistas e dos estatutos não foi lido.
- Fora do recorte, por escolha declarada: empresas fechadas, SPEs sem registro na CVM, autarquias e serviços municipais; grupos econômicos além da cadeia declarada por cada companhia. Capítulo 7 permanece Parcial.

## Comparação internacional, JMP (17/10/2026)

- Fonte: JMP (OMS e UNICEF), base de domicílios, arquivo mundial (25.098.506 bytes, Last-Modified 26/08/2025, atualização de agosto de 2025), abas `wat` e `san`, 2000 a 2024; arquivo do Brasil (Data Summary, 83 fontes); API de países do IBGE (193 países) para os nomes em português. Seed de 1,4 MB com só as colunas usadas, sha256 dos três originais e dos quatro seeds reduzidos em `seed/jmp/manifesto.json`; a leitura recusa seed alterado.
- Conferências: 14.568 estimativas de água e 14.422 de esgotamento têm os quatro degraus somando 100% (desvio máximo 0,0000) e gerenciado nunca acima de pelo menos básico; um país por código por ano. 223 áreas em 2024, 219 com água e 214 com esgotamento; 159 com água gerenciada com segurança e 145 com esgotamento gerenciado. 185 áreas têm nome do IBGE e 38 territórios ficam com o nome em inglês do JMP.
- Brasil em 2024 (JMP): água gerenciada com segurança 88,6%, pelo menos básica 100,0%; esgotamento gerenciado 55,0%, pelo menos básico 92,4%, defecação a céu aberto 0,0%. Entre as áreas com estimativa, 74 de 159 têm água gerenciada maior que a do Brasil e 81 de 145 têm esgotamento gerenciado maior; em esgotamento pelo menos básico, 119 de 210 têm valor maior.
- Conciliação (JMP 2022 contra Censo 2022): água pelo menos básica 99,6% contra ligação à rede geral 86,6% (+13,0 p.p.; SINISA 2024 84,1%); esgotamento pelo menos básico 91,0% contra rede ou fossa séptica 75,7% (+15,3); ligação à rede de esgoto 71,2% contra 62,5% do Censo e 62,3% do SINISA 2024; defecação a céu aberto 0,0% contra 0,6% de moradores sem banheiro. Nenhum par é tratado como a mesma medida.
- Achados sobre a fonte: o JMP estima defecação a céu aberto exatamente 0,0% no Brasil a partir de 2022 (0,18% em 2021), enquanto o Censo 2022 registra 1,18 milhão de moradores sem banheiro nem sanitário; a ligação à rede de esgoto do JMP em 2022 (71,2%) fica 8,7 pontos percentuais acima do Censo e do SINISA. Os motivos não foram verificados. Entre as fontes que o JMP lista para o Brasil estão PNAD, SNIS, SISAGUA e o Censo.
- Verificação: 11 testes Python (`pipeline/tests/test_jmp.py`: soma dos degraus, gerenciado contra básico, nomes IBGE, série, colunas do seed, hashes) e testes no Vitest (`src/tests/saneamento-internacional.test.ts`: gold, valores do Brasil lidos da fonte, posição e medianas recalculadas por fora, conciliação recalculada do Censo, página renderizada); a vigília ganhou o cheque do JMP para o arquivo mundial e para o arquivo do Brasil, que mudam por conta própria (28 testes no arquivo; contra as fontes reais em 17/10/2026, silêncio).
- Navegador (Chromium, servidor de desenvolvimento, 1440 e 390 px): HTTP 200, um H1, sem rolagem horizontal e sem avisos no console. Build de produção e acessibilidade com leitor de tela não verificados aqui.
- Não verificado: por que o JMP e o Censo divergem nos pares da conciliação; como o JMP trata a categoria sem banheiro no Brasil; o peso de cada fonte nas estimativas; tradução livre das definições dos degraus conferida só contra o texto em inglês da aba Ladders. Sem mediana ponderada por população. A tradução da ferramenta (fase 5 do plano de i18n) não foi iniciada: o plano exige as fases 0 a 4 concluídas antes.
