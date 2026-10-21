# Saúde nas capitais: matriz de avaliação

Estado em 09/10/2026. Avaliação final feita sobre o commit `28f7c5ec9` (gold `hash_dados` `6a4bac828fb3918d`, 8.777 observações). Rubrica em [avaliacao/RUBRICA.md](./avaliacao/RUBRICA.md); relatórios completos, com evidências, em [avaliacao/rodada-1/](./avaliacao/rodada-1/).

## 1. Natureza da avaliação

* **Interna, por agentes, sem validação humana.** Três papéis, em agentes distintos e contextos limpos: o executor constrói e corrige e não atribui nota; o avaliador de dados e método atribui E, F, G e K; o avaliador de experiência atribui A, B, C, D, H, I e J. Os avaliadores não alteram `src/`, `pipeline/`, `public/` nem testes.
* **Inspeção heurística.** Não houve usuários reais, pessoas de saúde, conselheiros nem especialistas externos. As tarefas por perfil (cidadão ou conselheiro, jornalista, gestor, pesquisador) foram executadas por agentes em papel simulado, sem tempos nem taxas de sucesso.
* **Ambiente.** Chromium 141 e Playwright, sem leitor de tela real nem dispositivo físico; larguras de 320 e 390 px simuladas em janela de navegador.
* **Nota é o que a evidência sustenta.** "Não verificado" não vira nota alta, e nenhuma nota passou de 9,2.

## 2. Resultado

**A meta (nota mínima 9,0 em cada critério, em cada página) não foi atingida.** Trinta das 77 combinações de página e critério chegam a 9,0 ou mais. Não restou nenhum bloqueio de aprovação da rubrica: valor incorreto, comparação incompatível, despesa do município como gasto total, razão despesa por atendimento, ausência tratada como zero, exclusão só no gráfico, ressalva escondida, causalidade, nota, ranking, semáforo, estimativa de desperdício, Distrito Federal misturado ou dado pessoal. Os problemas remanescentes são de gravidade baixa. As notas abaixo de 9,0 não foram negociadas.

## 3. Matriz final

Fonte das notas: avaliador de dados e método, "Reavaliação 4 (final)" em `avaliador-dados.md`, para E, F, G e K; avaliador de experiência, "Reavaliação 4 (final)" em `avaliador-experiencia.md`, para A, B, C, D, H, I e J. Adaptações: na entrada, A não tem visual principal e H mede a comunicação visual; em Dados e métodos, H mede tabelas, listas e quadro.

| Página | A | B | C | D | E | F | G | H | I | J | K | Média |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Entrada `/eficiencia-estatal` | 8,8 | 8,7 | 8,8 | 8,9 | 9,0 | 8,9 | 8,9 | 8,4 | 9,0 | 9,0 | 9,1 | 8,9 |
| Panorama | 8,7 | 8,8 | 8,9 | 8,8 | 8,8 | 8,9 | 9,0 | 8,6 | 8,9 | 8,9 | 9,0 | 8,8 |
| Gastos | 8,9 | 9,0 | 9,0 | 8,9 | 9,2 | 9,1 | 9,1 | 8,9 | 9,0 | 8,9 | 9,1 | 9,0 |
| Rede e atenção primária | 8,9 | 9,0 | 9,0 | 8,9 | 9,0 | 8,9 | 9,0 | 8,8 | 9,0 | 8,8 | 9,1 | 8,9 |
| Atendimento e resultados | 8,9 | 8,9 | 9,0 | 8,9 | 8,9 | 8,8 | 9,0 | 8,7 | 8,9 | 8,8 | 9,1 | 8,9 |
| Comparar capitais | 8,9 | 9,0 | 8,9 | 8,9 | 9,0 | 9,0 | 8,9 | 8,7 | 8,9 | 8,8 | 9,1 | 8,9 |
| Dados e métodos | 8,7 | 8,7 | 9,1 | 8,8 | 8,9 | 8,8 | 9,0 | 8,8 | 9,0 | 8,9 | 9,1 | 8,9 |
| **Média do critério** | 8,8 | 8,9 | 9,0 | 8,9 | 9,0 | 8,9 | 9,0 | 8,7 | 9,0 | 8,9 | 9,1 | |
| Páginas com 9,0 ou mais | 0 de 7 | 3 de 7 | 4 de 7 | 0 de 7 | 4 de 7 | 2 de 7 | 5 de 7 | 0 de 7 | 4 de 7 | 1 de 7 | 7 de 7 | |

As médias de C, E, G e I ficam em 9,0 por arredondamento (8,96 a 8,99); nenhum desses critérios tem 9,0 em todas as páginas. Só K chega a 9,0 em todas.

Justificativa por célula, evidência (rota, estado, captura ou código) e o que falta para cada nota abaixo de 9,0: `avaliador-experiencia.md` (seção "U3. Matriz de notas final") e `avaliador-dados.md` (seções 11.3 e 11.5).

## 4. Trajetória das médias por critério

| Critério | Reavaliação 2 | Reavaliação 3 | Final |
| --- | --- | --- | --- |
| A, layout | 8,6 | 8,8 | 8,8 |
| B, didática | 8,8 | 8,8 | 8,9 |
| C, utilidade | 8,8 | 8,9 | 9,0 |
| D, relevância | 8,8 | 8,9 | 8,9 |
| E, indicadores e referências | 8,83 | 8,86 | 8,97 |
| F, rigor metodológico | 8,86 | 8,83 | 8,91 |
| G, rastreabilidade | 8,69 | 8,89 | 8,99 |
| H, visualizações | 8,5 | 8,6 | 8,7 |
| I, navegação | 8,8 | 8,9 | 9,0 |
| J, acessibilidade | 8,9 | 8,8 | 8,9 |
| K, confiabilidade técnica | 9,01 | 8,99 | 9,09 |

A avaliação inicial reprovou o módulo (quatro bloqueios de dados e três de experiência). Os ciclos de correção os eliminaram, e os relatórios de cada rodada registram cada achado, a correção e o resíduo. O mapa do executor está em [avaliacao/rodada-1/CORRECOES.md](./avaliacao/rodada-1/CORRECOES.md).

## 5. O que impede 9,0, por causa

| Causa | Critérios e páginas | O que falta |
| --- | --- | --- |
| Validação externa do método | F em cinco páginas; E de Atendimento e resultados | Universo de internações do COB.2.01 frente ao MRB.4.02 (RIPSA); explicação do M03 para cinco capitais com contagem diferente do CNES; regras da MSC e do último bimestre do Anexo 12 (contabilidade pública e SIOPS); fórmula da Nota Técnica nº 2/2025 e regra de 2021 (área técnica do Ministério da Saúde); relação do DOU de 31/08/2023 e duas páginas do IBGE (resposta 403 a consultas automáticas) |
| Referência faltante | E de Atendimento e resultados, E do Panorama | Referência nacional para a participação de ICSAP nas internações; razão agregada e evolução da mediana no Panorama |
| Rastreabilidade | G do Comparar e da entrada | Link de fonte e reprodução no corpo do Comparar e fórmula na tabela; linha de fontes de Educação conferida com o módulo de Educação (OCDE) |
| Primeira tela no celular | A em todas as páginas | O gráfico começa de 1 a 181 px abaixo de 800 px a 390 px (Gastos 837, Rede 801, Resultados 807, Comparar 863, Panorama 981) |
| Visualizações | H em todas | Texto SVG de 10 a 11,5 px, ticks apertados no Panorama, opção de ver todos os pontos, eixo comum opcional no Comparar |
| Didática | B de Dados e métodos, entrada, Panorama, Resultados | Fichas densas e repetidas; siglas só por `abbr title` na entrada; RREO, AIH e LC fora do bloco de siglas no Panorama |
| Componentes compartilhados | J e I | Rodapé e links de CSV de 17 px, links em linha de 27 px, parâmetros inválidos de capital, medida e visão que permanecem na URL; não alterados para não mexer em Educação |
| Entrada | H, B, C | Prévia visual opcional, atalhos por pergunta |

## 6. Mudanças depois da avaliação final

Feitas depois do commit avaliado, **sem nova avaliação**, por pedido dos próprios relatórios; nenhuma nota foi alterada por causa delas. Gold `hash_dados` `3797117fb0d67027`; nenhum valor mudou (182 observações com o rótulo da base da população de 2023, 26 com o tipo de população).

* Dados: fichas da população e da taxa de ICSAP e matriz de fontes F02 sem as frases que contradiziam as marcas de base, com o intervalo da população do Ministério por ano (de 10,7% menor a 5,9% maior em 2021; 2,6% a 10,1% maior em 2022; 3,5% a 11,1% maior em 2023; igual em 2024); procedência da população de 2023 com tipo e rótulo próprios (`censo_2022_resultado_dez_2023`) e endereço do arquivo usado; marca de perímetro herdada pelas aberturas da DCA (subfunção e natureza) e coluna de perímetro no CSV da série; página e data da norma no CSV de referências; descrições do histórico de revisões corrigidas e linha nova.
* Experiência: DOM na mesma ordem da visual no celular (aviso, ponteiro e gráfico; cartões do Panorama), de modo que a ordem de Tab acompanha a leitura; chevron do resumo gira ao abrir; cabeçalho de linha na tabela do histórico; Ideb no mapa de siglas.
* Conferência do executor: Python de Saúde 67 testes, vitest completo 2.774 testes aprovados e 1 ignorado, `tsc` e `lint` sem erro, `next build` concluído, 28 combinações de página e largura sem erro de console nem rolagem horizontal. Isso não substitui reavaliação independente.
* Resíduo conhecido: na tela larga, a ordem de Tab nos cartões do Panorama passa pela coluna do gráfico antes dos links da coluna de texto.

## 7. Limitações

* Sem usuários, especialistas nem revisão externa; as notas valem para o estado observado e para as larguras e o navegador testados.
* Dados não confrontados com todas as fontes oficiais: a recomputação a partir do seed usa o mesmo recorte do executor (manifesto com sha256 conferido); a independência de fonte vem de conferências ao vivo e dos arquivos originais baixados pelo avaliador. A consulta ao vivo do SIOPS falhou (500) na última verificação.
* Combinações de medida, ano, capital e grupo verificadas por amostra.
* O módulo de Educação não foi reavaliado; seus componentes compartilhados só receberam mudanças retrocompatíveis.
