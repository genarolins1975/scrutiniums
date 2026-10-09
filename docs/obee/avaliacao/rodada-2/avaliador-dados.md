# Avaliação de dados e método, rodada 2: painéis de educação do OBEE

## 1. Identificação e natureza

* Avaliador: Avaliador de Dados e Método, agente independente da rodada 2, modelo Claude Sonnet 5.5 (claude-sonnet-5-5), contexto limpo, sessão de 09/10/2026.
* Critérios avaliados: E (indicadores, referências e comparabilidade), F (rigor metodológico), G (rastreabilidade e reprodutibilidade) e K (confiabilidade técnica e desempenho), nos seis painéis: Panorama, Gastos, Atendimento, Resultados, Comparar capitais e Dados e métodos. Os demais critérios são de outro avaliador.
* Natureza: inspeção técnica e recálculo independente por agente. Não é teste com usuários reais; nenhum participante, depoimento, tempo ou taxa de sucesso foi inventado. As notas são privadas e dizem respeito à qualidade dos painéis, não das administrações.
* Independência: da pasta `docs/obee/avaliacao/` li somente `RUBRICA.md`. Não li rodada-1, EXECUCAO.md nem depois/. Não executei `git log`, `git diff` nem `git show`. Não alterei nada em `src/`, `scripts/`, `public/`, `pipeline/`, `docs/` (fora desta pasta) nem em testes. Todos os recálculos usam código próprio (nenhum import de `pipeline/eficiencia`). A pasta de rascunho da sessão continha arquivos de sessões anteriores (por exemplo `gold_antes.json`, `inv*.json`, scripts de captura); não os abri nem os usei.
* Objeto avaliado: build em execução em `http://localhost:3100/eficiencia-estatal/educacao-municipal-capitais`; gold `public/eficiencia/gold/educacao_capitais.json` (versao_pipeline obee-0.2.0, catálogo 2026-10-09.1, versao_codigo gerador-c563a7572f97, gerado em 2026-10-09T05:55:59Z, dados capturados até 2026-10-08T20:41:34Z, hash_dados 326adb15ec058bd45a0dfe34ef281fe92c02015978641320e7aee317aa4f8608, 9.137 observações).

## 2. Resultado em uma linha

Os números exibidos estão corretos e rastreáveis (0 valores incorretos em mais de 38 mil conferências contra a gold e o seed, 260 conferências ao vivo no Siconfi e no SIDRA e reprodução exata de 123 numeradores por matrícula), nenhum bloqueio de aprovação foi confirmado, mas nenhum painel alcança 9,0 em todos os quatro critérios (menor nota: Comparar em K, 8,0), então pela regra de nota mínima 9,0 o conjunto não é aprovado nesta rodada.

## 3. Matriz de notas

Avaliador: Avaliador de Dados e Método (rodada 2). Notas de 0 a 10, uma casa decimal. "Evidência" aponta rota, estado e arquivo em `docs/obee/avaliacao/rodada-2/evidencias/dados/` (abreviado `ev/`) ou código em `src/`.

| Painel | Critério | Nota | Justificativa | Evidência | Correção necessária |
| --- | --- | --- | --- | --- | --- |
| Panorama | E | 8,6 | Mediana, média simples, extremos com empates, faixa central (quartis tipo 7) e número de capitais comparáveis conferem com o recálculo (por habitante 2025: mínimo R$ 702 Belém, mediana R$ 1.160, máximo R$ 2.362 Vitória, faixa R$ 960 a R$ 1.464, média R$ 1.243, 26 capitais). Referência nacional do mesmo universo (INEP, rede municipal do Brasil) para alunos por turma e Ideb, e contexto nacional do OBEE (5.060 municípios) rotulado como não diretamente comparável. Limita: extremos e mediana de despesa saem de perímetro não harmonizado (intraorçamentárias de 0,0% a 32,2% da função em 2025); a mediana do Ideb (6,05) aparece como 6,1, igual ao Brasil. | Rota `/` (estado padrão); `ev/comparacao_navegador_gold.csv`; `ev/intra_rreo_recalculo.csv`; `src/lib/eficiencia/panorama.ts` | Oferecer variante de sensibilidade da despesa que inclua a parcela intraorçamentária ou ao menos exibir ao lado dos extremos a parcela intra de cada um; exibir uma casa a mais quando a mediana e a referência nacional coincidem só por arredondamento |
| Panorama | F | 8,6 | Perímetro (função 12 exceto intra), estágio liquidado, preços correntes (nota "evolução em reais constantes está em Gastos") e escala logarítmica do total estão ditos junto do número. Valores por matrícula e por habitante conferidos. Limita: a ressalva de perímetro informa a heterogeneidade mas o gráfico não a corrige. | `/` aba Total e aba Por matrícula; `ev/reproducao_despesa_matricula.csv` | Mesma correção de perímetro; manter a nota de período por capítulo |
| Panorama | G | 8,5 | Cada capítulo tem "Fonte e critérios" e o rodapé oferece o JSON completo (6,7 MB, idêntico ao repositório). Não há CSV do recorte exibido e não há link do painel para o repositório nem para o manifesto de capturas. | `/` rodapé; hash do JSON servido igual ao arquivo (sha256 conferido, seção 9) | Link para repositório, manifesto e dicionário; CSV do recorte do capítulo |
| Panorama | K | 8,5 | Sem erro de console em 10 cargas frias do Panorama (5 por perfil; 80 cargas no protocolo inteiro); LCP de 204 ms no desktop e 1,26 s no móvel estrangulado; CLS de 0,033 no móvel estrangulado. O HTML inicial traz o recorte padrão mesmo com `?med=despesa_mat`; o recorte pedido só aparece após a hidratação. | `ev/perf.json`; `ev/capturas/deep_link_estado_padrao_antes_da_hidratacao_movel.png`; seção 10 | Renderizar no servidor o estado da URL (ou ocultar o conteúdo até a hidratação) |
| Gastos | E | 8,5 | 30 combinações medida × ano × moeda recalculadas: frase, mediana, média, extremos, quartis, razão agregada e tabela conferem (0 divergências). Razão agregada distinta da média simples, com N declarado. Referência nacional calculada pelo OBEE (mediana R$ 2.125, razão agregada R$ 1.720, 5.060 de 5.570 municípios) reproduzida e rotulada como outro universo. Limita: ranking por habitante e por matrícula sobre perímetro não harmonizado (intra de 0,0% a 41,4% da função nas capitais, 2021 a 2025); referência nacional só para 2025. | `/gastos` em 30 estados; `ev/comparacao_navegador_gold.csv`; `ev/intra_rreo_recalculo.csv`; `public/eficiencia/series/referencia_nacional_despesa_habitante_2025.csv` | Sensibilidade com intraorçamentárias; nacional para os demais exercícios ou razão registrada da impossibilidade |
| Gastos | F | 8,5 | Numerador e denominador conferem: por habitante recalculado (390 valores, diferença máxima R$ 0,88 em reais constantes por arredondamento), por matrícula reproduzido exatamente (123 de 123) a partir da regra publicada, ponte soma à DCA, conferência DCA, RREO e MSC refeita ao vivo (Campo Grande 2021, Boa Vista 2024). Zero e ausência separados. Quebra de população 2021 e 2023 sinalizada e variações bloqueadas. Limita: perímetro intra; beneficiário indeterminado de 2,0% a 27,6% do numerador em 2025 (declarado); a frase da evolução por habitante bloqueia 2021 a 2025 sem sugerir 2022 a 2025, que tem a mesma base. | `/gastos?med=despesa_mat&ano=2022`; `/gastos?med=despesa_hab&cap=recife&vis=evolucao`; `ev/reproducao_despesa_matricula.csv`; `ev/fontes_vivas.csv` | Variante harmonizada; frase de evolução que indique o intervalo comparável |
| Gastos | G | 8,8 | Trilha por indicador com URL da API, sha256 do recorte e valor; CSV do recorte com valor numérico e exibido, estado, elegibilidade, conferência, nota, versão, data e hash; dicionário de colunas; 9.137 linhas dos CSV estáticos iguais à gold; 430 arquivos do seed conferem com o manifesto. Limita: a trilha do indicador por matrícula não traz a consulta da MSC; os 12 CSV estáticos de indicadores em `series/` (32 colunas) não têm dicionário; sem link para o repositório. | `/metodos` Exemplos de reprodução; `ev/confere_series_csv.py`; `ev/downloads/gastos_despesa_mat_2022_nominal.csv`; `ev/reproduz_msc_ao_vivo.py` | Incluir URL da MSC e parâmetros na trilha; dicionário para os CSV estáticos; link do repositório |
| Gastos | K | 8,2 | 0 erros de console e 0 CLS nas interações (troca de medida, ano, moeda, visão, voltar); valores iguais ao alternar apresentações. Defeitos: link com recorte (`?med=despesa_mat&ano=2022`) mostra primeiro o recorte padrão (por habitante 2025) por 0,24 a 0,34 s no desktop e cerca de 3,1 a 3,4 s no móvel estrangulado; em 5 de 26 páginas por habitante 2025 a frase da capital escreve diferença que não fecha com os valores exibidos (por exemplo Fortaleza: "R$ 1.188 ... R$ 1.160 (R$ 29 acima)" e a tabela de Comparar diz +R$ 28). | `ev/playwright/flash.mjs` e `ev/capturas/gastos_frase_fortaleza_R29.png`, `comparar_tabela_fortaleza_R28.png`; `ev/comparacao_frase_capital.csv`; `src/lib/eficiencia/frases.ts` (função `fraseCapital`) | Usar `diferenca().texto` na frase da capital; renderizar o estado da URL no servidor; teste que cruze frase e tabela |
| Atendimento | E | 9,0 | 105 estados medida × ano × etapa recalculados (matrículas, conveniadas, alunos por turma) com 0 divergências em frase, referências, tabela e CSV. Referência nacional do mesmo universo (INEP, Brasil, rede municipal) com diferença descrita; contexto da OCDE separado e com ressalvas; empates listados; universo e N declarados. Limita: contagens absolutas dependem do tamanho da rede (declarado); sem cobertura sobre população em idade escolar (declarado em "O que este painel não mostra"). | `/atendimento` em 105 estados; `ev/comparacao_navegador_gold.csv` | Manter; considerar razão com a população em idade escolar quando houver fonte compatível |
| Atendimento | F | 9,0 | Matrículas recalculadas dos microdados (2.080 valores, 0 divergências) e conferidas com a Sinopse do INEP (130 pares, 0 divergências); campo vazio só vira zero com confirmação da Sinopse; conveniadas separadas e nunca somadas; ATU e aprovação reproduzidas sem recálculo; ND, hífen e etapa inexistente tratados como estados. | `ev/recalculo_gold.py` blocos R5, R7 e R9 | Manter |
| Atendimento | G | 8,8 | Trilhas com pacote do INEP (URL, sha256, MD5 conferido), coluna e valor; CSV do recorte com versão e hash. Limita: os pacotes do INEP não puderam ser baixados neste ambiente (falha de cadeia TLS, a mesma que o painel documenta), então a conferência contra a fonte é por integridade do seed e reconciliação interna; sem dicionário dos CSV estáticos; sem link do repositório. | `ev/recalculo_gold.py`; `ev/fontes_vivas.csv` (só Siconfi e SIDRA); `/metodos` Como reproduzir | Mesmas correções de G; registrar o procedimento de recomputar `hash_dados` |
| Atendimento | K | 8,6 | Sem erro de console; estados de URL inválidos (etapa fora do escopo, ano inexistente) caem em recorte válido sem quebra; mesma janela de recorte padrão antes da hidratação (item de Gastos); frases de capital conferem (0 divergências em 78 páginas). | `ev/playwright/robust.mjs`; `ev/comparacao_frase_capital.csv` | Estado de URL no servidor |
| Resultados | E | 9,0 | 49 estados (aprovação, Ideb, Saeb nas duas disciplinas) recalculados com 0 divergências; bienalidade tratada (ano par usa a edição anterior e diz isso); Brasil rede municipal do INEP como referência do mesmo universo; Ideb igual a N × P em 542 combinações; sem metas do Ideb. Limita: a mediana 6,05 exibida como 6,1 coincide com o Brasil só por arredondamento. | `/resultados?med=ideb&ano=2022&etapa=anos_finais`; `ev/comparacao_navegador_gold.csv` | Casa decimal adicional na comparação com o Brasil |
| Resultados | F | 9,0 | Ressalvas de leitura não causal visíveis; períodos próprios (ano letivo e edição) não alinhados ao gasto; "não divulgado" e "não aplicável" distinguidos com motivo (Boa Vista e Macapá sem matrícula na etapa em 2021, Porto Velho não divulgado); anotação de pandemia em 2021. | `/resultados?...ano=2021`; `ev/comparacao_navegador_gold.csv` | Manter |
| Resultados | G | 8,8 | Trilha com pacote, sha256 e colunas VL_INDICADOR_REND e VL_NOTA_MEDIA; N × P = 5,7638 e Ideb publicado 5,8 reproduzidos no exemplo. Limita: INEP não verificado contra a fonte neste ambiente; mesmas lacunas de dicionário e repositório. | `/metodos` Exemplos de reprodução | Mesmas correções de G |
| Resultados | K | 8,2 | Sem erro de console. Frase da capital divergente do cálculo sobre valores exibidos em 17 de 26 páginas do Saeb (por exemplo Aracaju: "245,33 ... 253,20 (7,86 pontos abaixo)", a conta dá 7,87) e em 3 de 26 do Ideb (Fortaleza: "5,9 ... 5,7 (0,3 ponto acima)"; a conta dá 0,2). Mesma janela de recorte padrão antes da hidratação. | `ev/comparacao_frase_capital.csv`; `src/lib/eficiencia/frases.ts` | Mesma correção de `fraseCapital`; teste de coerência frase e tabela |
| Comparar | E | 8,4 | Estatísticas, tabela completa (13.484 células em 54 estados, 0 divergências numéricas) e 7 CSV baixados conferem. Defeitos: a linha tracejada "Municípios do país R$ 2.125" no gráfico não diz que é mediana de 5.060 municípios de todos os portes nem que não é diretamente comparável (o aviso existe em Panorama e Gastos, não aqui); nas etapas creche e pré-escola as linhas de resumo (mediana, média, mínimo, máximo, cobertura) de Alunos por turma aparecem como "traço" embora as 26 capitais tenham valor. | `/comparar?med=despesa_hab&ano=2025`; `/comparar?...etapa=creche&vis=tabela`; `ev/capturas/comparar_tabela_creche_resumo_ausente.png`; `ev/comparacao_tabela_comparar.csv` | Qualificar o rótulo da referência e repetir o aviso; corrigir `sem = porEtapa && resultadoSemEscopo` em `TabelaComparativa.tsx` para considerar a coluna |
| Comparar | F | 8,4 | Uma regra de elegibilidade para gráfico, resumo, tabela e CSV (0 inconsistências). A tabela completa põe despesa, aprovação e Ideb do mesmo ano civil na mesma linha; os períodos estão nos cabeçalhos e o texto nega causa, mas em ano par Ideb e Saeb ficam em branco por construção e a leitura conjunta continua sendo por ano civil. Mesma limitação de perímetro. | `/comparar?...&ano=2022&vis=tabela` | Permitir escolher a edição do Ideb separada do exercício da despesa, com os dois períodos nomeados |
| Comparar | G | 8,8 | CSV da comparação (36 colunas) e da tabela completa (21 colunas) com versão, data, hash e fonte; dicionário cobre os três tipos exportados e traz "leia antes de usar" e "como citar". Limita: dicionário não cobre os CSV estáticos; sem link do repositório. | `ev/downloads/comparar_tabela_completa_2023.csv`; `ev/downloads/dicionario_colunas.csv`; `ev/confere_csv_baixados.py` | Mesmas correções de G |
| Comparar | K | 8,0 | Sem erro de console; valores preservados ao alternar. Defeito funcional do resumo (20 de 54 estados de tabela, todos creche e pré-escola); rótulo sem ressalva; janela de recorte padrão antes da hidratação; TBT de 632 a 895 ms no móvel com CPU 4x. | `ev/perf.json`; `ev/comparacao_tabela_comparar.csv` (20 linhas "DEFEITO") | Corrigir o resumo; reduzir hidratação |
| Dados e métodos | E | 9,2 | Matriz de referências aceitas, de contexto e rejeitadas, com fonte, universo, unidade, período, método, compatibilidade e decisão; média da OCDE recomputada (14 conjuntos, 0 diferenças); referência nacional reproduzida (mediana 2.125,30, média 2.281,00, razão agregada 1.720,13); cobertura e exclusões dos 5.570 municípios listadas por motivo. | `/metodos`; `ev/recalculo_gold.csv`; leitura de `referencias_internacionais` na gold | Manter; validação externa da matriz (hoje declarada como inexistente) |
| Dados e métodos | F | 9,1 | Fórmulas, estágios, deflator IPCA (fatores reproduzidos ao vivo no SIDRA 1737, diferença máxima 4e-11), quebra de população, tratamento de zero e ausência, definição descartada e fonte examinada e não adotada (SIOPE) documentadas, com ponte por parcela. Limita: texto de "quem está incluído" cita só modalidade 90 enquanto a fórmula usa 90, 93 e 94. | `/metodos` | Uniformizar a redação da modalidade |
| Dados e métodos | G | 9,0 | Cadeia de proveniência verificada ponta a ponta: hash do código gerador (28 arquivos) igual ao da gold, hash do manifesto igual, 430 arquivos do seed conferem com o manifesto, `hash_dados` recomputado igual, CSV e página com o mesmo hash e data, catálogo igual à gold campo a campo, reconstrução idempotente (teste unittest). Reproduzi indicadores pela documentação (seção 9). Limita: sem link do repositório na página, sem dicionário dos CSV estáticos, histórico de revisões com numeração e datas que não fecham com as versões das fichas (seção 8.6), trilha por matrícula sem URL da MSC. | `/metodos`; `ev/recalculo_gold.py`; `ev/logs/unittest_test_eficiencia.txt` | Fechar as lacunas listadas; sem elas a nota não sobe |
| Dados e métodos | K | 8,8 | Página estática de 96 KB transferidos (735 KB decodificados), 0 erros de console, CLS próximo de zero; no móvel estrangulado TBT de 902 ms e LCP de 1,49 s. Testes automatizados fortes na camada de dados (vitest 2.664 aprovados, unittest 41 aprovados) e ausentes na camada de apresentação (nenhum teste de navegador). | `ev/perf.json`; `ev/logs/` | Testes de navegador para estado de URL, resumo da tabela e coerência frase e tabela |

## 4. Exigências da rubrica por nota

Para cada nota: (1) evidência observável com rota, estado e arquivo, dada na coluna Evidência da matriz; (2) requisitos atendidos; (3) limitações remanescentes; (4) justificativa para não receber nota inferior; (5) identificação: Avaliador de Dados e Método, rodada 2, 09/10/2026. Nenhuma nota é 9,5 ou mais, portanto não se exige validação adicional; as notas de 9,0 a 9,2 estão sustentadas pelos recálculos independentes e pelas conferências ao vivo descritos nas seções 6 a 9. "Não verificado" (INEP, OCDE, arquivo do DOU de 2023, histórico git) não foi usado para elevar nota.

| Painel e critério | Requisitos atendidos | Limitações remanescentes | Por que não menos |
| --- | --- | --- | --- |
| Panorama E, 8,6 | Estatísticas, empates, N, referência do mesmo universo e contexto separado | Perímetro não harmonizado nos extremos; arredondamento da mediana do Ideb | Todos os valores conferem e as referências estão corretamente classificadas |
| Panorama F, 8,6 | Perímetro, estágio, preços e escala declarados junto do número | Não corrige a heterogeneidade | Nenhuma ressalva essencial escondida e nenhum valor incorreto |
| Panorama G, 8,5 | Fonte por capítulo, JSON completo idêntico ao repositório | Sem CSV do recorte, sem link do repositório | Hash, data e versão rastreáveis até a captura |
| Panorama K, 8,5 | Sem erros, LCP baixo, CLS baixo | Recorte da URL só após hidratação | Janela curta e sem valor incorreto rotulado como outro |
| Gastos E, 8,5 | Três escalas e razão agregada, referência nacional calculada e reproduzida | Perímetro e cobertura da referência nacional | 0 divergências em 30 estados |
| Gastos F, 8,5 | Numerador e denominador, liquidado, deflator, quebras, elegibilidade | Intraorçamentárias; beneficiário indeterminado | Reprodução exata e conferência ao vivo |
| Gastos G, 8,8 | Trilha, CSV, dicionário, hashes | Dicionário dos CSV estáticos; MSC sem URL na trilha | Reproduzi o indicador mais complexo ao vivo |
| Gastos K, 8,2 | Estabilidade e valores preservados | Janela de recorte padrão; frase da capital fora do arredondamento da tela | Diferenças de uma unidade na última casa, sem valor incorreto |
| Atendimento E, 9,0 | Referência do mesmo universo, empates, N, estados | Dependência do tamanho da rede (declarada) | Requisitos demonstrados em 105 estados |
| Atendimento F, 9,0 | Contagens reconciliadas com a Sinopse, vazio tratado, conveniadas à parte | Etapas e conveniadas só como contagem | Nenhum problema material encontrado |
| Atendimento G, 8,8 | Trilha e CSV completos | INEP não verificado na origem; dicionário; repositório | Integridade do seed e reconciliação interna comprovadas |
| Atendimento K, 8,6 | Sem erros, URL inválida tolerada | Janela de recorte padrão | Sem divergência de frase na amostra |
| Resultados E, 9,0 | Brasil rede municipal, bienalidade, N × P | Arredondamento da mediana | Requisitos demonstrados em 49 estados |
| Resultados F, 9,0 | Não causalidade, períodos próprios, estados | Nenhuma material | Nenhum problema material encontrado |
| Resultados G, 8,8 | Trilha com componentes P e N | INEP não verificado na origem | Reconciliação interna comprovada |
| Resultados K, 8,2 | Sem erros de console | Frase da capital com diferença fora da conta exibida em 20 de 78 páginas | Erro de uma unidade da última casa, não de valor |
| Comparar E, 8,4 | Tabela e CSV corretos | Rótulo "Municípios do país" sem ressalva; resumo ausente em creche e pré-escola | Nenhum valor incorreto em 13.484 células |
| Comparar F, 8,4 | Regra única de elegibilidade | Alinhamento por ano civil de gasto e resultado; perímetro | Ressalvas de período visíveis nos cabeçalhos |
| Comparar G, 8,8 | CSV com proveniência e dicionário | Dicionário dos estáticos; repositório | Exportação compreensível fora do site |
| Comparar K, 8,0 | Sem erros, valores preservados | Defeito de resumo; TBT alto no móvel; janela de recorte padrão | Defeito localizado em duas etapas |
| Métodos E, 9,2 | Matriz de referências e cobertura | Sem revisão externa | Recálculo independente de todas as referências |
| Métodos F, 9,1 | Fórmulas, deflator, quebras, decisões descartadas | Redação da modalidade | Reprodução exata |
| Métodos G, 9,0 | Cadeia de hashes verificada, reprodução bem sucedida | Lacunas listadas na seção 8.6 | Requisitos de G demonstrados, com lacunas não materiais |
| Métodos K, 8,8 | Leve, sem erros | TBT móvel; sem teste de navegador | Sem falhas funcionais encontradas |

## 5. Protocolo, amostra e ambiente

Ambiente: contêiner Linux (kernel 6.18), Node 22.22, Chromium 1194 headless via Playwright (`/opt/node-tools/node_modules`), build de produção Next.js em `localhost:3100` (resposta `x-nextjs-cache: HIT`), rede local. Python 3 com `-I` para todos os recálculos. Consulta ao vivo a Siconfi e ao SIDRA em 09/10/2026 por proxy autorizado; `download.inep.gov.br` falhou na verificação TLS (cadeia incompleta, "unable to get local issuer certificate"); a verificação não foi desligada.

Amostra (estratificada por indicador, ano, etapa, moeda, grupo, capital, recorte com exclusões e ano par de edições bienais):

| Camada | Escopo | Tamanho |
| --- | --- | --- |
| Gold e seed recalculados | 130 DCA, 130 população, 390 por habitante e real, 5 fatores IPCA, 2.080 matrículas (rede e conveniadas por etapa), 260 por matrícula, 3.640 INEP (ATU, aprovação, Ideb, P, N, Saeb), 130 pares da Sinopse, 1.530 referências estatísticas | 8.295 conferências (6.635 valores, 130 pares, 1.530 referências) |
| Fontes originais ao vivo | DCA 130, SIDRA 6579 e 4714 (104), identidade 2022 e 2023 (26), RREO 5 casos, MSC Aracaju 2025, IPCA 60 meses, 3 municípios da referência nacional, Boa Vista 2024 e Campo Grande 2021 | cerca de 160 consultas |
| Navegador contra gold, frases e referências | 184 páginas (gastos 30, atendimento 105, resultados 49) | 7.176 itens |
| Tabela de Comparar | 54 páginas (5 anos, 5 etapas, 2 moedas, Saeb em português) | 13.484 células |
| Evolução | 286 páginas (26 capitais, 11 recortes) | 286 frases |
| Frase da capital | 260 páginas (26 capitais, 10 recortes) | 260 frases |
| CSV baixados | 7 comparações, 1 série, 1 tabela completa, 1 dicionário; 15 CSV estáticos e o JSON servidos | 9.137 linhas estáticas |
| Robustez | 8 URLs inválidas, sem JavaScript, 69 links internos e externos, interações com voltar | n/a |

Protocolo de desempenho: 8 rotas, 2 perfis, 5 repetições por rota e perfil, contexto novo e cache desligado a cada repetição, mediana reportada. Perfil A: desktop 1440 × 900 sem estrangulamento. Perfil B: móvel 390 × 844, CPU 4x mais lenta, rede de 1,6 Mbps e 150 ms de latência. É medição de laboratório; experiência real de campo não foi medida.

## 6. Tabela de recálculos

Diferença é o valor absoluto entre o exibido (ou publicado) e o recalculado. "Tela" é o arredondamento da interface. Fonte e data de referência na coluna Fonte.

| Item | Exibido | Recalculado | Fonte e data | Diferença |
| --- | --- | --- | --- | --- |
| Despesa liquidada função 12, Aracaju 2025 | R$ 566.422.643,48 (gold); R$ 566,4 milhões na tela | R$ 566.422.643,48 | Siconfi DCA I-E, consulta ao vivo em 09/10/2026 | R$ 0,00 |
| Despesa função 12, 130 pares capital × exercício | gold | idem | Siconfi ao vivo e seed | 0 diferenças acima de R$ 0,01 |
| População Recife 2023 | 1.488.920 | 1.488.920 | SIDRA 4714 (Censo 2022), ao vivo 09/10/2026 | 0 |
| População 2021, 2024 e 2025 das 26 capitais | gold | SIDRA 6579 variável 9324 | ao vivo 09/10/2026 | 0 em 78 |
| Despesa por habitante Recife 2023 | R$ 995 | R$ 995,296 (1.481.916.260,53 ÷ 1.488.920) | Gold e DCA | 0,000 na gold; tela arredonda |
| Despesa total real Recife 2021 | R$ 1,12 bilhão | R$ 1.117.145.776,77 (nominal × 1,2527654899) | IPCA, SIDRA 1737 ao vivo | 0,00 |
| Fatores IPCA para 2025 (2021 a 2024) | 1,2527654899; 1,1463801919; 1,0960332175; 1,050167528 | mesmos a 10 casas | SIDRA 1737 variável 2266, ao vivo | menor que 4e-11 |
| Despesa por matrícula Aracaju 2022 | R$ 11.014 | R$ 11.014,23673 | Numerador MSC ÷ matrículas Censo 2022 | 0,00 |
| Numerador por matrícula Aracaju 2025 | R$ 561.863.001,98 | R$ 561.863.001,98 | MSC de dezembro de 2025 ao vivo, regra da página Métodos | R$ 0,00 |
| Numerador por matrícula, 123 pares | gold | idem | Seed da MSC, regra documentada | R$ 0,00 em 123 |
| Matrículas Aracaju 2025 | 33.933 | 33.933 | Microdados do Censo 2025 (seed) e Sinopse 2025 | 0 |
| Matrículas, 130 pares | gold | soma dos microdados e Sinopse | Seed INEP | 0 em 130 |
| ATU Aracaju 2025 anos iniciais | 23,3 | 23,3 | Seed INEP ATU 2025 (INEP não verificado na origem) | 0,0 |
| Aprovação Aracaju 2025 anos iniciais | 98,3% | 98,3 | Seed INEP rendimento 2025 | 0,0 |
| Ideb Aracaju 2025 anos iniciais | 5,8 | N × P = 5,7638, publicado 5,8 | Seed INEP Ideb 2025 | arredondamento oficial |
| Ideb N × P, 542 combinações | gold | N × P arredondado | Seed | 0 acima de 0,05 |
| Por habitante 2025 (mínimo, mediana, máximo) | R$ 702; R$ 1.160; R$ 2.362 | 701,95; 1.159,81; 2.361,51 | Gold, 26 capitais | menor que R$ 0,5 (arredondamento) |
| Por habitante 2025 (média, quartis, razão agregada) | R$ 1.243; R$ 960 a R$ 1.464; R$ 1.361 | 1.243,29; 960,05 a 1.464,31; 1.361,35 | Gold | menor que R$ 0,5 |
| Por habitante 2023 (mediana, média, razão agregada) | R$ 1.032; R$ 1.065; R$ 1.172 | 1.032,03; 1.065,09; 1.172,12 | Gold | menor que R$ 0,5 |
| Por matrícula 2022 (23 capitais) | mediana R$ 11.285, média R$ 11.447, razão agregada R$ 12.015, faixa R$ 9.646 a R$ 13.072 | 11.284,996; 11.446,904; 12.014,667; 9.645,64 a 13.071,91 | Gold | menor que R$ 0,5 |
| Referências estatísticas, 1.530 grupos | gold | média, mediana, mínimo, máximo, quartis, razão, pares, empates | recálculo próprio | 0 divergências |
| Parcela intraorçamentária Porto Alegre 2025 | 32,2% | 32,24% (585.117.865,62 ÷ 1.814.662.781,00) | RREO 6º bimestre ao vivo 09/10/2026 | 0,04 ponto |
| Parcela intra Macapá 2025 e São Paulo 2023 | 0,0% e 0,2% | 0,03% e 0,18% | RREO ao vivo | menor que 0,05 ponto |
| Boa Vista 2024: DCA e RREO | R$ 658.077.936,34 e R$ 122.547.917,75 | idem | Siconfi ao vivo | R$ 0,00 |
| Campo Grande 2021: DCA e RREO exceto intra | R$ 1.030.887.330,50 e R$ 906.686.417,45 | idem; intra R$ 124.200.913,05 | Siconfi ao vivo; MSC (seed) | R$ 0,00 |
| Referência nacional por habitante 2025 | mediana R$ 2.125, média R$ 2.281, razão R$ 1.720 | 2.125,30; 2.281,00; 1.720,13 | CSV de 5.570 municípios; 3 municípios conferidos ao vivo no Siconfi | menor que R$ 0,5 |
| Média da OCDE, ISCED 1 despesa por estudante | US$ 13.334 | 13.333,97 (35 membros) | Gold, seed OCDE (OCDE não verificada ao vivo) | 0,00 |
| Frase da capital Fortaleza 2025 | "R$ 1.188 ... R$ 1.160 (R$ 29 acima)" | 1.188,40 menos 1.159,81 = 28,59; exibidos 1.188 e 1.160 dão 28; tabela de Comparar diz +R$ 28 | Gold; `/gastos?...cap=fortaleza`; `/comparar?...vis=tabela` | R$ 1 de incoerência interna |
| Frase da capital Fortaleza Ideb 2023 | "5,9 ... 5,7 (0,3 ponto acima)" | valor 5,9; mediana 5,65 exibida 5,7; conta exibida 0,2; exata 0,25 | Gold | 0,1 ponto de incoerência interna |

## 7. Consistência entre apresentações

Testei frase, gráfico (valores da reta e rótulos), tabela, resumo (mediana, média, mínimo, máximo, quartis, razão agregada, cobertura) e CSV nos recortes pedidos, com capitais fora da comparação.

* `/gastos?med=despesa_mat&ano=2022`: 23 de 26 capitais. Natal (MSC 23,78% abaixo da DCA), Rio de Janeiro e São Luís (MSC sem linhas da função 12) ficam fora, com motivo, na lista, na tabela ("Fora da comparação", valor em branco, nunca zero) e no CSV (`incluida_na_comparacao` igual a "nao", `motivo_exclusao` preenchido, estatísticas calculadas só sobre as 23). Mediana R$ 11.285, média R$ 11.447, razão agregada R$ 12.015 iguais em tela e CSV e ao recálculo.
* `/gastos?med=despesa_hab&ano=2023`: 26 de 26; população de 2023 é a censitária de 2022, nota repetida na tela e no CSV; evolução interrompe a linha nas trocas de base (2021 a 2022, 2022 a 2023, 2023 a 2024).
* `/gastos?med=despesa_hab&ano=2021`: Campo Grande fica com valor oficial exibido, rotulado "fora das comparações" (perímetro distinto), e fora de mediana (25 capitais), extremos, frase e resumo; no CSV `elegivel_comparacao` igual a "nao" com valor preenchido.
* Ideb e Saeb em ano par: `/resultados?med=ideb&ano=2022` e `/comparar?med=ideb&ano=2022&etapa=anos_finais` exibem a edição 2021 e o dizem (frase "na edição 2021", seletor "Edição bienal"); o CSV traz o nome do arquivo e o período da edição real (`obee_resultados_ideb_2021_anos_finais.csv`). A tabela completa de Comparar em ano par mostra "traço" nas colunas Ideb e Saeb e explica a bienalidade. Em `/resultados` com `ano=2022` a URL conserva 2022 e a tela mostra 2021 (diz no seletor, não na barra de endereço).
* Etapas sem a medida: etapa inexistente cai na etapa inicial do tema sem erro; a tabela de Comparar em ensino médio ou EJA diz que Ideb, Saeb, aprovação e alunos por turma não existem na etapa. Em creche e pré-escola, o resumo de Alunos por turma some (defeito, seção 11).
* Resultado quantitativo: 0 divergências entre tela e gold em 7.176 itens; 0 em 13.484 células; 0 em 286 frases de evolução; 0 em 9.137 linhas de CSV estático; 0 nos 7 CSV de recorte (valores, inclusão, estatísticas, hash, data, colunas descritas no dicionário).
* Incoerência encontrada: frase da capital versus tabela (25 de 260 páginas, seção 8.5).

## 8. Achados metodológicos

### 8.1 Perímetro e intraorçamentárias

O valor é a despesa liquidada na função 12 da DCA, exceto intraorçamentárias, estágio liquidado, exercício. Isso é declarado junto do número em Panorama, Gastos e Comparar ("Perímetro. ..."). A parcela que fica de fora varia muito: recalculada do RREO do 6º bimestre (seed, 130 pares, igual à gold) e conferida ao vivo em cinco casos, vai de 0,0% a 41,4% da função (2021, mínimo São Paulo, máximo Porto Alegre), 0,1% a 34,7% (2022, São Paulo e Aracaju), 0,2% a 37,7% (2023), 3,1% a 35,9% (2024) e 0,0% a 32,2% (2025). O painel diz "a comparação entre capitais não corrige a diferença" e expõe a parcela por capital (coluna na tabela completa e no CSV). Mantém, porém, mediana, extremos, faixa central e posição da capital sobre o valor sem correção. Considero a limitação mais material do conjunto e a principal razão de E e F ficarem abaixo de 9,0 em Gastos, Panorama e Comparar. Não a classifiquei como bloqueio porque está declarada junto do número, a regra é única e documentada e a causa é classificação contábil local (por exemplo contribuição patronal ao regime próprio registrada como modalidade 91 em umas capitais e como modalidade 90 em outras); a decisão final cabe ao responsável pela aprovação.

### 8.2 Despesa por matrícula

Reproduzida exatamente com a regra da página Métodos (modalidades 90, 93 e 94, menos subfunção 364, menos elementos 01, 03 e 05 do grupo 3.1, MSC de dezembro função 12, contas 6.2.2.1.3.03, .04 e .07, saldo líquido C menos D, intra fora): 123 pares sem diferença (R$ 0,00); soma sem intra igual à DCA nesses pares. Os 7 pares sem valor têm causa documentada: MSC sem linhas da função 12 (Rio de Janeiro 2022, São Luís 2022 e 2023), MSC abaixo da DCA (Natal 2022 e 2023, Rio de Janeiro 2021) e DCA com intra (Campo Grande 2021). Denominador (matrículas das escolas municipais) e numerador (aplicação direta, sem transferências a instituições privadas) são coerentes: as transferências que financiam conveniadas (modalidades 50 e 60) ficam fora do numerador e as matrículas conveniadas fora do denominador, mesmo quando as conveniadas chegam a 49,7% da rede (Porto Alegre 2025). A parcela de beneficiário indeterminado (2,0% a 27,6% do total em 2025) pode incluir contratação de vagas, e é medida e publicada. O rótulo evita "custo por aluno" ("razão orçamentária, não custo do aluno"). Não encontrei denominador inadequado.

### 8.3 Preços correntes e constantes

Fatores IPCA (média anual do número-índice, base 2025) reproduzidos ao vivo e iguais à gold. O seletor "Nominais" e "Reais de 2025 (IPCA)" aparece nas três escalas de gasto; a nota de preços correntes aparece no Panorama e na evolução nominal. Na evolução em reais constantes a frase gerada ("passou de R$ 1,12 bilhão em 2021 para R$ 1,86 bilhão em 2025") não repete a base monetária; ela só consta do subtítulo e do eixo (prioridade média). O subtítulo diz "exercício 2025" mesmo quando a série cobre 2021 a 2025.

### 8.4 Quebras de série e ausência

População de 2021 (estimativa de base anterior ao Censo), 2022 (Censo), 2023 (relação do DOU, igual ao Censo 2022 nas 26 capitais), 2024 e 2025 (estimativas): confirmadas no SIDRA ao vivo (78 estimativas e 26 do Censo) e a identidade 2023 igual a 2022 nas 26 capitais. A sinalização de mudança de base marca 2021 e 2023 em cada capital e bloqueia variações que as envolvem; efeito colateral: a frase de evolução por habitante bloqueia o intervalo 2021 a 2025 (50 das 52 páginas) sem apontar que 2022 a 2025 compartilha a base do Censo 2022, e o gráfico interrompe a linha também entre 2022 e 2023, anos de mesma população, com o texto "valores dos dois lados não são diretamente comparáveis" (impreciso para esse par). Ausência: nenhuma ausência virou zero em tela, tabela, CSV de recorte ou CSV estático (0 casos em 9.137 linhas e nos 7 recortes). Zeros existem só como contagem verdadeira (matrículas de etapa sem rede) e foram confirmados pela Sinopse (130 pares de total municipal iguais).

### 8.5 Frases geradas

* Amplitude, cobertura, evolução: 0 divergências em 184 + 286 páginas.
* Frase da capital: 25 de 260 páginas (9,6%) trazem diferença escrita que não coincide com a conta feita sobre os valores exibidos: Saeb 17 de 26, por habitante 2025 5 de 26, Ideb 3 de 26, demais medidas 0. Causa: `fraseCapital` em `src/lib/eficiencia/frases.ts` formata `d.abs` (diferença exata) em vez de `d.texto` da função `diferenca`, que implementa justamente a regra "a diferença escrita é a dos valores como aparecem na tela". A tabela de Comparar e as diferenças de Panorama usam a regra correta, então a mesma capital pode ter duas diferenças diferentes (Fortaleza: R$ 29 na frase, R$ 28 na tabela).
* Nenhuma frase usa termo de julgamento ou causalidade; busca por termos avaliativos nos textos de seis rotas, 184 estados e página Métodos encontrou apenas negações ("não demonstra eficiência", "não mede o efeito da gestão", "não estabelece relação").

### 8.6 Rastreabilidade e versões

* Catálogo e gold são iguais campo a campo nas 13 fichas (0 campos diferentes); a página lista as mesmas versões metodológicas e exibe a mesma data e o mesmo hash da gold.
* Numeração: a página lista revisões 1.0 a 1.3 (todas datadas 08/10/2026) e a versão do catálogo 2026-10-09.1 ("revisão 1"); não há entrada de histórico para o catálogo de 09/10/2026. A revisão 1.3 diz ter alterado "população de 2023 do Censo 2022" e a ficha da população e a de despesa por habitante ainda estão na versão 1.2. A revisão 1.0 cita "PR #117, commit 8ad77db": não verificável por mim (git proibido nesta avaliação).
* A página explica o que é `hash_dados` mas não como recomputá-lo (serialização JSON com chaves ordenadas e separadores compactos, sha256 das observações); recomputei lendo o código e confere.

### 8.7 Referências nacionais e internacionais

* Alunos por turma, aprovação e Ideb: Brasil, rede municipal, INEP, agregado oficial (não é média das capitais), mesma etapa e período; diferença descrita em unidade correta.
* Despesa por habitante: cálculo do OBEE com todos os municípios elegíveis, só 2025, rotulado como outro universo, com cobertura (90,8% dos municípios, 93,2% da população, 94,1% da despesa) e exclusões por motivo (DCA ausente 73, diferença material com RREO 420, RREO ausente 16, sem linha 1).
* Internacional: OCDE como contexto separado, ISCED 1 e 2, instituições públicas, USD PPC, com ano diferente dito, outro universo, sem diferença e fora da distribuição; média recomputada confere. Atende ao requisito de contexto separado. O agregado que incluiria o ensino superior foi retirado da exibição.
* Defeito: no gráfico de Comparar a referência aparece como "Municípios do país R$ 2.125", sem dizer que é mediana, que cobre 5.060 municípios de todos os portes nem que não é diretamente comparável; o aviso está nas outras rotas.

## 9. Rastreabilidade e reprodução (tarefas 7 e 8 da rubrica)

Tarefa 7, exportar o recorte e reconhecer limitações fora do site. Caminho: `/gastos?med=despesa_mat&ano=2022`, "Baixar estes valores (CSV)" e "Dicionário das colunas (CSV)". Resultado: sucesso sem intervenção. O CSV (UTF-8 com BOM, separador ponto e vírgula, 26 linhas, 36 colunas) traz indicador, universo, critério, período, valor numérico e exibido, unidade, estado, elegibilidade, inclusão, conferência, motivo, nota, estatísticas do grupo, versão, data de geração, hash e fonte. O dicionário descreve todas as colunas dos três tipos de exportação (falta nenhuma: conferido por script) e acrescenta três avisos gerais (leia antes de usar; universo e período; como citar). Obstáculos: o Panorama não tem CSV do recorte exibido; os CSV estáticos de `series/` (12 arquivos, 32 colunas, por exemplo `periodo_tipo`, `participacao_pct`, `referencia_numerador`, `tipo_populacao`, `quebra_serie`) não têm dicionário; o valor numérico usa ponto decimal em arquivo com separador ";" e não verifiquei a abertura em Excel ou LibreOffice (não verificado). Limitação reconhecível fora do site: sim, pelo dicionário e pelas colunas de nota e elegibilidade.

Tarefa 8, reproduzir um indicador a partir da documentação.

* Despesa na função 12, Aracaju 2025: URL da API do Siconfi e sha256 do recorte na trilha; consulta ao vivo devolveu R$ 566.422.643,48. Sucesso em menos de um minuto.
* Por habitante: divisão simples; população pelo SIDRA 6579 ou 4714 (conferida ao vivo).
* Por matrícula, Aracaju 2025: a regra está na página, mas a trilha não traz a URL da MSC nem o sha256; a URL e os parâmetros estão só no manifesto do repositório. Com o endpoint `msc_orcamentaria` (classe 6, dezembro, `ending_balance`), a regra publicada reproduziu o numerador R$ 561.863.001,98 e o total sem intra R$ 566.422.643,48 (`ev/reproduz_msc_ao_vivo.py`). Também reproduzi 123 numeradores pelo seed. Exige conhecimento técnico (paginação por `offset`, filtro por conta, natureza C e D).
* Matrículas, ATU, aprovação, Ideb e Saeb: URL do pacote, sha256, MD5 e coluna constam das trilhas; não pude baixar os pacotes neste ambiente (TLS), portanto o último passo é não verificado contra a fonte.
* Cadeia de integridade verificada por mim: hash do código gerador igual (28 arquivos), hash do manifesto igual, 31 recortes e 399 arquivos individuais com sha256 do conteúdo igual ao manifesto, `hash_dados` igual ao recomputado, CSV estáticos e JSON servidos byte a byte iguais ao repositório, 13 CSV com coluna de hash, todos com o mesmo hash e a mesma data. O teste `test_reconstrucao_idempotente` reconstrói a gold em memória e confere o hash.
* Barreira para um leitor externo: a página orienta `python3 -m pipeline.eficiencia.run` e cita caminhos do repositório, mas não linka o repositório (o endereço público existe e respondeu 200); os 10 links externos do painel são páginas genéricas de órgãos (as URLs específicas estão como texto nas trilhas).

## 10. Desempenho com protocolo

Protocolo declarado na seção 5 (laboratório, 5 repetições, mediana, cache desligado). Medianas por rota:

| Rota | Perfil | HTML transferido (KB) | HTML decodificado (KB) | JS transferido (KB) | Total transferido (KB) | FCP e LCP (ms) | CLS | TBT (ms) | Erros de console |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Panorama | A | 30 | 168 | 160 | 834 | 204 | 0 | 0 | 0 |
| Gastos | A | 80 | 405 | 160 | 763 | 216 | 0 | 0 | 0 |
| Atendimento | A | 65 | 390 | 160 | 762 | 204 | 0 | 22 | 0 |
| Resultados | A | 68 | 379 | 160 | 761 | 180 | 0 | 24 | 0 |
| Comparar | A | 112 | 659 | 160 | 763 | 212 | 0 | 36 | 0 |
| Comparar tabela completa | A | 112 | 659 | 160 | 864 | 188 | 0 | 28 | 0 |
| Dados e métodos | A | 96 | 735 | 159 | 797 | 276 | 0,0002 | 13 | 0 |
| Gastos por matrícula 2022 | A | 80 | 405 | 159 | 831 | 172 | 0 | 19 | 0 |
| Panorama | B | 30 | 168 | 159 | 765 | 1.256 | 0,033 | 227 | 0 |
| Gastos | B | 80 | 405 | 159 | 762 | 1.112 | 0,009 | 460 | 0 |
| Atendimento | B | 65 | 390 | 159 | 762 | 1.160 | 0,012 | 489 | 0 |
| Resultados | B | 68 | 379 | 159 | 761 | 1.164 | 0,010 | 429 | 0 |
| Comparar | B | 112 | 659 | 159 | 762 | 1.172 | 0,001 | 632 | 0 |
| Comparar tabela completa | B | 112 | 659 | 142 | 515 | 1.708 | 0 | 895 | 0 |
| Dados e métodos | B | 96 | 735 | 159 | 797 | 1.492 | 0,0002 | 902 | 0 |
| Gastos por matrícula 2022 | B | 80 | 405 | 159 | 831 | 1.104 | 0,009 | 622 | 0 |

Leitura: o conteúdo principal chega no HTML (renderização no servidor), FCP e LCP coincidem (texto), nenhum dado grande é carregado sem pedido (o JSON de 6,7 MB só baixa por clique). JS comum de 160 KB transferidos (506 KB decodificados) em todas as rotas. Cerca de 290 KB do total (corpos RSC de `comparar`, `resultados`, `atendimento`, `metodos`, de 51 a 103 KB cada, por prefetch) e 244 KB de fontes e CSS são carregados antes de qualquer pedido do leitor, ou seja, parte do que se transfere não tem utilidade imediata (prioridade baixa). TBT acima de 600 ms no perfil B em Comparar, Comparar tabela e Métodos (laboratório com CPU 4x, não campo).

Estado da URL e hidratação: todas as rotas são estáticas; o HTML inicial traz o recorte padrão. Medi, com observador de DOM, o intervalo entre o texto padrão e o texto do recorte pedido em `/gastos?med=despesa_mat&ano=2022` (5 repetições): desktop de 243 a 338 ms; móvel estrangulado de 3.068 a 3.402 ms (o FCP ocorre antes, a cerca de 1,1 s, de modo que o leitor vê o recorte padrão por mais de 2 s). Capturas: `ev/capturas/deep_link_estado_padrao_antes_da_hidratacao_movel.png` e `deep_link_estado_correto_apos_hidratacao_movel.png`. Sem JavaScript (`javaScriptEnabled` falso) a página mostra sempre o recorte padrão e, em Gastos, nenhuma tabela.

Console: 0 erros em 80 cargas frias do protocolo, nas interações (troca de medida, ano, moeda, visão, voltar) e em 183 das 184 páginas do primeiro coletor (a página restante registrou mensagens "Failed to fetch RSC payload" de rotas de outro módulo do site, `/setor-eletrico` e `/glossario`, quando a navegação seguinte interrompeu prefetches em voo; não reproduzi em carga limpa e as tratei como artefato do coletor, não como erro do painel; os coletores de Comparar, evolução e frase da capital não registraram console). Rotas inexistentes devolvem 404 com página própria. 69 links únicos, 0 internos com erro.

Testes automatizados: `npx vitest run` em 09/10/2026: 142 arquivos, 2.664 aprovados, 1 ignorado, 58,7 s (suíte inteira do repositório; sete arquivos tratam do OBEE educação, por exemplo `obee-educacao`, `obee-frases`, `obee-comparacoes`, `obee-selecao`). `python3 -m unittest pipeline.tests.test_eficiencia`: 41 aprovados, 68,5 s. Cobrem bem: reconstrução idempotente da gold, ausência não vira zero, reconciliações, política de conferência, estatísticas do grupo, linguagem avaliativa, contraste. Riscos que não cobrem e que produziram os defeitos acima: coerência entre frase da capital e tabela; linhas de resumo da tabela por etapa; estado da URL na renderização inicial; nenhuma verificação em navegador (não há teste end to end).

## 11. Problemas priorizados

Alta
1. Link com recorte mostra primeiro o recorte padrão (K, todas as rotas, Panorama inclusive). HTML estático, hidratação depois: de 0,24 s (desktop) a cerca de 3,3 s (móvel estrangulado, medido no DOM; visível a partir do FCP, cerca de 1,1 s) com conteúdo de outro recorte; sem JavaScript nunca mostra o recorte pedido. Afeta "Copiar link deste recorte", pré-visualizações e leitores de tela com JS desligado. Correção: renderizar o estado no servidor ou ocultar até hidratar. Evidência na seção 10.
2. Perímetro intraorçamentário heterogêneo (0,0% a 41,4% da função) sustenta ranking, mediana e extremos de despesa total, por habitante e por matrícula (E e F, Panorama, Gastos, Comparar). Declarado, não corrigido. Correção: variante de sensibilidade com a parcela intra ou comparação restrita a grupos de perímetro semelhante, mais a parcela de cada extremo ao lado do extremo.

Média
3. Frase da capital incoerente com a conta sobre valores exibidos (25 de 260 páginas; Saeb 17 de 26) e com a tabela de Comparar (R$ 29 contra R$ 28): `fraseCapital` usa diferença exata.
4. Comparar, tabela completa, creche e pré-escola: resumo de Alunos por turma ausente (20 de 54 estados), apesar de haver valor nas 26 linhas: `sem = c.porEtapa && resultadoSemEscopo` em `TabelaComparativa.tsx`.
5. Comparar, gráfico de despesa por habitante: "Municípios do país R$ 2.125" sem ressalva (mediana de 5.060 municípios de todos os portes, não diretamente comparável); o aviso existe só em Panorama e Gastos.
6. Evolução por habitante: bloqueio de 2021 a 2025 sem indicar 2022 a 2025 e linha interrompida entre 2022 e 2023 (mesma população) com texto impreciso; em reais constantes a frase não repete a base monetária.
7. Rastreabilidade: sem link do repositório e do manifesto no painel; trilha da despesa por matrícula sem URL e sem sha256 da MSC; 12 CSV estáticos sem dicionário; histórico de revisões sem a revisão do catálogo 2026-10-09.1 e com revisão 1.3 citando mudança de população cuja ficha está na versão 1.2; "PR #117 e commit 8ad77db" não verificável por mim.
8. Gastos e Comparar: alinhamento por ano civil de despesa, aprovação e Ideb na tabela completa, com Ideb e Saeb vazios em ano par; permitir a edição do Ideb independente do exercício.
9. Testes: ausência de testes de navegador e de coerência entre apresentações.

Baixa
10. Notas de 822 observações trazem ". o que mostra" com minúscula após ponto ("...escolas com contagem. o que mostra contribuição nula...").
11. Ressalva de população de 2023 repetida três vezes no mesmo recorte (recorte, grupo de capitais e capital).
12. Redação "modalidade 90" em "Quem está incluído" contra "90, 93 e 94" na fórmula.
13. Mediana do Ideb 6,05 exibida 6,1, igual ao Brasil; subtítulo da evolução diz "exercício 2025".
14. Prefetch de rotas e fontes (cerca de 290 KB e 244 KB) antes de pedido do leitor; TBT de 632 a 902 ms em Comparar e Métodos no perfil de CPU 4x.
15. Valor numérico do CSV com ponto decimal e separador ponto e vírgula; abertura em planilha em português não verificada.

## 12. Bloqueios de aprovação

Nenhum bloqueio foi confirmado. O que testei, por bloqueio:

* Valores incorretos: 0 em 8.295 conferências recalculadas da gold e do seed, 260 conferências ao vivo, 7.176 itens de tela, 13.484 células de tabela, 9.137 linhas de CSV estático e 7 CSV de recorte. As diferenças de uma unidade da última casa na frase da capital (problema 3) são incoerência de texto, não valor incorreto.
* Comparação materialmente incompatível: não confirmada. É o ponto mais próximo de um bloqueio (problema 2): a diferença de perímetro intraorçamentário está dita junto do número e exposta por capital, a regra é uniforme e documentada. Um auditor mais rígido pode entender que ranquear sobre esse perímetro sem corrigir já é a comparação incompatível; registro a divergência possível para decisão.
* Gasto por matrícula com denominador inadequado: não encontrado (seção 8.2).
* Ausência tratada como zero: não encontrada (tela, tabela, CSV de recorte, CSV estático; vazio do Censo só vira zero com confirmação da Sinopse, 130 pares conferidos).
* Exclusão no gráfico mas não no resumo ou CSV: não encontrada (seção 7). O resumo ausente em creche e pré-escola é omissão, não exclusão divergente.
* Ressalva essencial escondida: não confirmada. A referência "Municípios do país" em Comparar sem qualificação (problema 5) é ressalva ausente no ponto de uso; o rótulo já indica universo diferente de "capitais", e as ressalvas completas estão em outras rotas; deve ser corrigida antes de qualquer aprovação.
* Afirmação causal ou julgamento de eficiência sem suporte: não encontrada (busca textual e leitura de todas as frases geradas).
* Perda funcional relevante: não confirmada (problemas 1 e 4 são limitados em duração ou em escopo).
* Barreira a tarefa essencial: não encontrada nas tarefas 1 a 8; a tarefa 8 para a despesa por matrícula exige conhecimento técnico e acesso ao manifesto do repositório.

## 13. Limitações e itens não verificados

* Dados do INEP (Censo Escolar, ATU, taxas de rendimento, Ideb e Saeb, referências do Brasil, Sinopse): não verificados contra a fonte original, porque `download.inep.gov.br` não passou na verificação TLS neste ambiente. Verifiquei integridade do seed (sha256 do manifesto), reconciliação interna (microdados contra Sinopse, 130 pares; Ideb igual a N × P, 542 combinações) e coerência de recálculo. Falha de coleta ou erro na origem do INEP não seria detectado por mim.
* OCDE: média recomputada a partir dos valores da gold; consulta ao vivo à API da OCDE não realizada.
* Arquivo da relação do DOU de 31/08/2023: não baixado; verifiquei a identidade da população de 2023 com a de 2022 (Censo) nas 26 capitais e a de 2022 com o SIDRA 4714 ao vivo.
* RREO e MSC: conferidos ao vivo em cinco casos de RREO (Porto Alegre 2025 e 2023, Macapá 2025, São Paulo 2023, Aracaju 2022), Boa Vista 2024, Campo Grande 2021 e MSC de Aracaju 2025; os demais pares pelo seed.
* Commit citado no histórico de revisões e histórico git: fora do escopo por regra desta avaliação.
* Abertura dos CSV em Excel e LibreOffice, leitores de tela e acessibilidade: fora de escopo ou não testados.
* Desempenho: apenas laboratório, um navegador (Chromium), uma máquina; sem dado de campo; estrangulamento emulado.
* A amostra do navegador não esgota todas as combinações possíveis de parâmetros (por exemplo grupo regional com capital escolhida só foi conferido por CSV da região Nordeste e por regras de código).

## 14. Arquivos de evidência

Pasta `docs/obee/avaliacao/rodada-2/evidencias/dados/`:

* Scripts de recálculo e conferência (Python, sem importar o pipeline): `recalculo_gold.py`, `confere_fontes_vivas.py`, `confere_intra_rreo.py`, `reproduz_despesa_matricula.py`, `reproduz_msc_ao_vivo.py`, `compara_navegador_gold.py`, `compara_tabela_comparar.py`, `compara_evolucao.py`, `compara_frase_capital.py`, `confere_csv_baixados.py`, `confere_series_csv.py`.
* Resultados em CSV: `recalculo_gold.csv` (6.635 linhas), `recalculo_referencias_resumo.json`, `fontes_vivas.csv` (260), `intra_rreo_recalculo.csv` (130), `reproducao_despesa_matricula.csv` (130), `comparacao_navegador_gold.csv` (7.176), `comparacao_tabela_comparar.csv` (13.484), `comparacao_evolucao.csv` (286), `comparacao_frase_capital.csv` (260), `perf.json`.
* CSV baixados do site: pasta `downloads/` (10 arquivos).
* Capturas: pasta `capturas/` (resumo ausente em creche, frase e tabela de Fortaleza, deep link antes e depois da hidratação em móvel estrangulado).
* Coletores de navegador (Playwright): pasta `playwright/` (`grade.mjs`, `grade_cmp.mjs`, `grade_evo.mjs`, `grade_cap.mjs`, `perf.mjs`, `flash.mjs`, `baixa.mjs`, `inter.mjs`, `robust.mjs`, `nojs.mjs`, `caps.mjs`, `cap2.mjs`, `dump.mjs`, `pw.mjs`, `caps.json`).
* Logs: pasta `logs/` (resumo do vitest, resultado do unittest, saída da conferência de intraorçamentárias).
