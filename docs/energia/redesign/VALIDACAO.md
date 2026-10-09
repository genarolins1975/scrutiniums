# Validação do redesenho do observatório de energia

Versão validada: ramo `claude/kind-mayer-v9tpwi`, commit de fechamento indicado no pull request, fundido com `origin/main` de 09/10/2026. Build de produção local de 09/10/2026 (15:36 UTC). Escopo: `/setor-eletrico`, a inicial, as 22 aberturas e as páginas filhas (94 rotas medidas). Sem merge e sem publicação em produção.

Regra de leitura: cada número tem a fonte ao lado (comando, arquivo ou avaliação) e a data. O que não foi medido está na seção 7.

## 1. Verificações automáticas

| Verificação | Comando | Resultado em 09/10/2026 |
| --- | --- | --- |
| Build de produção, com lint e tipos | `npm run build` (Next 14.2.35) | Sucesso; 439 páginas geradas; JavaScript compartilhado de 87,5 kB |
| Tipos | `npx tsc --noEmit` | Sem erros |
| ESLint | `npm run lint` | Sem avisos nem erros |
| Testes de unidade e de conteúdo | `EXIGIR_BUILD_HTML=1 npx vitest run` | 172 arquivos; 4.196 testes passam; 1 ignorado; 0 falhas |
| HTML gerado pelo build (data ISO crua, undefined, NaN, literais da fonte) | `src/tests/html-gerado.test.ts`, incluído na linha acima | Passa. Foi o teste que apontou, depois da fusão com `main`, a linha do tempo da Regulação e a legenda dos arquivos do SIGA; ambas corrigidas |
| Módulos Python compilam | `python3 -m compileall -q pipeline` | Sem erros |
| Testes do pipeline | `python3 -m unittest discover -s pipeline/tests -t .` | 1.492 testes; 1 falha; 4 ignorados |

A falha do pipeline é `test_energia_carga.GoldPublicada.test_arquivos_das_evidencias_existem_ou_sao_declarados_indisponiveis`: a gold cita um arquivo bruto de `data/energia/bronze/ons/ons_carga_diaria_conferencia/...` que existe só no cache do pipeline e não neste clone. Não é causada pelo redesenho (nenhum código de `pipeline/energia/gold` de Carga foi alterado) e não foi corrigida.

## 2. Acessibilidade

Fonte: `scripts/energia-avaliacao.mjs` (`axe-core` com as regras WCAG 2.0, 2.1 e 2.2 dos níveis A e AA, mais teclado, alvos de toque e rolagem), executado contra o build de produção deste commit (`next start`, Chromium sem interface) em 09/10/2026. 94 rotas, nas larguras de 320, 390 e 1440 px, no nível Entender: 282 medições. A linha de base é a coleta de 09/10/2026 (05:13 UTC) do ramo no commit `51747baf8`, o início desta sessão, antes do redesenho, restrita às mesmas combinações; a coleta original também cobria 768 px e o nível Auditar, sem violação do axe em nenhuma.

| Medida (94 rotas; 320, 390 e 1440 px; Entender) | Linha de base (05:13 UTC) | Estado final |
| --- | ---: | ---: |
| Medições | 282 | 282 |
| Violações do axe, regras A e AA | 0 | 0 |
| Medições com rolagem horizontal da página | 0 | 0 |
| Erros de console | 0 | 0 |
| Falhas de rede | 0 | 0 |
| Data ISO crua, undefined ou NaN no texto | 0 | 0 |
| Identificadores internos de conjuntos de dados no texto visível (ex.: `PLD_HORARIO`), ocorrências nas 3 larguras | 27 | 27 |
| Elementos que passam da largura da janela (primeiros cinco por medição) | 5 | 0 |
| Alvos de toque abaixo de 44 px em 390 px (rotas com ao menos um) | 225 (60) | 291 (38) |
| Alvos abaixo de 24 px em 390 px (mínimo do WCAG 2.5.8) | 0 | 0 |

Comparação rota a rota (altura, HTML, JavaScript, tempo, axe, alvos, console, rolagem): `OBJETIVO_ANTES_DEPOIS.md`. Dados brutos de cada medição no JSON do instrumento, que não é versionado (cada medição traz marcos, anomalias, alvos e violações do axe).

Teclado e foco. O instrumento registra o primeiro foco, a sequência de Tab, o indicador de foco visível e armadilha de foco por rota. O defeito que mais apareceu nas avaliações independentes (primeiro clique em área sem controle levava a página ao topo, porque o foco caía em `main#conteudo` e o tratamento da regra 2.4.11 rolava a página) foi corrigido em `ModoProfundidade.tsx` e conferido no navegador em Perdas, Inclusão, Orçamento e Acesso, em 1440 e 390 px.

Níveis Analisar e Auditar. Esta coleta mede só Entender. Os avaliadores independentes rodaram axe próprio nos três níveis das páginas que avaliaram (31 páginas) e registraram ausência de violações das regras A e AA; os achados de boas práticas (ordem de títulos, regiões repetidas) estão nos JSON de `avaliacao/rodada2/`. Não houve varredura de axe em Analisar e Auditar nas 94 rotas depois do redesenho.

Alvos de toque. Botões de nível, siglas e o gatilho "Comprove este número" passaram a 44 px abaixo de 768 px e em ponteiro grosso. Em 390 px, 291 alvos em 38 rotas ficam abaixo de 44 px no lado menor (225 em 60 rotas na linha de base; o instrumento é o mesmo, o conteúdo das páginas não). Medida com `scripts/energia-alvos-pequenos.mjs`: 273 são caixas de seleção e botões de opção nativos de 24 px dentro de rótulo com 44 px ou mais de altura (a área tocável é o rótulo; o instrumento mede o campo) e 18 são botões e links de 44 px de altura com menos de 44 px de largura (exemplos: botão "CSV" de 29 por 44 px; botão "UF ↑" de 32 por 44 px; botão "XLSX" de 36 por 44 px; link "Carga" de 40 por 44 px; link "Dados" de 42 por 44 px; link "Rede" de 34 por 44 px). Abaixo de 24 px, o mínimo do WCAG 2.5.8 (AA), há 0. O instrumento não distingue o tipo de alvo na linha de base, de modo que o aumento por tipo não foi decomposto; as rotas com mais caixas de seleção são as de Dados e Metodologia, que trazem listas de filtro.

Contraste. Os tokens de cor do repositório já passavam AA e não foram alterados. Classes claras do mapa de calor (menos de 3:1 contra o papel) ganharam contorno de 1 px. O axe deixa verificações de contraste como "incompletas" em texto sobre SVG e gradiente: elas não foram conferidas uma a uma.

Texto dentro de gráficos. Medida em `scripts/energia-svg-texto.mjs` (94 rotas, nível Entender, 1440 e 390 px, mesmo build): o texto dos SVG é desenhado a 12 px nas unidades do gráfico, e o tamanho efetivo no navegador depende da escala do SVG na coluna.

| Medida (94 rotas; 1440 e 390 px; Entender) | Linha de base | Estado final |
| --- | ---: | ---: |
| Gráficos SVG com texto | 564 | 564 |
| Textos dentro de SVG | 9.169 | 9.149 |
| Textos abaixo de 12 px efetivos | 4.157 (45%) | 1.417 (15%) |
| Menor tamanho efetivo | 10,0 px | 10,6 px |
| Textos que passam da caixa do SVG | 71 | 10 |
| Pares de textos sobrepostos | 0 | 0 |

Os 1.417 textos abaixo de 12 px efetivos estão em gráficos cujo viewBox é mais largo que a coluna e que, por isso, encolhem (o menor mede 10,6 px). Os textos que passam da caixa do SVG passam de 1 a 6 px e os SVG têm `overflow: visible`, de modo que nenhum é cortado na tela.

Leitor de tela real: não testado.

## 3. Responsividade

Larguras de 320, 390 e 1440 px no instrumento objetivo (Entender), e 320, 390, 768 e 1440 px nas capturas das 22 aberturas. Rolagem horizontal da página, texto cortado e erros de console estão na tabela da seção 2. As capturas estão em `capturas/depois/` (276 arquivos em WebP): primeira dobra das 94 rotas em 1440 px (reduzida a 50%) e em 390 px; página inteira das 22 aberturas em 1440 px (50%) e em 390 px (60%); dobras de 320 e 768 px das 22 aberturas. As capturas de `capturas/antes/` seguem o mesmo formato.

Medida da primeira tela das aberturas (`dados/medidas_antes.json` e `dados/medidas_depois.json`, gerados por `scripts/energia-capturas-redesenho.mjs`):

- Critério: a figura principal está "na primeira tela" quando o topo dela fica acima de 840 px em 1440 por 900 (pelo menos 60 px dentro da janela). Em 1440 por 900 px isso vale para 5 das 22 aberturas (Expansão a 748 px, Transição a 782 px, PLD a 783 px, Geração a 797 px, Regulação a 823 px), contra 0 antes. Perto do critério: Inclusão (841), Modelos (846), Previsões (863), Perdas (890), Água e clima (916), Carga (940).
- Nas 15 aberturas que têm figura medida nas duas versões, a figura subiu em 15, e a mediana da posição foi de 1.639 para 916 px em 1440 px. 5 páginas (Aprenda, Dados, Empresas, Inicial, Metodologia) não têm figura principal pelo critério do instrumento.
- O requisito de mostrar parte do gráfico principal na primeira tela de 1440 por 900 px **não foi atendido em 17 das 22 aberturas**: a faixa de métricas e os controles vêm antes da figura, como no desenho da galeria.
- Em 390 px nenhuma figura aparece na primeira tela (844 px), como previsto: pergunta, medida e referência vêm antes da navegação extensa. A mediana da posição da figura foi de 2.979 para 1.604 px (14 de 15 aberturas subiram; piorou: Modelos, de 1.989 para 6.933 px; o instrumento mede a primeira tabela ou gráfico visível, e em 390 px uma tabela que aparece em 1440 px pode não contar como visível, o que é limite da medida e não foi conferido em captura). O título começa entre 110 e 197 px.
- Rolagem horizontal da página nas 22 aberturas: 0 capturas de 88 (quatro larguras por abertura).

## 4. Desempenho de laboratório

Fonte: a mesma coleta da seção 2 (94 rotas, nível Entender; peso e tempo em 1440 px). Servidor local de produção. As coletas rodaram com outras medições em paralelo no mesmo computador, de modo que o tempo de carga é indicativo, não preciso. A linha de base (05:13 UTC) é o ramo no commit `51747baf8`, antes do redesenho e antes da fusão com 82 commits de `main`: a diferença de peso inclui o que veio dessa fusão e não foi separado do que veio do redesenho. `main` sozinho não serve de comparação: medido em 09/10/2026 (commit 58945b5ca), devolve 404 em 10 das 94 rotas, que ainda não estão em `main`.

| Medida (mediana por rota) | Linha de base (05:13 UTC) | Estado final |
| --- | ---: | ---: |
| HTML (kB) | 411 | 431 |
| Maior HTML (kB) | 852 | 801 |
| Rotas com HTML acima de 600 kB | 8 | 11 |
| JavaScript carregado (kB) | 603 | 686 |
| Tempo de carga em laboratório (ms) | 946 | 1.068 |
| Altura da página em 1440 px (px) | 4.385 | 5.094 |
| Altura da página em 390 px (px) | 7.776 | 8.409 |

Rotas com HTML acima de 600 kB no estado final: `/territorio` 801 kB, `/` 790 kB, `/qualidade` 742 kB, `/carga/perfil-horario` 711 kB, `/rede` 667 kB, `/regulacao` 663 kB, `/pld` 652 kB, `/carga` 648 kB, `/pld/previsoes` 630 kB, `/conta-de-luz` 623 kB, `/pld/historico` 622 kB. JavaScript compartilhado do build: 87,5 kB (`npm run build`, 439 páginas). Comparação rota a rota: `OBJETIVO_ANTES_DEPOIS.md`.

Limite. Laboratório não é experiência de campo: um navegador, uma máquina, servidor local de produção, sem limitação de rede. LCP, INP e CLS não foram medidos pelo instrumento do projeto.

## 5. Preservação das visões

Fonte: `scripts/energia-visoes.mjs` (inventário das visões no HTML renderizado, em 1440 px, por rota e nível de profundidade), `scripts/energia_visoes_compara.py` e `scripts/energia_equivalencias_dos_pedidos.py`. Dados em `dados/visoes_antes.json` (build do ramo no commit `51747baf8`, antes do redesenho) e `dados/visoes_depois.json` (build final deste ramo), ambos de 09/10/2026. Resultado visão a visão em `MATRIZ_PRESERVACAO.md`.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Rotas inventariadas | 94 | 94 |
| Visões contadas (painéis, gráficos, tabelas, mapas, diagramas e visões sob demanda) | 1.025 | 1.555 |
| Gráficos | 299 | 320 |
| Tabelas (abertas, recolhidas e sob demanda) | 579 | 616 |
| Mapas e diagramas | 21 | 26 |
| Painéis e seções com título | 121 | 588 |
| Controles de filtro, seleção e busca, sem a barra de profundidade | 540 | 596 |
| Arquivos para baixar, por rota | 372 | 393 |
| Fichas "Comprove este número" (Entender, Analisar, Auditar) | 200, 206, 206 | 222, 229, 229 |

Resultado. 1.025 de 1.025 visões anteriores têm correspondente ou equivalência registrada; 0 ocorrências a justificar (visão, controle, opção, arquivo ou ficha que existia antes e não existe depois). Como foram casadas: 891 pelo mesmo tipo e título, 37 pelo mesmo painel com título renomeado, 41 por título semelhante (razão de 0,6 ou mais), 37 por equivalência manual e 19 por equivalência registrada nos pedidos, cada uma com justificativa. O arquivo `equivalencias.json` traz 106 equivalências em 48 rotas; 31 são manuais (`equivalencias_manuais.json`, 20 rotas), das quais 23 foram acrescentadas no fechamento. Por propósito, foram retirados 7 controles, alterados 13 conjuntos de opções e ajustada 1 contagem de ficha, todos com justificativa na matriz.

Os 49 painéis numerados (ids `p001` em diante) continuam todos nas mesmas rotas e com o mesmo id (49 de 49). O aumento de painéis e seções com título (121 para 588) é inferência: o desenho novo dá a cada capítulo e a cada pergunta uma seção com título, que o inventário conta como painel; não foi decomposto seção a seção.

## 6. Avaliação independente

Detalhe em `RELATORIO_FINAL.md` (matriz de notas e bloqueios) e em `avaliacao/`. Resumo:

- Linha de base (versão anterior ao redesenho): 26 páginas avaliadas, 0 aprovadas, 13 bloqueios.
- Versão nova: 31 páginas avaliadas, 0 aprovadas, 9 bloqueios; 7 corrigidos depois da avaliação e cobertos por teste, 2 remanescentes de causa externa.
- Independência: avaliadores e executores são o mesmo modelo de linguagem em contextos separados; sem revisão humana e sem teste com pessoas. Cada avaliação traz no JSON os seus limites.
- Não foram executados os testes de tarefa por perfil (`avaliacao/PROMPT_TESTE_TAREFAS.md`).

## 7. O que não foi verificado

1. Leitor de tela real (NVDA, JAWS, VoiceOver, TalkBack), Firefox, Safari, aparelho móvel físico, ampliação de texto a 400%.
2. Desempenho de campo (LCP, INP, CLS), consumo de dados em rede móvel.
3. Reavaliação independente do estado final: as notas são das versões avaliadas. As correções posteriores têm teste e inspeção, não nota.
4. Geração, Mercado e Regulação, Transição e Expansão, Modelos e Previsões, Empresas, Aprenda e Dados e Metodologia na versão nova, e a avaliação técnica de Carga e Rede.
5. Regeneração de golds e CSV pelo pipeline: este ambiente não tem bronze nem silver completos. As golds publicadas são as de 01/10/2026 e anteriores; as correções de interface leem o dado como está.
6. Fontes externas fechadas nas datas de consulta (CCEE, portais da ANEEL, site do IBGE, Planalto): os números que dependiam delas ficaram como "conferência pendente" nas páginas.
