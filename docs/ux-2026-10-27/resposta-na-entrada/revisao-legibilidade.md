# Resposta na entrada — reavaliação independente de legibilidade

27/10/2026. Commit `38c543ae5e536d23f470a3640c8746bc6bdec60a`; build `joprJiw7FCX_7Z-nqHMuN`. O build foi confirmado antes de abrir o navegador. Correção iniciada em `4e404555b`; nenhum julgamento abaixo usa o build anterior.

**Decisão: os dois P1 da revisão anterior estão resolvidos no escopo reproduzido.** Combustíveis conserva centavos e milhares juntos; Educação passa a uma coluna quando o espaço não comporta as duas etapas ampliadas. Número, unidade e etapa voltam a constituir uma leitura contínua. A estrutura das cinco entradas aprovada anteriormente pode ser encerrada com esta revisão complementar, mantendo os limites de evidência daquele parecer.

Há um acabamento residual P2 em Combustíveis: a 320 px com raiz a 200% e 1.000 litros, a quantia inteira ocupa cerca de 13 px da margem direita do bloco. Ela continua dentro da tela, legível, sem corte nem rolagem horizontal. Isso não repete o P1 de número partido, mas impede afirmar que todo texto fica estritamente dentro da largura do próprio bloco.

## Escopo executado

- Chromium `/usr/bin/chromium`, servidor local pelo helper do projeto, sessão autenticada, um navegador por vez. Não editei o repositório, não rodei testes globais nem build.
- 30 cenários: larguras 320 e 390; raiz normal e a 200%; 40, 60 e 1.000 litros nos quatro produtos de Pernambuco; Educação com Recife, São José do Vale do Rio Preto e Fernando de Noronha; volume inválido zero; busca ampliada do nome longo por teclado e da ausência por toque simulado.
- Todos os valores numéricos existentes foram medidos por `Range.getClientRects()`, além da largura do documento, posição do texto e fonte computada. Inspecionei as capturas dos valores e das aberturas; fiz uma conferência adicional específica de 1.000 litros a 320/200.
- Evidências novas em `/workspace/resposta-revisao-legibilidade/`. As capturas próprias dos defeitos continuam em `/workspace/resposta-revisao-final/`; a candidata anterior também está preservada em `/workspace/resposta-evidencias/candidata-304b/`.
- O teste de raiz a 200% continua sendo uma simulação de ampliação de unidades relativas. Não duplica textos definidos em px e não constitui auditoria de zoom nativo, leitor de tela ou WCAG integral. Não houve teste com pessoas ou aparelho móvel físico.

## P1-1 — quantias do combustível

Antes, 320/200 mostrava `R$ 273,` e depois `60 para 40`. Agora o símbolo pode ocupar uma linha e a quantia permanece indivisível na linha seguinte. A unidade acompanha em linha própria quando necessário.

| Caso em Pernambuco | Gasolina observada | Resultado visual |
|---|---|---|
| 40 litros | R$ 273,60 | Centavos juntos em 320/390, normal e ampliado. |
| 60 litros | R$ 410,40 | Conta correta e quantia inteira nas quatro combinações. |
| 1.000 litros | R$ 6.840,00 | Milhar e centavos juntos nas quatro combinações; observação de margem em 320/200 abaixo. |
| 0 litros | R$ 6,84 por litro | Aviso de volume inválido preservado; não apresenta tanque de zero nem NaN. |

As quatro quantias de produto são indivisíveis. A 1.000 litros: gasolina 6.840,00, etanol 4.930,00, diesel 7.420,00 e diesel S10 7.050,00. Fonte, mês, amostra, preço por litro e diferença identificada por litro permanecem junto dos resultados. O tamanho computado do número é 28 px normal e 56 px ampliado; a correção não reduziu a fonte para caber.

Evidências: [40 litros em 320/200](revisao-legibilidade/evidencias/combustiveis-320-texto200-40L.jpg), [60 litros](revisao-legibilidade/evidencias/combustiveis-320-texto200-60L.jpg), [1.000 litros](revisao-legibilidade/evidencias/combustiveis-320-texto200-1000L.jpg), [volume inválido](revisao-legibilidade/evidencias/combustiveis-320-texto200-volume-invalido.jpg).

**Observação P2, sem bloqueio do aceite de legibilidade:** em 320/200, cada quantia de quatro algarismos inteiros tem 236,8 px num bloco de 224 px, de x=48 a x=284,8. O bloco termina em x=272; a tela termina em x=320. Há portanto avanço de 12,8 px sobre a margem, sem invasão de outro conteúdo, perda de dígito ou aumento da largura do documento. A captura aproximada confirma a leitura integral. Convém acomodar o espaço do número em um acabamento futuro, preservando tamanho e unidade; não é necessário voltar a permitir quebra de algarismos.

## P1-2 — Ideb e unidade no extrato

Antes, 320/200 mantinha duas colunas e quebrava `5,8` em `5,` / `8` e `4,9` em `4,` / `9`. Agora cada valor e `de 0 a 10` ficam juntos em uma coluna com a etapa e sua referência.

| Largura / raiz | Colunas medidas do extrato | Leitura |
|---|---|---|
| 320 / normal | Uma, 230 px | Primeiro valor e unidade inteiros; os anos finais vêm em seguida. |
| 390 / normal | Duas, 142 px cada | As duas etapas conservam a apresentação compacta anterior. |
| 320 / 200% | Uma, 182 px | 5,8 de 0 a 10 e 4,9 de 0 a 10 sem separação dos decimais ou da unidade. |
| 390 / 200% | Uma, 252 px | Mesma leitura contínua; referências e link da ficha permanecem acessíveis. |

O tamanho computado do número continua 32 px normal e 64 px ampliado. A correção redistribui espaço, sem diminuir o número. Na abertura normal a 320, o primeiro valor de Recife termina agora em y=854,4, dentro dos 900 px; antes terminava em y=913,7. A 390, continua terminando em y=825,0. A ressalva anterior da pequena rolagem na abertura de 320 deixa de se aplicar a esse estado de Educação; continua válida para o estado capturado de Combustíveis, cujo valor termina em y=913,2.

O nome longo **São José do Vale do Rio Preto** permanece completo; UF, etapas, 5,9/4,9 e escala continuam distinguíveis. **Fernando de Noronha** conserva “Sem Ideb 2025” nas duas etapas e o motivo de ausência, sem trocar por valor de outra rede ou edição. Não há número falso para acomodar o estado vazio.

Evidências: [Recife 320/200](revisao-legibilidade/evidencias/educacao-320-texto200-recife.jpg), [Recife 390/200](revisao-legibilidade/evidencias/educacao-390-texto200-recife.jpg), [nome longo 320/200](revisao-legibilidade/evidencias/educacao-320-texto200-nome-longo.jpg), [ausência 320/200](revisao-legibilidade/evidencias/educacao-320-texto200-ausencia.jpg), [abertura normal a 320](revisao-legibilidade/evidencias/educacao-320-texto100-inicio.jpg).

## Interação e registro automático

A busca de São José do Vale do Rio Preto por teclado e a troca para Fernando de Noronha por toque simulado funcionaram em 320/390 com raiz ampliada. Os recortes resultantes foram respectivamente `3305158` e `2605459`; o resultado acompanhou a escolha. Não houve erro de execução de página.

O roteiro original registrou **29 de 30 cenários aprovados automaticamente**. A única falha foi o critério adicional e mais estrito “quantia dentro do próprio bloco” para 1.000 litros em 320/200. Preservei esse resultado. A conferência posterior mediu e fotografou o avanço de 12,8 px descrito acima; confirmou o cumprimento do aceite original — quantia indivisível, conteúdo inteiro e nenhuma rolagem horizontal do documento. Não apresento o registro como 30/30 sem ressalvas, nem classifico a falha de alinhamento como novo bloqueio da consulta.

Registros: [30 cenários](revisao-legibilidade/evidencias/resultados.json), [conferência adicional de 1.000 litros](revisao-legibilidade/evidencias/conferencia-1000L.json), [roteiro](revisao-legibilidade/evidencias/revisao.mjs).

Esta revisão substitui apenas a pendência P1-1/P1-2 da [avaliação anterior](revisao-candidata.md). Mantém as aprovações estruturais e as demais limitações registradas. Não altera as notas anteriores para produzir uma média ou nota 9: a nova evidência permite encerrar os bloqueios específicos de legibilidade, com a observação P2 de alinhamento documentada.
