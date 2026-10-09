# Saúde nas capitais: escopo, decisões e fontes

Módulo do Observatório Brasileiro de Eficiência Estatal (OBEE). Rota `/eficiencia-estatal/saude-capitais`. Base do trabalho: `main` em `58945b5ca` (merge do PR 124, avaliação independente de Educação), mais o commit `faa4e1e6f` (skill `observatorio-layout`) que abre a branch `claude/determined-knuth-21z58z`. Data de início: 09/10/2026.

## 1. Pergunta e o que o módulo não faz

Quanto as 26 capitais estaduais executam em Saúde, que estrutura e atendimento de atenção primária o cadastro oficial registra e que resultados são observados entre seus moradores?

O módulo mostra valores, séries, distribuições, composições que reconciliam, definições, fontes e limitações. Não cria nota de eficiência, classificação de gestão, semáforo, fronteira estatística (DEA ou SFA), estimativa de perda ou recomendação de corte. Gasto maior ou menor não é lido como melhor ou pior. Resultado de saúde não é apresentado como efeito exclusivo da gestão municipal. Ordenar por valor é recurso de leitura.

## 2. Três perímetros que nunca se misturam

| Perímetro | O que entra | Medidas do módulo | O que não é |
| --- | --- | --- | --- |
| Recursos executados pelo município | Despesa liquidada na função 10 (DCA), composição por subfunção e por natureza, percentual aplicado em ASPS (SIOPS) | Despesa total (nominal e em reais de 2025), por habitante, subfunções, natureza, ASPS | Não é o gasto total em saúde no território: União, estado e setor privado ficam fora |
| Serviços localizados no território | Unidades básicas de saúde (CNES), equipes e cobertura potencial da APS (Relatório APS) | UBS públicas, UBS por 10 mil habitantes, equipes por 10 mil, cobertura potencial | Estabelecimento situado no município não é, necessariamente, de gestão ou propriedade municipal. Cadastro não comprova funcionamento nem acesso |
| População residente | Denominadores (IBGE) e internações por município de residência (RIPSA, SIH) | População, ICSAP em número, taxa por 100 mil habitantes e participação nas internações SUS, cobertura de planos privados | Não é produção da prefeitura nem efeito exclusivo da gestão municipal. Internação não é doença, e a taxa depende de oferta de leitos, critérios e registro |

## 3. Decisões de escopo

| # | Decisão | Fundamento |
| --- | --- | --- |
| D1 | 26 capitais estaduais. Distrito Federal fora, com motivo visível no Panorama e em Dados e métodos | O DF não tem prefeitura; a saúde distrital reúne competências de estado e de município. Inclusão exige tratamento próprio (decisão P3 do OBEE, mantida) |
| D2 | Série financeira de 2021 a 2025; resultados de 2021 a 2024 | A DCA de 2025 está disponível; o SIH por residência de 2025 é provisório e fica fora. Anos anteriores a 2021 não foram coletados (expansão registrada em CONTINUIDADE.md) |
| D3 | Núcleo financeiro: despesa total, por habitante, por subfunção, por natureza onde reconcilia, ASPS | Perguntas centrais de quem consulta gasto em Saúde. Natureza só onde a soma das categorias reproduz a DCA (116 de 130 pares) |
| D4 | Estrutura de APS: UBS ativas, equipes, cobertura oficial. Capacidade de pessoal só com rótulo fiel | Profissionais e carga horária do CNES exigiriam cerca de 160 mil chamadas por competência à API e trazem dado pessoal; não publicados |
| D5 | Atendimento e resultados: ICSAP por município de residência. Produção da APS não publicada | Produção ambulatorial (Siaps e Sisab) sem série municipal verificável e extraível com a nota de rigor exigida; entrega parcial declarada |
| D6 | Não existe razão despesa por atendimento, consulta ou internação | O numerador (despesa do município) e o denominador (produção de todos os financiadores) têm perímetros diferentes; indicador `sau.despesa.por_atendimento` avaliado e não publicado |
| D7 | Referências: história própria, distribuição das capitais, razão agregada, grupos descritivos (todas, região) e mínimo legal de 15% | Referência nacional e internacional só com conceito verificado: Brasil para cobertura potencial (dezembro de 2021 a 2025) e ICSAP, com e sem as capitais, calculados do mesmo arquivo; contexto internacional não obtido (F13) |
| D8 | Namespace próprio (`pipeline/eficiencia_saude`, `src/*/eficiencia/saude`, arquivos `saude_*` e `sau_*`), com componentes compartilhados | Educação permanece intacta; teste de isolamento confere os arquivos |
| D9 | `/eficiencia-estatal` passa a ser a entrada efetiva do observatório (Educação e Saúde); a antiga rota redirecionava para Educação | Entrada dedicada é pré condição para um segundo módulo |

## 4. Matriz de fontes (resumo)

A matriz completa, com acesso testado, cobertura, período, decisão e fundamento de cada uma das 31 linhas, está em [CATALOGO_COBERTURA_FORMULAS.md](./CATALOGO_COBERTURA_FORMULAS.md) e na página Dados e métodos do módulo. Resultado: 12 linhas para publicar com ressalva, 9 apenas como contexto e 10 não publicadas.

| Fonte | Conjunto | Uso | Captura |
| --- | --- | --- | --- |
| Tesouro Nacional, Siconfi | DCA Anexo I-E, RREO Anexo 02 (6º bimestre), MSC de dezembro da função 10 | Despesa liquidada, subfunções, natureza e conferência | 130 pares capital × exercício |
| Ministério da Saúde, SIOPS | RREO Anexo 12 e despesa por subfunção e fonte | Percentual e valor aplicado em ASPS; despesa por fonte (contexto) | 130 de 130 |
| Ministério da Saúde, CNES | Arquivo diário do OpenDataSUS (retrato) e histórico por estabelecimento (API) | UBS ativas (tipos 01 e 02) por natureza e gestão; série de dezembro de 2021 a 2025 | 4.365 linhas no retrato; 3.746 estabelecimentos no histórico |
| Ministério da Saúde, Relatório APS | Serviço de cobertura da APS | Equipes por tipo e cobertura potencial (Nota Técnica nº 2/2025) | 26 capitais e Brasil |
| Ministério da Saúde, RIPSA | MRB.4.02 (ICSAP), COB.2.01 (internações), COB.5.01 (planos) | ICSAP por residência, participação e contexto | 26 capitais, 2021 a 2024, e Brasil |
| IBGE | SIDRA 6579, 4714, relação da população de 2023 e IPCA | Denominadores e reais constantes | Reaproveitados do seed de Educação |

Cada captura tem URL, data, sha256 e, quando disponível, tamanho no manifesto `pipeline/eficiencia_saude/seed/manifesto.json` (cópia pública em `public/eficiencia/series/saude_manifesto_das_capturas.json`).

## 5. Perguntas que o módulo responde

1. Quanto a capital liquidou em Saúde no exercício, em reais correntes e em reais de 2025?
2. Quanto por habitante, e qual a posição numérica diante da mediana das capitais comparáveis?
3. Como a despesa se divide por subfunção e por natureza, e onde a abertura não reconcilia?
4. Que percentual da receita de impostos a capital informa aplicar em ASPS, ao lado do mínimo de 15% da LC 141/2012?
5. Quantas UBS públicas ativas e quantas equipes de APS existem por 10 mil habitantes, e qual a cobertura potencial estimada?
6. Qual a taxa de internações por condições sensíveis à atenção primária entre os moradores, por grupo de causa, e como ela se compara no tempo?
7. Por que uma observação ficou fora da comparação, e como reproduzi-la a partir da fonte?

## 6. Lacunas declaradas

| Lacuna | Situação |
| --- | --- |
| Produção da APS (atendimentos, procedimentos, consultas) | Não publicada: sem série municipal verificável e extraível. Entrega parcial declarada |
| Profissionais e carga horária | Não publicados: custo de coleta inviável por competência e dado pessoal |
| Despesa por atendimento | Não publicada por incompatibilidade de perímetro |
| Natureza da despesa em 14 de 130 pares | Sem abertura que reproduza a DCA; nenhuma categoria estimada |
| Despesa por fonte em Fortaleza e São Paulo, 2021 | Soma das fontes difere do total informado; não publicada |
| Cobertura potencial de dezembro de 2021 | Regra de cálculo anterior à Nota Técnica nº 2/2025; fora das comparações |
| Despesa de Campo Grande (2021) e Macapá (2025) | Valor oficial disponível, fora das comparações e das medianas (perímetro distinto e conferência pendente) |
| Contexto internacional | Não obtido (API do Banco Mundial instável durante a coleta); registrado em F13 |
| Revisão externa da metodologia | Não realizada |
