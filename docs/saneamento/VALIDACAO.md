# Validação da primeira entrega

Data: 14/10/2026. Todas as notas abaixo são **autoavaliação do autor da entrega, não revisão independente**, com uma exceção: a revisão em contexto limpo de 16/10/2026, feita por agente sem participação na construção, está registrada no fim deste documento e em [REVISAO_2026-10-16.md](./REVISAO_2026-10-16.md). Ela não substitui revisão por pessoa. "Não verificado" significa que o teste não foi feito.

## Evidências automatizadas

| Verificação | Comando | Resultado |
|---|---|---|
| Gold reproduzível byte a byte a partir do seed; conferências zeradas; ausência não vira zero; SISAGUA | `python3 -m unittest pipeline.tests.test_observatorio_saneamento` | 26 testes em 16/10/2026, todos passam |
| Somas municipais reproduzem IBGE e consolidado SINISA; 429 valores iguais aos da Eficiência Estatal; agregação por soma; zero e ausência; capítulos sem promessa; sem travessão | `npx vitest run src/tests/saneamento-gold.test.ts` | 25 testes em 16/10/2026, todos passam |
| Correções da revisão de 16/10/2026: GFI1037 fora da ficha, tarifa por prestador e soma, razão acima de 100 sinalizada e fora das classes do mapa, N efetivo dos pares, ressalva dos índices da NR 8 | `npx vitest run src/tests/saneamento-revisao-out26.test.ts` | 10 testes, todos passam |
| Simulador: exemplos dos reguladores ao centavo, limites de faixa, municípios associados | `npx vitest run src/tests/saneamento-conta.test.ts` | 11 testes, todos passam |
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
| `/saneamento/continuidade` | sim | sim | sim | parcial | 8 | SISAGUA integrado para quatro parâmetros e o plano de coliformes de SAA; demais parâmetros pendentes |
| `/saneamento/esgoto` | sim | sim | sim | sim | 9 | Mapa de estações não publicado por coordenadas inconsistentes |
| `/saneamento/preco-regulado` e 5.1 a 5.5 | sim | sim | sim | parcial | 8 | Amostra de cinco prestadores; série da conta contra inflação ausente |
| `/saneamento/tarifa-social` | sim | sim | sim | parcial | 8 | Economias com tarifa social por 100 famílias elegíveis do CadÚnico; famílias beneficiadas não publicadas |
| `/saneamento/prestadores` e fichas | sim | sim | sim | parcial | 8 | Sem controle societário |
| `/saneamento/prestadores/comparar` | sim | sim | sim | parcial | 8 | Sem seleção automática de pares |
| `/saneamento/investimento` | sim | sim | sim | parcial | 8 | Sem ligação a obras |
| `/saneamento/financiamento` | sim | sim | sim | parcial | 7 | Sem BNDES, CAIXA e Transferegov |
| `/saneamento/planejamento` | sim | sim | sim | parcial | 8 | Aproximação da NR 8 sem ICA, ICE e soluções alternativas; não declara cumprimento de meta; índices acima de 100% contados e explicados |
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
- **Abertos:** categoria Água Solidária da SANEPAR (decisão editorial e elegibilidade não verificada); ajustes menores de texto listados no relatório (item 1.11).
