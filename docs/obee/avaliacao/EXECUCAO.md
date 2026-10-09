# Execução das correções, rodadas 1 a 2

Documento do **executor**. Não contém notas: as notas valem só quando atribuídas por avaliadores independentes (`rodada-N/`). Os avaliadores da rodada 2 não leem este arquivo.

## Escopo e inventário

Seis painéis em `/eficiencia-estatal/educacao-municipal-capitais`: Panorama (raiz), Gastos, Atendimento, Resultados, Comparar capitais e Dados e métodos. Dados: `public/eficiencia/gold/educacao_capitais.json` (9.137 observações), séries em `public/eficiencia/series/`, catálogo `pipeline/eficiencia/catalogo_indicadores.json` (versão do catálogo `2026-10-09.1`). Rubrica: `RUBRICA.md`. Matriz inicial e registro: `rodada-1/MATRIZ_INICIAL.md` e `rodada-1/REGISTRO_PROBLEMAS.md`.

## Lotes de correção (branch `claude/obee-avaliacao-educacao`)

| Lote | Conteúdo | Itens do registro |
| --- | --- | --- |
| 1 | Perímetro da despesa (intraorçamentárias) junto do número; mudança de base na evolução, na mediana e na frase; universo por medida | D1, D2, X1, D3 |
| 2 | Grupo de comparação por região; Comparar com ficha, CSV, referência nacional e ressalvas; ano par da tabela; fim da série; empates, diferença e centavos; seta nos resumos; ícone | D4 a D6, D8, D11 a D13, D16, X3, X8 |
| 3 | Dicionário das colunas; nomes de arquivo; versão do CSV por indicador; índice e seção de versões em Dados e métodos | D7, D9, X10 |
| 4 | Distribuição com margens pelo maior rótulo, rótulos em duas linhas, eixo sem colisão e capitais fora da comparação no gráfico, com o bloco de motivos logo abaixo; Ideb por extenso, reais correntes e escala logarítmica no Panorama; aviso do grupo por tipo de medida; valor em cada ponto da evolução; aviso de reais correntes; CSV da série; seção "O que este painel não mostra" | X2, X4 a X7, X12, X13 |
| 5 | Trilhas de reprodução de população, despesa por habitante e por matrícula; data do Censo 2022 única; texto da V18; política 1.2 nas notas; ordem decrescente; legenda da referência nacional; controles sem efeito somem do Detalhe; colunas estreitas e aviso de leitura conjunta na tabela cruzada; nota do TLS do INEP; seletor Medida com o texto completo (commit do PR #122) | D7, D14, D15, X9, X11, P14, P15, P17, P21 |

## Verificações executadas pelo executor (build `next build` do HEAD, servidor local na porta 3100)

* Suíte completa: 142 arquivos, 2.664 testes aprovados, 1 ignorado (Vitest). Python: 41 testes do pipeline aprovados. `tsc` e ESLint sem erro.
* Gate de HTML pré-renderizado (`EXIGIR_BUILD_HTML=1`) aprovado no build.
* `scripts/obee/redesenho-verificacao.mjs`: 16 rotas por 5 larguras (1440, 1024, 768, 390, 320 px), 80 combinações, 2.766 controles medidos, axe-core (WCAG 2.2 AA) sem violações, sem rolagem horizontal da página, alvos de toque a partir de 44 px, foco visível, movimento reduzido.
* `scripts/obee/interacoes-redesenho.mjs`: 59 verificações em 1280 px e 59 em 390 px (navegação, estado na URL, gráfico e tabela com o mesmo conjunto, downloads, teclado, toque, capitais fora da comparação, CSV da série).
* Comparação da gold antes e depois do lote 5: 9.137 observações, nenhum valor, estado ou elegibilidade alterado; duas notas de texto mudaram (referência à política 1.2).
* Capturas antes (rodada 1, `rodada-1/evidencias/experiencia/`) e depois (`depois/`, mesmos recortes; gerador `scripts/obee/capturas-avaliacao.mjs`).

## Relatório de regressões

Nenhuma regressão detectada pelos roteiros acima. O que foi conscientemente alterado: o nome do arquivo CSV de Gastos passou a incluir a moeda (`..._nominal.csv`); a ordem por valor ganhou a opção decrescente; o seletor Evolução ganhou o botão "Baixar esta série (CSV)". Os testes existentes foram atualizados somente onde a mudança é intencional (centavos acima de R$ 1 bilhão, "menos de" na diferença, rótulo do arquivo).

## Limitações declaradas

* Não houve leitor de tela real (NVDA, VoiceOver, TalkBack), toque em aparelho físico, nem teste com pessoas. As tarefas dos quatro perfis são inspeção heurística feita por agentes, não pesquisa de usuário.
* A produção não foi avaliada: toda a verificação é em build local. O deploy depende de merge, que não foi autorizado.
* `P18` (parâmetros inválidos de URL voltam ao padrão em silêncio e a URL só é normalizada na próxima mudança) é comportamento do hook compartilhado `useEstadoUrl`, documentado como regra do projeto; não foi alterado para não afetar Energia e Crédito.
* Fora do escopo desta execução: P16 (posição da anotação da pandemia), P19 (zero de rede sem etapa na mediana), P20 (commit exato da geração da gold), P22 (rodapé compartilhado), P21 sem JavaScript e a observação editorial P23.
* O seletor Medida é o mesmo commit do PR #122 (aberto): se o #122 for mergeado antes, este PR o recebe sem conflito.
