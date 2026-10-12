# Estabilidade do par selecionado

12/10/2026. Seção experimental em `/eficiencia-estatal`, dentro de `#atlas-piloto`. Contrato de exibição em preview preservado.

## Pergunta e contrato

A ordem entre as cidades se mantém sob as hipóteses avaliadas? Cada diferença é calculada entre os escores das duas cidades **na mesma hipótese**. Não se subtraem extremos de faixas individuais. As três famílias permanecem separadas:

- Pesos: 32 cenários fatoriais de variação de ±20% antes da normalização; 31 vetores distintos. A duplicata da cesta igualitária não é contada duas vezes.
- Retirada de dimensão: cinco exclusões, uma por vez, com os demais pesos renormalizados.
- Definições: saneamento apenas rede e homicídios apenas registrados, em duas hipóteses separadas.

O componente usa as saídas do snapshot congelado, sem recalcular notas ou mudar a metodologia. Não depende do relatório de robustez adicional no bundle de produção. Territórios fora da referência retornam ausência.

## Estados

| Referência | Resultado nas hipóteses | Apresentação |
|---|---|---|
| Diferença não nula | Alguma diferença com sinal oposto | Há inversão da ordem |
| Diferença não nula | Sem inversão, com empate | A diferença chega a empate |
| Diferença não nula | Mesmo sinal em todas | Ordem mantida |
| Empate | Alguma diferença não nula | Empate de referência desfeito |
| Empate | Todas as diferenças nulas | Empate mantido |

Tolerância numérica de 1e-9 ponto, aplicada antes do arredondamento. A inversão tem prioridade na etiqueta, mas as contagens de maior/igual/menor mostram também os empates. Não há percentuais de probabilidade, teste de significância ou intervalo de confiança. A ressalva limita estabilidade às hipóteses avaliadas.

## Visualização e consulta

Três faixas de diferenças, mesma escala simétrica para o par e zero explícito. Losango identifica a cesta original; cor não codifica qualidade da gestão. A amplitude da escala adapta-se ao par, não à família. Limites e contagens têm equivalentes textuais; marcas decorativas ficam fora da árvore acessível. Expansão nativa reúne as 38 hipóteses distintas em três tabelas, incluindo pesos efetivos de cada cenário. A troca de território/comparador atualiza tudo usando a seleção e URL do Atlas.

As faixas individuais por cidade foram preservadas em expansão separada e receberam advertência sobre a subtração indevida de extremos.

## Evidências

21 testes focados e TypeScript passaram. Cinco testes adicionais cobrem reconciliação dos 37 pares com inversão e três empates desfeitos, 31 pesos únicos, simetria da troca de cidades, limites pareados conhecidos, resíduos numéricos, autopares, ausência e apresentação no HTML.

Montagem local com React e CSS reais inspecionada em 320, 390, 768 e 1440 px sem overflow horizontal. Expansão das tabelas acionada por Enter; tabela aberta também sem overflow em 320 px. Conferidos no navegador: Recife × Belém chega a empate nos pesos, Recife × Salvador inverte, Belém × Salvador desfaz empate de referência. Recife × Curitiba mantém a ordem nas três famílias, verificado no teste de contrato.

Não equivale à validação integrada Next desta entrega. Leitor de tela e zoom nativo 200% continuam pendentes. Sem declaração de conformidade integral ou homologação metodológica.

Autoavaliação da seção: direção de arte 8; hierarquia 9; tipografia 8; densidade 8; didática 9; comparabilidade 9; interação/acessibilidade 8; responsividade 8. Evidência: escala comum, estados textuais, consulta por teclado e quatro larguras. Limites: revisão local, página ainda longa, ausência de avaliação independente e testes com usuários.

## Próximo trabalho

Conferir CI e implantação Next. Consolidar a navegação da página para tornar a primeira leitura mais curta, mantendo decomposição, robustez e fontes acessíveis. A estabilidade metodológica não libera publicação oficial nem resolve a cobertura dos demais capítulos.
