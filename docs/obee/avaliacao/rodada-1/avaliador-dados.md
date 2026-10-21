# Avaliação de dados e método, rodada 1

**Avaliador de dados e método, agente independente, rodada 1.** Critérios pontuados: E (indicadores, referências e comparabilidade), F (rigor metodológico), G (rastreabilidade e reprodutibilidade) e K (confiabilidade técnica e desempenho). Também verifico os bloqueios de aprovação ligados a dados. Os critérios A, B, C, D, H, I e J são de outro avaliador e não são pontuados aqui.

Rubrica aplicada: `docs/obee/avaliacao/RUBRICA.md`. Nada em `src/`, `scripts/`, `public/`, `pipeline/` ou nos testes foi alterado. Não houve commit, push, checkout nem stash. As evidências estão em `docs/obee/avaliacao/rodada-1/evidencias/dados/`; os scripts de recálculo, em `evidencias/dados/scripts/`.

Estado avaliado: HEAD `277264514` (merge do PR 123), build de produção em `http://localhost:3100`, gold `educacao_capitais.json` com `hash_dados` `a488bfcb…` (9.137 observações), catálogo `2026-10-08.4`. O site `scrutiniums.com` serve a mesma gold (arquivo idêntico, sha256 `d22d067d…`).

## 1. Matriz (painel, critério, nota)

Notas com uma casa decimal. Escala: 9,0 ou mais exige requisitos demonstrados e apenas problemas menores. A tabela de exigências da rubrica (evidência, requisitos atendidos, limitações, por que não nota inferior, quem avaliou) vem logo depois.

| Painel | Critério | Nota | Justificativa | Evidência | Correção necessária |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,2 | Mínimo, mediana, máximo, média simples, faixa dos 50% centrais e n em cada capítulo; referência nacional do INEP com universo igual (ATU 22,0 e Ideb 6,1 conferidos nos arquivos originais) e referência calculada pelo OBEE rotulada como outro universo. Limita: só o grupo das 26 capitais; despesa por habitante sem aviso do perímetro (exceto intraorçamentárias, 3% a 36% da função segundo o RREO). | `/` : "Quanto se gasta por habitante?", "Contexto nacional R$ 2.125, Mediana de 5.060 municípios"; `efeito_intraorcamentarias_despesa_hab.csv` | Dizer "exceto intraorçamentárias" junto do número e da frase; oferecer grupo de pares |
| Panorama | F | 7,4 | Numeradores e denominadores corretos, estágio liquidado, IPCA declarado, Ideb por edição. Bloqueio B1: a ressalva essencial da exclusão das intraorçamentárias não acompanha o número. O cabeçalho diz "rede municipal" para um painel cujo gasto é do orçamento do município. | `/` cabeçalho "26 capitais estaduais · rede municipal"; ficha `edu.despesa.por_habitante` (campo o_que_nao_mede) | Ver problemas P1 e P3 |
| Panorama | G | 8,2 | "Fonte e critérios" por capítulo abre a ficha de 16 campos; download da gold com tamanho; versão e hash na página Métodos. Sem CSV por capítulo, sem histórico de revisões e sem dicionário do arquivo baixado. | `/` : "Baixar dados (arquivo JSON … 6,7 MB)"; `gold.constroi()` reproduz o mesmo hash | P7 e P9 |
| Panorama | K | 9,0 | Valores do DOM iguais ao recálculo; LCP de laboratório 176 ms; CLS 0,0004; sem erro de console além do favicon. Limita: favicon 404 em todas as páginas; sem teste automatizado de navegador. | `desempenho_laboratorio.csv`; `GET /favicon.ico` 404 | Servir favicon; teste de navegador sobre o DOM |
| Gastos | E | 8,0 | Três escalas lado a lado, mediana, média, extremos com empates, quartis (n de 8 ou mais), razão agregada rotulada e separada da média simples, conferidas nos 180 recortes. Referência nacional só para 2025 na despesa por habitante; nenhuma para o total; para a razão por matrícula só contexto de 2021 de outro universo, dito. Limita: grupo único (26 capitais) e perímetro heterogêneo (P1). | `/gastos?cap=sao-paulo&ano=2024&med=despesa_hab`: mediana R$ 1.104, média R$ 1.157, razão agregada R$ 1.282 (46.192.631 habitantes) | Grupo de pares; aviso de perímetro |
| Gastos | F | 7,0 | Valores, elegibilidade e razão por matrícula refeitos do zero e conferidos nas APIs do Siconfi e do IBGE, sem divergência. Bloqueios B1 (intraorçamentárias) e B2 (evolução da mediana por habitante sem tratar a quebra de população). Subtítulo "capitais estaduais, rede municipal" aplicado a total e por habitante. | `/gastos?med=despesa_hab&vis=evolucao` : "Na mediana das capitais … passou de R$ 625 em 2021 para R$ 1.160 em 2025"; `ExploradorTema.tsx:126,160-166` | P1, P2, P3 |
| Gastos | G | 8,4 | Ficha, ponte "Do total ao numerador", validações V01 a V19, CSV do recorte com 35 colunas (universo, conferência, nota, fonte, versão, hash), trilha de reprodução. Numerador por matrícula refeito pela regra publicada, ao centavo, na API da MSC. Limita: nomes de arquivo iguais para nominal e real; arredondamento a 12 algarismos no CSV do site. | `fontes_originais_e_testes.txt` itens 1 a 3; `obee_gastos_despesa_hab_2024.csv` (nominal e real) | P9, P13 |
| Gastos | K | 8,6 | Suíte do OBEE (126 testes) e suíte completa (2.634) passam; 180 recortes + 60 CSV baixados sem divergência de valor; gate de publicação existe. Limita: a evolução da mediana contradiz a regra própria sem teste que a pegue; centavos "R$ 23.584.096.338,00" onde a DCA tem ",05". | `/gastos?cap=sao-paulo&ano=2025&med=despesa_mat&vis=detalhe`; `dados.ts:74` | P2, P10, P13 |
| Atendimento | E | 7,9 | Matrículas, conveniadas (à parte) e ATU com extremos, empates, quartis e ATU nacional oficial (14,9; 18,2; 22,0; 25,1, conferidos). Matrícula absoluta depende do tamanho da rede e não há taxa de cobertura. Zero de rede que não oferece a etapa entra na mediana. | `/atendimento?med=matriculas&etapa=anos_finais&ano=2025&cap=macapa` : "Macapá (AP) registra 0 … (13.559 matrículas abaixo)" | Taxa de cobertura ou contexto do zero |
| Atendimento | F | 8,6 | Censo Escolar sem alinhamento com o exercício; ausência `--` separada em "não aplicável" e "não divulgado"; conveniadas nunca somadas; matrículas totais por etapa fecham com a Sinopse (26 de 26 em 2024 e 2025). | `/atendimento?med=atu&etapa=anos_finais&ano=2023&cap=macapa`: 23 de 26, "Não aplicável" | Frase da capital com zero real |
| Atendimento | G | 8,5 | Ficha e CSV com estado, fonte e versão; valores de 2025 conferidos no arquivo original do INEP. Sem dicionário nem histórico de revisões. | `edu_atu_rede_municipal.csv`; `atu_orig.py` | P7, P9 |
| Atendimento | K | 8,9 | Sem divergência em 135 recortes e 3 CSV; CLS máximo 0,009 em 320 px; ordem dos empatados difere entre o título e a caixa de referências. | `cenarios_navegador.csv` | P11 |
| Resultados | E | 8,5 | Aprovação, Ideb e Saeb com referência nacional do INEP (Ideb municipal 6,1 e 4,9 conferidos) e diferença em pontos. Edição bienal explícita. Sem grupo de pares. | `/resultados?med=ideb&ano=2024&cap=recife`: seletor mostra edição 2023 | Grupo de pares |
| Resultados | F | 8,2 | Ideb de 26 capitais x 11 edições igual ao arquivo original; nenhuma interpolação de ano par; pandemia anotada. A frase da evolução usa os extremos disponíveis sem dizer que a série termina antes. | `/resultados?cap=boa-vista&med=ideb&etapa=anos_finais&vis=evolucao`: "passou de 4,1 em 2005 para 4,5 em 2007" | P8 |
| Resultados | G | 8,6 | Trilha do Ideb com URL, sha256, linha, P, N e N x P (5,7638 → 5,8) reproduzida; códigos de não divulgação preservados. | `ideb_orig.py`; `metodos` trilha Aracaju 2025 | P7 |
| Resultados | K | 8,8 | 210 recortes e 4 CSV sem divergência; erros apenas o favicon. | `cenarios_navegador.csv` | P10 |
| Comparar capitais | E | 7,3 | Todas as medidas, mesmos resumos do grupo e tabela completa com resumo por coluna. Na visão Gráfico não há referência nacional nem internacional. Só as 26 capitais. | `/comparar?med=despesa_hab&ano=2021` | Referências externas e pares |
| Comparar capitais | F | 7,0 | B1 sem aviso; rótulo "rede municipal" em despesa por habitante; nota material da população de 2021 (estimativa pré Censo) não aparece no Gráfico; texto "Ideb e Saeb usam a edição 2023 (…as colunas ficam sem valor)" se contradiz. | `/comparar?vis=tabela&ano=2024`; `ComparadorCapitais.tsx:100`; `TabelaComparativa.tsx:125` | P1, P3, P4, P6 |
| Comparar capitais | G | 7,2 | Visão Tabela: CSV com 21 colunas e ressalvas por capital. Visão Gráfico: sem "Sobre este dado" e sem CSV. Versão `"1.2"` fixa no código; motivo "Fora do escopo da etapa" para ano par. | `consulta.ts:959,963` | P4, P6, P7 |
| Comparar capitais | K | 8,4 | 2.132 linhas do CSV conferidas com a gold, sem divergência; testes cobrem a regra comum. Defeitos: rótulo errado no CSV e texto contraditório. | `oC.json`, `cenarios_navegador.csv` | P6 |
| Dados e métodos | E | 8,7 | Matriz de referências com 12 candidatas, classe e uso permitido; rejeição fundamentada das internacionais; cobertura e exclusões do cálculo nacional. Inconsistências menores: "38 membros" (V18) contra 34 membros na caixa; grupo regional descrito e não oferecido. | `/metodos` seção "Matriz de referências" | P5, P15 |
| Dados e métodos | F | 8,3 | Política de conferência 1.2 explícita, decisões e descarte da razão da função inteira, população de 2021 e 2023, estágio liquidado, deflator IPCA. Não quantifica o peso das intraorçamentárias; data de referência do Censo 2022 aparece como 1º de agosto e 31 de julho. | `/metodos` Fontes e capturas (1º de agosto) e glossário (31 de julho) | P1, P14 |
| Dados e métodos | G | 8,6 | Trilhas com URL, sha256 e filtro; manifesto; V01 a V19; comandos de reprodução; regeneração idêntica byte a byte; cinco indicadores reconstruídos por mim. Sem link para o repositório na página, sem histórico de revisões, cadeia TLS do INEP incompleta não mencionada. | `gold.constroi()`; `fontes_originais_e_testes.txt` | P7, P9, P19 |
| Dados e métodos | K | 9,0 | Página estática de 706 KB (93 KB comprimidos), CLS 0, LCP 256 ms; sem erro além do favicon. | `desempenho_laboratorio.csv` | Favicon |

### Exigências da rubrica por nota

Avaliador em todas as linhas: **Avaliador de dados e método, agente independente, rodada 1**. Evidência = rota, estado e referência de código ou de arquivo da coluna acima.

| Painel e critério | Requisitos atendidos | Limitações remanescentes | Por que não nota inferior |
| --- | --- | --- | --- |
| Panorama E | Resumo do grupo, n, nacional oficial confirmado, nacional OBEE rotulado | Grupo único; perímetro sem aviso | Todos os números conferem e as referências externas são compatíveis ou rotuladas como outro universo |
| Panorama F | Numerador, denominador, estágio, deflator | B1; "rede municipal" no cabeçalho | Os cálculos são corretos e a quebra de série existe nas outras rotas |
| Panorama G | Fonte por capítulo, download, hash | Sem versão e histórico no ponto de uso | A ficha é a um clique e a gold é reproduzível |
| Panorama K | Valores do DOM iguais ao recálculo, lab limpo | Favicon; sem teste de navegador | Sem erro de cálculo e com desempenho sólido |
| Gastos E | Três escalas, quartis, razão agregada separada | Pares e perímetro | Estatísticas conferidas em 180 recortes |
| Gastos F | Recálculo e APIs sem divergência | B1, B2, rótulo | Cálculos e elegibilidade íntegros; falhas são de apresentação da ressalva |
| Gastos G | Ficha, ponte, CSV de 35 colunas, regeneração exata | Nome de arquivo, 12 dígitos | Numerador refeito ao centavo a partir da documentação |
| Gastos K | Testes, gate, CSV iguais à tela | Evolução da mediana sem teste | Sem erro numérico material |
| Atendimento E | Resumo do grupo, ATU nacional | Matrícula absoluta, zero | Referência nacional verificada |
| Atendimento F | Períodos separados, ausência não vira zero | Frase com zero real | Totais conferidos com a Sinopse |
| Atendimento G | Ficha, CSV, arquivo original conferido | Sem dicionário | Reprodução do ATU feita |
| Atendimento K | Sem divergência, CLS baixo | Ordem de empatados | Nenhum erro funcional |
| Resultados E | Nacional INEP, edição bienal | Pares | Referências conferidas |
| Resultados F | Ideb igual ao original, anotações | Frase com extremos | Sem alinhamento artificial de anos |
| Resultados G | Trilha reproduzida | Histórico | Sha256 igual ao manifesto |
| Resultados K | Sem divergência em 210 recortes e 4 CSV | Teste de navegador | Estável |
| Comparar E | Todas as medidas, resumo por coluna | Sem referência externa no Gráfico | Resumo conferido |
| Comparar F | Regra comum do grupo | B1, texto contraditório | Valores íntegros |
| Comparar G | CSV da Tabela com metadados | Gráfico sem ficha e sem CSV | Tabela documenta ressalvas |
| Comparar K | CSV igual à gold | Rótulo e versão fixos | Sem erro numérico |
| Métodos E | Matriz fundamentada | Inconsistência 38 e 34 | Conteúdo mais completo da amostra |
| Métodos F | Política 1.2, descartes | Data do Censo, intra | Decisões explícitas |
| Métodos G | Trilhas, manifesto, comandos | Sem link, sem histórico | Reprodução efetiva |
| Métodos K | Leve e estável | Favicon | Sem defeito de dado |

## 2. Protocolo, amostra e ambiente

* **Ambiente**: container Linux de 4 núcleos; Chromium headless (Playwright); `http://localhost:3100` como cliente apenas (nada de `next build` nem `next start`); Python 3 com `-I` para ler dados externos; APIs públicas do Siconfi (Tesouro) e do IBGE (SIDRA) acessadas pelo proxy do ambiente; arquivos do INEP baixados de `download.inep.gov.br` com a cadeia de certificados completada pelo certificado intermediário indicado no próprio certificado (verificação TLS mantida).
* **Amostra de navegador (772 carregamentos de página)**. Verificados item a item, e listados em `cenarios_navegador.csv` (638): Gastos 180 (10 capitais, 3 anos, 3 escalas, nominal e real), Atendimento 135 (5 capitais, 3 anos, matrículas, conveniadas e ATU em várias etapas), Resultados 210 (7 capitais, 5 anos de pedido, Ideb, aprovação e Saeb, anos iniciais e finais), Comparar gráfico 36, Tabela comparativa 10, Panorama 6, Métodos 1, e 60 CSV de Gastos baixados. Inspecionados por leitura e comparação dirigida (134): Evolução 66, Detalhe 45, parâmetros inválidos 16 e 7 CSV de Atendimento e Resultados. Capitais mais usadas: São Paulo, Porto Alegre, Campo Grande, Boa Vista, Palmas, Recife, Natal, Rio de Janeiro, São Luís, Belém, Macapá e Rio Branco.
* **Verificação em cada cenário**: título factual (extremos e empates), cobertura, mediana, média simples, menor e maior valor, quartis, n, razão agregada e soma dos denominadores, três cartões da família, frase da capital, lista de capitais fora da comparação, tudo lido do DOM e comparado ao que calculei por conta própria.
* **CSV baixados pelos botões do site**: 60 de Gastos, 10 da tabela comparativa de Comparar, 3 de Atendimento e 4 de Resultados. Conferidos linha a linha com a gold e com o recálculo (2.132 linhas na tabela comparativa; 26 linhas por CSV de tema).
* **Desempenho**: Chromium headless no container, localhost, 5 repetições por rota com contexto limpo, mediana; perfil sem estrangulamento e perfil com CPU 4x e rede de 9 Mbps de descida e 170 ms de latência (CDP). É laboratório, não experiência real.

## 3. Inventário

| Painel | Rota | O que promete | O que o código e os dados sustentam |
| --- | --- | --- | --- |
| Panorama | `/` | Três capítulos (recursos, atendimento, resultados), nenhuma capital pré-selecionada, referências e contexto nacional | Confirmado; despesa 2025 em três escalas, ATU e Ideb de anos iniciais; gold completa para download |
| Gastos | `/gastos` | Total, por habitante, por matrícula; gráfico, tabela, evolução, composição e ponte | Confirmado; estatísticas do grupo vêm do pipeline (`referencias.py`) e coincidem com o meu cálculo |
| Atendimento | `/atendimento` | Matrículas (8 etapas), conveniadas à parte, ATU | Confirmado; totais conferidos com a Sinopse do INEP |
| Resultados | `/resultados` | Aprovação, Ideb e Saeb (matemática e português), anos iniciais e finais | Confirmado; Ideb igual ao arquivo original |
| Comparar | `/comparar` | Qualquer indicador, destaque de até 5 capitais, tabela completa com CSV | Confirmado, com as lacunas de G anotadas |
| Dados e métodos | `/metodos` | Fichas de 13 indicadores, matriz de referências, validações, trilhas, glossário | Confirmado |

Indicadores publicados: 13 fichas (12 com observações, 1 descartada). Observações: 9.137 (população 130; despesa 260; por habitante 260; razão por matrícula 260; subfunções 687; ponte 1.820; matrículas 1.040; conveniadas 1.040; ATU 520; aprovação 260; Ideb 1.716; Saeb 1.144). Referências: 1.530 estatísticas de grupo, 161 externas, 14 internacionais, 1 nacional calculada. Downloads: 1 JSON (6,7 MB) e 15 CSV em `public/eficiencia/series/`.

**Divergência entre o prometido e o entregue**: a metodologia (seção 6) fala em grupo "as capitais da região"; a interface só oferece as 26 capitais (`comparar(..., "todas", ...)` em `ExploradorTema.tsx:105` e `ComparadorCapitais.tsx`), embora os grupos regionais existam na gold e em `referencias_educacao_capitais.csv`.

## 4. Tabela de recálculos

### 4.1 Totais do universo

| Verificação | Comparações | Divergências | Observação |
| --- | --- | --- | --- |
| Despesa DCA (26 capitais x 5 anos) contra as sementes | 130 | 0 | `recalculo_geral.csv` |
| Despesa DCA contra a **API ao vivo do Siconfi** | 130 | 0 | `dca_siconfi_api_130.csv` |
| População contra o **SIDRA ao vivo** (tabelas 6579 e 4714) | 130 | 0 | 2023 comparada com o Censo 2022 (igual); relação do DOU não verificada |
| Despesa real de 2025 | 130 | 37 de até R$ 0,88 em R$ 23,45 bi | Fator IPCA publicado com 10 casas; imaterial |
| Despesa por habitante, nominal e real | 260 | 0 (máximo 5,5e-7 R$) | |
| Matrículas totais e por etapa e conveniadas (sementes) | 1.040 + 130 | 0 | Partição própria, `profissional` = total menos soma |
| Subfunções somam o total da função | 130 | 0 | Inclui a linha "FU12, demais subfunções" |
| ATU e aprovação contra as sementes | 780 | 0 | 24 "não aplicável" e 2 "não divulgado" coerentes |
| Ideb contra as sementes (26 capitais x 11 edições x 2 etapas) | 572 | 0 | inclui os códigos de não divulgação |
| Elegibilidade (DCA x RREO x MSC) reimplementada | 130 | 0 | 125 confere, 3 diferença menor, 1 reconciliada, 1 perímetro distinto |
| Razão por matrícula (sementes, minha lógica) | 127 | 0 | 123 publicadas, 4 sem fechamento |
| Razão por matrícula, numerador na **API ao vivo da MSC** | 6 | 0 | Ao centavo, `msc_live.py` |
| Ideb anos iniciais contra o **arquivo original do INEP** | 286 | 0 | sha256 igual ao manifesto |
| ATU e aprovação 2025 contra os originais do INEP | 152 | 0 | |
| Matrículas totais contra a **Sinopse do INEP** 2024 e 2025 | 52 | 0 | |
| Referências nacionais (ATU e Ideb de 2025) contra os originais | 6 | 0 | 14,9; 18,2; 22,0; 25,1; 6,1; 4,9 |
| Referência nacional calculada pelo OBEE (CSV) | 3 estatísticas | 0 | mediana 2.125,30; média 2.281,00; razão 1.720,13 |
| Reconstrução da gold pelo pipeline | 9.137 observações e 15 CSV | 0 | só `meta.proveniencia.git` difere |

Tolerâncias: R$ 0,005 nas despesas nominais e R$ 0,02 nas reais; uma matrícula; 1e-9 nos índices.

### 4.2 Exibido no navegador contra recalculado (amostra)

Recalculado pela minha lógica a partir das sementes. A diferença é o arredondamento da exibição; nenhuma passa disso.

| Capital | Ano | Medida | Exibido | Recalculado | Diferença |
| --- | --- | --- | --- | --- | --- |
| São Paulo | 2024 | Despesa total nominal | R$ 22,33 bilhões | 22.334.221.416,70 | arredondamento |
| São Paulo | 2024 | Por habitante nominal | R$ 1.878 | 1.877,52 | −0,48 |
| São Paulo | 2024 | Por habitante real | R$ 1.972 | 1.971,71 | +0,29 |
| São Paulo | 2024 | Por matrícula nominal | R$ 22.038 | 22.038,18 | −0,18 |
| São Paulo | 2024 | Por matrícula real | R$ 23.144 | 23.143,78 | +0,22 |
| Porto Alegre | 2021 | Despesa total real | R$ 842,5 milhões | 842.507.625,53 | arredondamento |
| Porto Alegre | 2021 | Por habitante nominal | R$ 451 | 450,59 | +0,41 |
| Porto Alegre | 2021 | Por matrícula nominal | R$ 9.322 | 9.321,65 | +0,35 |
| Campo Grande | 2021 | Por habitante nominal | R$ 1.125 (fora da comparação) | 1.125,42 | −0,42 |
| Campo Grande | 2021 | Por matrícula | sem valor | sem valor (MSC 12,05% abaixo da DCA, intraorçamentária dentro da função) | n/a |
| Boa Vista | 2024 | Despesa total nominal | R$ 658,1 milhões | 658.077.936,34 | arredondamento |
| Boa Vista | 2024 | Por habitante nominal | R$ 1.400 | 1.399,66 | +0,34 |
| Boa Vista | 2024 | Por matrícula nominal | R$ 12.709 | 12.709,03 | −0,03 |
| Recife | 2025 | Por habitante | R$ 1.172 | 1.172,21 | −0,21 |
| Recife | 2025 | Por matrícula | R$ 18.590 | 18.589,61 | +0,39 |
| Natal | 2025 | Por matrícula | R$ 11.601 | 11.600,58 | +0,42 |
| Rio de Janeiro | 2024 | Por habitante nominal | R$ 1.034 | 1.033,69 | +0,31 |
| Rio de Janeiro | 2024 | Por matrícula nominal | R$ 10.723 | 10.722,85 | +0,15 |

Estatísticas do grupo (exibidas na caixa de referências ou no capítulo; recalculadas por mim):

| Recorte | Estatística | Exibido | Recalculado |
| --- | --- | --- | --- |
| Por habitante 2024, n = 26 | Mediana; média simples | R$ 1.104; R$ 1.157 | 1.104,17; 1.157,39 |
| | Menor; maior | R$ 617 Belém; R$ 2.196 Vitória | 616,97; 2.196,21 |
| | Quartis (tipo 7) | R$ 908 a R$ 1.308 | 908,16; 1.307,80 |
| | Razão agregada; denominadores | R$ 1.282; 46.192.631 | 1.282,03; 46.192.631 |
| Por habitante 2021, n = 25 | Mediana; razão agregada | R$ 625; R$ 754 | 624,57; 753,86 (Campo Grande fora) |
| Por matrícula 2025, n = 26 | Mediana; razão agregada | R$ 14.254; R$ 16.211 | 14.253,57; 16.211,28 |
| ATU anos iniciais 2025, n = 26 | Mediana; média; menor; maior | 25,0; 25,1; 20,5 Recife; 29,5 São Paulo | 25,0; 25,09; 20,5; 29,5 |
| Ideb anos iniciais 2025, n = 26 | Mediana; menor; maior | 6,1; 4,8 Natal; 6,9 Curitiba e Teresina | 6,05; 4,8; 6,9 (empate) |
| Aprovação anos finais 2023, n = 23 | Mediana; menor; maior | 96,8%; 72,8% Natal; 99,6% Cuiabá e Curitiba | 96,8; 72,8; 99,6 |

Números exibidos nas 638 telas verificadas: 100% iguais ao recálculo no valor; 95 de 415 frases "registra X; a mediana é Y (Z acima)" mostram Z que difere em uma unidade da subtração dos valores exibidos (Z é calculado dos valores sem arredondar), ver P12.

## 5. Consistência entre apresentações

Resultado dos testes de consistência (gráfico, tabela, resumo, frase factual, referências, CSV):

* **Mesmo conjunto elegível em todas as apresentações**: sim. Em Campo Grande 2021 (fora por perímetro), Natal 2022 e 2023, Rio de Janeiro 2021 e São Luís 2022 e 2023 (sem razão por matrícula) a capital sai do gráfico, da mediana, da média, dos quartis, da razão agregada, da frase de cobertura ("25 das 26"), da tabela ("Fora da comparação") e do CSV (`incluida_na_comparacao = nao`, `elegivel_comparacao = nao`), com motivo. O valor oficial permanece visível e rotulado "Ressalva: fora das comparações".
* **Ausência contra zero**: todas as linhas `NAO_APLICAVEL` (24 no Ideb, 12 em ATU e em aprovação) e `NAO_DIVULGADO` aparecem como "sem valor" no DOM e vazias no CSV (nenhuma linha com estado diferente de observado tem valor, nos 13 CSV de séries que têm coluna de estado). Zero só aparece quando a fonte traz zero (Macapá e Rio Branco sem anos finais, 8 capitais sem conveniadas).
* **CSV contra a tela**: em 60 CSV de Gastos, mediana, média, mínimo, máximo, quartis, razão agregada, n e a lista de 26 capitais coincidem com a tela. `valor_numerico` do CSV do site usa 12 algarismos significativos (diferença máxima R$ 0,05 em 1.540 linhas), a série pública guarda a precisão original.
* **Quebra de série**: para uma capital selecionada, a evolução de despesa por habitante 2021 a 2025 é bloqueada com a explicação ("a população de referência muda de base"). Para a mediana sem capital, não (P2). 2023 é marcado como quebra, embora tenha a mesma população de 2022.
* **Ano sem dado e parâmetros inválidos**: `ano=2030` mostra 2025; `ano=1999` mostra 2021; `ano=abc`, `cap=atlantis`, `med=xyz`, `moeda=euro`, `vis=xx` voltam aos padrões; `med=ideb` em `/gastos` ignora e mostra despesa por habitante; etapa inválida para a medida cai na etapa do tema. O seletor mostra o valor efetivo, mas nenhuma mensagem explica a troca e a URL mantém o parâmetro inválido (P18).
* **Ideb em ano par**: `ano=2024` abre a edição 2023, o seletor e o título dizem "edição 2023"; na tabela comparativa as colunas Ideb e Saeb ficam vazias em ano par (P6).

## 6. Achados metodológicos

1. **Perímetro**. O numerador da despesa é a função 12 da DCA, exceto intraorçamentárias, para todas as capitais. A regra é uniforme, mas o peso das intraorçamentárias (contribuição patronal ao regime próprio de previdência, por exemplo) não é: pelo RREO de 2024 vai de 3,1% da função em Macapá a 35,9% em Porto Alegre (Rio de Janeiro 29,2%; Aracaju 18,4%; São Paulo 14,5%). Somando a parcela intraorçamentária do RREO, Porto Alegre sai da 24ª para a 16ª posição em despesa por habitante e o Rio de Janeiro da 15ª para a 8ª. A mediana das capitais passa de R$ 1.104 para R$ 1.212. O texto avisa do critério somente na ficha e no glossário.
2. **Rede municipal contra orçamento do município**. Os subtítulos de total e por habitante dizem "capitais estaduais, rede municipal". O numerador inclui transferências a instituições privadas (0,1% a 34,6% do total em 2025), inativos, ensino superior e administração geral. A ficha e o card ("Não é gasto por aluno") corrigem a leitura, mas o rótulo ao lado do número contradiz a distinção exigida pela rubrica.
3. **Gasto por matrícula**. Numerador e denominador consistentes: aplicação direta (90, 93, 94) sem subfunção 364 e sem inativos, dividida pelo `QT_MAT_BAS` das escolas municipais, sem conveniadas no denominador nem as transferências que as financiam no numerador. Está rotulada "razão orçamentária, não custo do aluno" e publicada em 123 de 130 pares, com motivo para os 7 restantes. Não há denominador inadequado.
4. **Estágio e preços**. Liquidado, declarado em toda a interface. IPCA, média anual do número-índice, base 2025. A população não é deflacionada. A conferência DCA x RREO x MSC é a mais cuidadosa que encontrei neste tipo de painel; o caso Boa Vista 2024 (RREO R$ 122,5 milhões contra DCA e MSC R$ 658,1 milhões) é mantido, com ressalva, por reconciliação com a MSC.
5. **População**. 2021 (estimativa de base 2010), 2022 e 2023 (mesmo número do Censo 2022), 2024 e 2025 (estimativas pós Censo). A despesa por habitante de 2023 não acompanha o crescimento populacional, o que a ficha diz. O tratamento de quebra é correto para uma capital e ausente para a mediana (P2).
6. **Periodicidades**. Despesa anual, Censo Escolar de maio, Ideb bienal. Nenhuma tela alinha artificialmente um ano de gasto a um resultado: na família de resultados cada cartão mostra o seu ano ou a sua edição. O texto do Panorama ("A leitura conjunta não demonstra causalidade") e o da página Métodos estão adequados.
7. **Linguagem**. Varredura do texto de 765 telas: nenhuma palavra de julgamento ("melhor", "pior", "eficiente"), nenhuma atribuição causal; as ocorrências são avisos de que menor gasto não demonstra eficiência.
8. **Referências**. Nacionais do mesmo universo (INEP) com diferença; nacional de outro universo e calculado pelo OBEE sem confundir com a distribuição das capitais; internacionais (OCDE) só como contexto, com o ano diferente avisado ("Outro ano: dado da OCDE de 2023; o painel mostra 2025"). Não encontrei comparação internacional enganosa. A mediana nacional da despesa por habitante (R$ 2.125) é maior que a das capitais (R$ 1.160); a tela diz que o universo é outro.
9. **Elegibilidade (código)**. `conferencia.py` é determinística, versionada, grava os sha256 das três fontes e reimplementada por mim com resultado idêntico. Fragilidades: limiar de 0,1% da DCA é R$ 22 milhões em São Paulo; o empate usa igualdade exata de ponto flutuante (sem efeito observado); o limiar de 8 valores para exibir quartis é uma convenção declarada.

## 7. Rastreabilidade e reprodução (tarefas 7 e 8)

Indicadores reconstruídos a partir da documentação e dos arquivos:

| Indicador | Caminho seguido | Resultado | Onde travou |
| --- | --- | --- | --- |
| Despesa por habitante (Recife 2024) | Ficha → API do Siconfi (a trilha traz a URL exata) → conta "12 - Educação", coluna liquidada → SIDRA 6579 → divisão | R$ 1.756.409.214,12 ÷ 1.587.707 = R$ 1.106,26, igual ao valor da gold (a tela arredonda para R$ 1.106) | Nada. O ponto "ano de população" exige ler a ficha |
| Ideb anos iniciais (Aracaju 2025) | Trilha: URL do zip, sha256, linha, P = 0,983928, N = 5,857913, N x P = 5,7638 | Arquivo baixado, sha256 `89100286…` igual, Ideb publicado 5,8, igual ao valor da gold | Cadeia TLS do INEP incompleta (documentada em `ARQUITETURA.md`, não na página) |
| Matrículas totais (26 capitais, 2024 e 2025) | Ficha → Sinopse Estatística tabela 1.2, coluna municipal | 52 de 52 iguais | Microdados por etapa e conveniadas (pacote de centenas de MB) não baixados |
| Razão por matrícula (6 pares) | Ficha e ponte → API da MSC → regra de modalidade, subfunção e elemento | Numerador igual ao centavo | A regra completa só fica clara juntando ficha, glossário e página Métodos |
| Despesa por habitante nacional (OBEE) | CSV público | Estatísticas refeitas, 0 erro de divisão | Não verificado município a município na API |

Exportações: o CSV tem cabeçalho legível, uma linha por observação, unidade, base monetária, universo, estado, elegibilidade, conferência, nota, fonte, registro, versão metodológica, data e hash. Ficam fora do arquivo: dicionário de colunas, texto de ressalva geral, citação e licença. Os nomes de arquivo do site não distinguem nominal de real (`obee_gastos_despesa_hab_2024.csv` nos dois) nem matemática de português no Saeb.

Versão e histórico: a página mostra "catálogo de 08/10/2026, revisão 4", o código gerador e os hashes. O histórico de revisões (1.0 a 1.3) existe só em `catalogo_indicadores.json` e nos documentos do repositório; não vai à gold nem à página. As versões por indicador divergem entre si (CSV com 1.1, 1.2; metodologia 1.3; ficha da despesa total cita "política 1.1" e a política vigente é 1.2; a tabela comparativa grava `"1.2"` no código).

Regeneração: `gold.constroi()` com o seed do repositório devolve as mesmas 9.137 observações, o mesmo hash e os 15 CSV byte a byte. A gold publicada registra `commit_de_partida 5c5a39e` com mudança não commitada; a identificação do código se faz por hash de conteúdo, não por commit.

## 8. Desempenho (protocolo declarado)

Protocolo: Chromium headless no container, servidor local, cinco cargas por rota com contexto limpo, mediana; observadores de `paint`, `largest-contentful-paint`, `layout-shift` e `longtask`; "h1 visível" medido do início da navegação. Perfil B: CPU 4x e rede de 9 Mbps de descida, 1,5 Mbps de subida e 170 ms de latência.

| Rota | LCP A (ms) | h1 visível A (ms) | CLS A | LCP B (ms) | h1 visível B (ms) | TBT B (ms) | HTML (KB, decodificado) | HTML gzip (KB) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Panorama | 176 | 278 | 0,0004 | 956 | 1.456 | 409 | 165 | 30 |
| Gastos | 284 | 387 | 0 | 900 | 1.559 | 458 | 398 | 79 |
| Atendimento | 188 | 342 | 0 | 948 | 1.546 | 429 | 383 | não medido |
| Resultados | 168 | 349 | 0 | 892 | 1.563 | 462 | 371 | não medido |
| Comparar | 200 | 377 | 0 | 816 | 1.660 | 536 | 616 | 108 |
| Comparar (tabela) | 168 | 403 | 0,0028 | 816 | 1.645 | 653 | 616 | 108 |
| Dados e métodos | 256 | 410 | 0 | 1.072 | 1.607 | 537 | 706 | 93 |
| Gastos, São Paulo, ponte | 180 | 337 | 0,0113 | 984 | 1.603 | 491 | 398 | 79 |

JavaScript: cerca de 487 KB decodificados (primeira visita), CSS 53 KB, fontes 222 KB, 33 requisições. A gold (6,7 MB; 0,30 MB com gzip) não é carregada pelas páginas: só no clique de download. Na primeira visita a página de tema faz prefetch das demais (5 respostas RSC de 49 a 100 KB gzip cada). CLS em 320, 390, 768 e 1440 px: máximo 0,009; sem rolagem horizontal da página em nenhuma largura testada.

Erros de console e de rede: único erro em todas as rotas é `GET /favicon.ico` 404 (também em produção); as requisições `?_rsc=` canceladas ao navegar são prefetch abortado e não são erro. Os 772 carregamentos não geraram exceções de página.

Testes: vitest dos cinco arquivos `obee-*.test.ts` (126 testes) e suíte completa (140 arquivos, 2.634 testes, 1 ignorado: o gate de HTML sem `EXIGIR_BUILD_HTML`) passam. `unittest` do pipeline (97 testes) passa em 66 s. O CI roda os dois conjuntos e o build. A reprovação de uma validação impede a promoção da gold para `public/` (`gold.promove`, com teste). Riscos sem teste: (a) texto e números reais do DOM; (b) a evolução da mediana sem capital; (c) a ordem dos empatados entre título e caixa de referências; (d) o rótulo do CSV da tabela comparativa em ano par; (e) o formato de centavos acima de R$ 10 bilhões.

## 9. Problemas priorizados

### Alta (bloqueios confirmados)

**P1. Perímetro das intraorçamentárias não acompanha o número e pesa de 3% a 36%.**
* Passos: abrir `/gastos?ano=2024&med=despesa_hab&cap=porto-alegre`. A frase diz "A despesa em Educação por habitante vai de R$ 617 em Belém (PA) a R$ 2.196 em Vitória (ES)" e a capital aparece em R$ 733. O aviso "exceto intraorçamentárias" só está em "Sobre este dado", no glossário e no detalhe do cálculo nacional.
* Valor exibido: R$ 733 (Porto Alegre, 2024). Recalculado com a parcela intraorçamentária do RREO somada: R$ 1.143 (posição 16 em vez de 24); Rio de Janeiro: R$ 1.034 contra R$ 1.460 (posição 8 em vez de 15). Arquivo `efeito_intraorcamentarias_despesa_hab.csv`.
* Efeito: comparação entre capitais com perímetros heterogêneos sem ressalva essencial junto do número (também afeta o total e a razão por matrícula).
* Correção: acrescentar "exceto intraorçamentárias" ao nome do indicador e à frase, mostrar a parcela intraorçamentária de cada capital (já está em `conferencia.rreo.intra`) na tabela e no CSV, e avisar na caixa de referências que as capitais diferem nesse perímetro; considerar uma visão de sensibilidade.

**P2. Evolução da mediana por habitante cruza a quebra de população sem bloqueio.**
* Passos: `/gastos?med=despesa_hab&vis=evolucao` sem capital. Exibido: "Na mediana das capitais, a despesa em Educação por habitante passou de R$ 625 em 2021 para R$ 1.160 em 2025." Com uma capital (por exemplo São Paulo), o mesmo recorte é bloqueado: "Entre 2021 e 2025 a população de referência muda de base … não são diretamente comparáveis".
* Causa: `ExploradorTema.tsx:166` monta os pontos da mediana com `quebraSerie` falso; a série da mediana também troca de n (25 em 2021, 26 depois).
* Correção: propagar a quebra de série para a linha da mediana (e para a linha tracejada de referência no modo capital), ou bloquear a frase.

### Média

**P3. Rótulo "rede municipal" em medidas do orçamento do município.** Subtítulo de total e por habitante em Gastos (`ExploradorTema.tsx:126`), Comparar (`ComparadorCapitais.tsx:100`) e cabeçalho do Panorama. Trocar por "orçamento do município, função Educação" nessas medidas; manter "rede municipal" nas matrículas, ATU, aprovação, Ideb e Saeb.

**P4. Comparar, visão Gráfico, sem ficha, sem CSV, sem ressalva material e sem referência externa.** `/comparar?med=despesa_hab&ano=2021` não tem "Sobre este dado" nem botão de CSV (só na visão Tabela) e a nota material da população de 2021 não aparece. Levar ficha, ressalvas e referências nacionais ao Gráfico.

**P5. Só existe o grupo das 26 capitais.** A metodologia descreve grupo regional; a interface não o oferece. Capitais de porte e regime previdenciário muito distintos (São Paulo contra Rio Branco) dividem a mesma mediana. Oferecer grupos de pares com critério explícito (região já calculada; porte) ou retirar a promessa da metodologia.

**P6. Ano par na tabela comparativa.** A página diz "Ideb e Saeb usam a edição 2023 (não há edição 2024; as colunas ficam sem valor)" e as colunas ficam vazias; o CSV traz o motivo "Fora do escopo da etapa" (`consulta.ts:959`), que é incorreto. Corrigir o texto e o motivo (por exemplo "Sem edição neste ano").

**P7. Versões e histórico.** Versões por indicador e global divergem (CSV 1.1 e 1.2; metodologia 1.3; ficha da despesa total cita política 1.1; `"1.2"` fixo em `consulta.ts:963`); o histórico de revisões não está na gold nem na página. Publicar uma linha do tempo de versões com a data e o resumo (já existe em `catalogo_indicadores.json`) e ler a versão do dado em vez de fixá-la.

**P8. Frases de evolução que terminam antes do fim da série.** Exemplos: Boa Vista, Ideb anos finais: "passou de 4,1 em 2005 para 4,5 em 2007" (2009 a 2025 sem divulgação); Macapá, Ideb anos finais: "de 3,1 em 2005 para 5,0 em 2017". A frase não diz que as edições posteriores não existem. Acrescentar "última edição com dado" e o motivo das lacunas, e a pandemia de 2021 nas frases que a atravessam.

**P9. Exportações sem dicionário e com nomes ambíguos.** Incluir dicionário de colunas e ressalvas gerais no próprio arquivo (ou um LEIAME baixável), moeda e disciplina no nome do arquivo (`obee_gastos_despesa_hab_2024_real.csv`), e citação sugerida.

**P10. Testes não cobrem o DOM nem o caso da evolução da mediana.** Os 126 testes do OBEE chamam funções; nenhum abre o navegador, baixa o CSV do botão e compara com a tela. Acrescentar teste de navegador sobre uma amostra (a minha lista de cenários em `scripts/` pode servir de base).

### Baixa

* **P11.** A ordem das capitais empatadas difere entre o título (alfabética) e a caixa "Maior valor" (ordem do código IBGE): `/resultados?cap=recife&med=ideb&etapa=anos_iniciais`, título "Curitiba (PR) e Teresina (PI)", caixa "Teresina (PI), Curitiba (PR)" (`referencias.py:78`). Ocorre em 88 dos 345 cenários de Atendimento e Resultados.
* **P12.** Em 95 de 415 frases de comparação, a diferença exibida difere em uma unidade da conta com os valores exibidos ("R$ 1.878 … mediana R$ 1.104 (R$ 773 acima)"). Calcular a diferença dos valores arredondados exibidos ou dizer que é calculada sem arredondar.
* **P13.** Centavos falsos acima de R$ 10 bilhões: "A soma … é igual ao total da função na DCA (R$ 23.584.096.338,00)" onde a DCA tem R$ 23.584.096.338,05 (compactação a 12 algarismos em `dados.ts:74`). Exibir sem centavos nesses casos ou manter a precisão.
* **P14.** O Censo 2022 aparece com referência em "1º de agosto de 2022" (tabela de fontes) e "31 de julho de 2022" (glossário, ficha e V14). Padronizar.
* **P15.** V18 diz "média simples dos 38 membros com dado"; a caixa de contexto mostra "38 países, dos quais 34 membros da OCDE".
* **P16.** `/favicon.ico` responde 404 em todas as páginas (console de erro, em produção também).
* **P17.** Prefetch das demais rotas na primeira visita (50 a 100 KB gzip cada); estado da URL aplicado depois da hidratação (CLS até 0,011).
* **P18.** Parâmetros inválidos são normalizados em silêncio e permanecem na URL e no link copiado.
* **P19.** Zero de rede sem a etapa (Macapá, Rio Branco nos anos finais) entra na mediana e vira "13.559 matrículas abaixo da mediana". Verdadeiro, mas sem contexto de oferta.
* **P20.** A gold registra `codigo_com_mudanca_nao_commitada: true`; o commit exato da geração não é recuperável (o hash de conteúdo do código basta para reproduzir).
* **P21.** A cadeia TLS do `download.inep.gov.br` está incompleta; um leitor que siga a trilha tropeça e a página não avisa (a nota está em `ARQUITETURA.md`).

## 10. Bloqueios de aprovação

**Confirmados**

| Bloqueio da rubrica | Onde | Evidência |
| --- | --- | --- |
| Ressalva essencial escondida; comparação sem o mesmo perímetro | Panorama, Gastos, Comparar (despesa total, por habitante e por matrícula) | P1: intraorçamentárias de 3% a 36% da função, aviso só na ficha |
| Afirmação sem suporte da própria regra | Gastos, Evolução da mediana por habitante | P2: "passou de R$ 625 em 2021 para R$ 1.160 em 2025" |

**Descartados após teste**

| Bloqueio | Teste | Resultado |
| --- | --- | --- |
| Valores incorretos | 3.302 recálculos e conferência com Siconfi (130), IBGE (130), INEP (438 valores e 6 referências nacionais), Sinopse (52), MSC ao vivo (6) | Nenhuma diferença material |
| Denominador inadequado na razão por matrícula | Regra refeita; conveniadas fora do denominador e as transferências que as financiam fora do numerador | Consistente; rotulada "não é custo do aluno" |
| Ausência tratada como zero | 15 CSV e DOM | Nenhum valor em linha sem estado observado |
| Exclusão aplicada ao gráfico e não ao resumo ou CSV | Campo Grande 2021, Natal 2022 e 2023, Rio 2021, São Luís 2022 e 2023 | Mesma regra em gráfico, mediana, tabela, frase e CSV |
| Julgamento de eficiência ou causalidade | Varredura de texto de 765 telas | Nenhum; só avisos |
| Comparação internacional enganosa | Blocos da OCDE | Contexto separado, ano diferente avisado |
| Perda funcional ou barreira a tarefa essencial | Tarefas 1 a 8 | Todas executáveis (seção 11) |

## 11. Testes orientados a tarefas (inspeção heurística, sem participantes)

1. Gasto por habitante e por matrícula de uma capital: sucesso em duas ações (Gastos, escolher a capital; os três cartões mostram valor e mediana).
2. Comparar com um grupo elegível e identificar a referência: sucesso (mediana, média, quartis, n, "26 de 26"); sem grupo alternativo.
3. Mudança em reais constantes: sucesso para despesa total e por matrícula; a por habitante entre 2021 e 2025 é bloqueada com explicação para uma capital e não para a mediana (P2).
4. Por que uma observação foi excluída: sucesso, o motivo está na lista "capital fora desta comparação" e na ressalva.
5. Distinguir rede municipal, função Educação e população: parcial; o rótulo "rede municipal" do subtítulo atrapalha (P3), a ficha esclarece.
6. Atendimento e resultado sem confundir períodos: sucesso; ano de Censo, ano letivo e edição aparecem rotulados.
7. Exportar o recorte e reconhecer limitações: sucesso no CSV; sem dicionário nem aviso geral no arquivo (P9).
8. Reproduzir um indicador pela documentação: sucesso para despesa, população, Ideb, matrículas totais e numerador por matrícula; obstáculos P21 e tamanho dos microdados.

## 12. Limitações e itens não verificados

* Não verificados contra os originais: matrículas por etapa e conveniadas (microdados do Censo), ATU e aprovação de 2021 a 2024, Ideb dos anos finais, Saeb, população de 2023 pela relação do DOU, RREO (usado só via sementes), dados da OCDE, investimento por estudante do INEP, referência nacional por município. O que está em "conferido" acima foi conferido; o resto depende da integridade das sementes, que o próprio pipeline controla por sha256 e MD5.
* Verificação de desempenho em laboratório, Chromium headless único; sem Firefox, Safari ou dispositivos reais.
* Não avaliei acessibilidade, leitor de tela, contraste nem hierarquia visual (critérios de outro avaliador).
* A estimativa de que o peso das intraorçamentárias vem de contribuições patronais ao regime próprio é a descrição da própria ficha e do glossário; não abri a MSC para decompor a modalidade 91 em cada capital.
* A comparação "com a parcela intraorçamentária" usa o RREO (liquidado até o 6º bimestre), não a DCA, que apresenta as intraorçamentárias só em total.
* O verificador em ponto flutuante gera falsos alarmes em terceiros quartis que caem num meio exato (33,35 exibido como 33,4); ignorados e anotados em `cenarios_navegador.csv`.

## 13. Arquivos de evidência

`docs/obee/avaliacao/rodada-1/evidencias/dados/`: `recalculo_geral.csv` (3.302 comparações), `dca_siconfi_api_130.csv`, `populacao_sidra_130.csv`, `exibido_vs_recalculado.csv`, `efeito_intraorcamentarias_despesa_hab.csv`, `cenarios_navegador.csv` (638 cenários verificados item a item), `desempenho_laboratorio.csv`, `fontes_originais_e_testes.txt`, `scripts/` (recálculo, verificação do DOM, desempenho).
