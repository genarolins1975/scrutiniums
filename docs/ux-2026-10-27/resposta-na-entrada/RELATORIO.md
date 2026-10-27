# A resposta específica na entrada

Pedido do dono em 27/10/2026: “Entregar a resposta específica logo na entrada”. Esta etapa implementa o item 2 do conselho. Não altera as regras de acesso, não usa geolocalização nem atributos da conta e não muda fórmulas ou golds.

## O que muda para o leitor

As cinco entradas passam a reunir pergunta, escolha explícita e resposta do recorte antes do panorama nacional e dos caminhos “Para você”. O contexto continua no HTML, em blocos expansíveis do design system; séries, tabelas, metodologia e destinos são preservados.

| Entrada | Resposta prioritária | Contexto e aprofundamento preservados |
| --- | --- | --- |
| Custo de vida | IPCA da área escolhida, janela de 12 meses e comparação com o Brasil | Nove grupos, pesos, séries, comparação de áreas, modelo e downloads. A ressalva explica que uma cidade fora da lista não tem IPCA próprio. |
| Combustíveis | Custo calculado do tanque, a partir do estado e dos litros; média observada por litro e amostra próximas | Distância para a média brasileira explicitamente **por litro**, séries, UFs, etanol/gasolina, notas da ANP e downloads. |
| Conectividade | Acessos por 100 habitantes, fibra e cobertura 5G do município; Brasil no mesmo período | Operadoras, 4G, linhas móveis, séries, distribuições, tabelas e limites no detalhe alcançável pelo resumo. Percentual de fibra identificado como calculado. |
| Educação municipal | Busca e extrato do município reunidos; Ideb por etapa, ausência e referência nomeadas | Ficha privada, laboratório, séries, metas, Censo Escolar, comparações e downloads. |
| Síntese das capitais | Sete resultados da capital escolhida, com a segunda capital, fontes, períodos e ressalvas | Régua das 26 posições, contexto territorial, medianas, recursos, educação, mapa de temas e modelo. As medianas deixam de abrir uma pergunta sobre uma capital específica. |

Rotas principais: `/custo-de-vida`, `/combustiveis`, `/conectividade`, `/educacao-municipal`, `/eficiencia-estatal`. Os componentes reutilizados também recebem ajustes de legibilidade nas consultas `/custo-de-vida/na-minha-cidade` e `/combustiveis/no-meu-estado`. Os aperitivos e arquivos continuam com as regras de acesso existentes.

## Linha de base e rastreabilidade

Base: `8a7cd80b27e5110f0024236fc73ae1fabb61de69`. Capturas novas da base em `antes/`, a 390 e 1440 px, com e sem sessão, geradas por `npm run evidencias`. O [registro do conselho](antes/medicoes-conselho.json) mediu os controles a 390 × 900 px: Custo de vida 2.522 px; Combustíveis 2.607 px; Conectividade 2.724 px; Educação 2.417 px; Síntese 2.385 px. São coordenadas no documento; não são tempos de tarefa nem taxas de conversão.

A rodada intermediária registrou falhas reais: conta de combustível abaixo da borda inicial, diferença de preço sem unidade repetida, natureza genérica na Conectividade e Síntese acima do orçamento de comprimento. Os pareceres independentes e o log focalizado preservam essa história. As capturas intermediárias não são evidência do código final.

O relatório final de navegador registra build, commit, posição do controle e do primeiro valor, largura do documento e fonte computada. As capturas posteriores devem corresponder ao commit de implementação indicado no fechamento.

## Arquitetura e contratos

`EntradaColecao` ganha uma fatia opcional `resposta`, antes da escala, e um título explícito para recolher o contexto. As outras entradas mantêm o contrato anterior. A ordem é a do DOM, também usada pelo teclado. `ParaVoce` continua sendo um conjunto de caminhos; a consulta deixa de ficar escondida depois desses cartões.

Os testes de ordem foram atualizados com o pedido de 27/10/2026 citado no código. O teto de comprimento permanece 6.500 px no desktop e 11.000 px no celular. O orçamento inicial passa a medir o primeiro **valor** da resposta; sem município escolhido, mede a busca. O teste novo exige build, quatro larguras e jornadas de recorte; nenhum teste foi apagado, afrouxado ou marcado para pular. Nesta branch, `verificar:rapido` precisa de build prévio porque inclui a jornada nova; o CI já constrói antes dos testes.

## Verificação e limites

Código avaliado: [38c543ae5e536d23f470a3640c8746bc6bdec60a](https://github.com/genarolins1975/scrutiniums/commit/38c543ae5e536d23f470a3640c8746bc6bdec60a). Build `joprJiw7FCX_7Z-nqHMuN`. Ambiente: Node 24.19.0, Chromium 154.0.8037.57 do sistema. O Chromium fixado pelo Playwright não pôde ser baixado; o executável usado está registrado nos comandos.

### Posição da escolha e do primeiro valor

390 × 900 px, posição no documento. Antes: estado inicial do conselho na base. Depois: recortes explícitos usados nas jornadas (Recife/PE e São Paulo/Curitiba). Não são medidas de conversão nem tempo de tarefa.

| Entrada | Controle antes | Controle depois | Primeiro valor inteiro até | Altura total depois |
| --- | ---: | ---: | ---: | ---: |
| Custo de vida | 2.522 px | 518 px | 789 px | 7.661 px |
| Combustíveis | 2.607 px | 483 px | 823 px | 10.357 px |
| Conectividade | 2.724 px | 495 px | 724 px | 8.357 px |
| Educação municipal | 2.417 px | 538 px | 825 px | 7.801 px |
| Síntese das capitais | 2.385 px | 498 px | 759 px | 9.996 px |

As cinco entradas selecionadas também ficam abaixo de 6.500 px a 1440. A 320 × 900, os controles permanecem na primeira tela, mas o primeiro valor completo de Combustíveis termina em 913 px: são necessários cerca de 13 px de rolagem. Educação termina agora em 854 px, após a revisão de colunas. Isso não é transbordamento ou corte do conteúdo, mas impede prometer valor inteiro na primeira tela para todo estado nessa largura.

### Matriz de acessibilidade e interação

| Verificação | Evidência e alcance |
| --- | --- |
| Estrutura, nomes e contraste automáticos | 20 recortes selecionados, em 320/390/768/1440 px, sem violações axe nas regras WCAG 2 A/AA, 2.1 AA e 2.2 AA executadas. Detalhes inicialmente fechados não equivalem a auditoria de todo conteúdo expandido. |
| Largura do documento | Sem transbordamento nos 20 casos, normal e raiz tipográfica de 32 px (200%); `scrollY`, fontes computadas e retângulos registrados. |
| Escolha e primeiro valor | Posição medida, sem usar apenas o topo da região da resposta como prova. Limite de 320 px registrado acima. |
| Estado, teclado e dados | Jornada de build confere seleção, URL, retorno/recarga, busca com Escape/Enter, valores da gold e expansão dos grupos. |
| Expansão da análise | Links do resumo abrem os detalhes municipais e a régua das capitais; tabelas preservadas e acessíveis. |
| Revisão separada | Parecer visual e jornadas instrumentadas em sessão independente, além da revisão mecânica de código. |
| Leitor de tela, pessoas e aparelho físico | Não verificados. Não há declaração de WCAG integral nem de conversão comprovada. |

### Comandos e estado real

| Comando | Resultado e versão |
| --- | --- |
| `bash scripts/preparar-sessao.sh` | Dependências e derivados preparados; Chromium fixado indisponível, usado o Chromium do sistema. |
| `npm run verificar:pr` | Todas as etapas fora do Vitest passaram; 9.671 testes passaram e dois testes novos de ampliação falharam. Falhas corrigidas, registro preservado. |
| `npm run verificar:pr -- --etapas build,vitest` | Commit `304b6dba`: build aprovado e 9.673 testes aprovados em 412 arquivos; 12 skips e 1 todo preexistentes. Árvore permaneceu igual durante a execução. |
| `npm run build` | Código final `38c543ae5`: aprovado, após os dois ajustes adicionais pedidos pela revisão visual. |
| `npm run verificar:rapido` | Código final `38c543ae5`: lint, tipos, derivados, cobertura e 2.250 testes afetados aprovados em 67 arquivos; um skip preexistente. Inclui o teste novo que conserva centavos e Ideb em uma linha, com 40/60/1.000 litros. |
| `npm run evidencias` | Antes e depois, cinco rotas a 390/1440, com/sem sessão. Resultado final em [depois/evidencias.md](depois/evidencias.md). As entradas fechadas continuam redirecionando ao login sem sessão. |
| `node scripts/evidencias-resposta-entrada.mjs <saída>` | 20 recortes selecionados nas quatro larguras: nenhum erro de página, violação axe ou transbordamento do documento normal/ampliado. [Registro](jornadas/jornadas.json). |

A suíte integral não foi repetida depois dos dois últimos ajustes de apresentação; nesses arquivos, foram repetidos o build, os 2.250 testes afetados e a revisão visual independente. Os resultados da suíte integral e dos testes do código final estão separados acima. Nenhum teste foi removido, marcado como skip/todo/only ou afrouxado para aprovar a mudança. Os logs guardam falhas iniciais e resultados posteriores; execuções interrompidas para aplicar achados não foram contadas como aprovação.

### Parecer independente e ressalvas restantes

A [revisão da candidata](revisao-candidata.md) avaliou as oito dimensões e encontrou dois P1 que o teste de overflow não revelava: dinheiro e Ideb partidos entre linhas. A [reavaliação final](revisao-legibilidade.md), em sessão separada, encerrou ambos com novas capturas e 30 cenários. Dos 30, 29 passaram o critério automático estrito; um registrou o acabamento P2 abaixo, preservado no JSON. As jornadas anteriores incluíram teclado, toque simulado, retorno/recarga, ausência, nome longo e expansão de análises.

- **P2 de acabamento:** a 320 px, raiz a 200% e 1.000 litros em Pernambuco, `6.840,00` avança 12,8 px sobre a margem interna. Continua inteiro, legível e dentro da tela, sem sobrepor outro dado ou causar rolagem horizontal do documento. Não foi ocultado nem reclassificado como teste aprovado.
- **Primeira tela estreita:** no recorte PE a 320 × 900, o primeiro valor de combustível exige cerca de 13 px de rolagem. Nas cinco páginas a 390, valor e unidade ficam inteiros na primeira tela.
- **Fidelidade dos litros:** a recarga mantém a UF, mas volta ao exemplo de 40 litros, limitação preexistente do item 3 do conselho.

A decisão é encerrar o objetivo de **escolha e resposta na entrada**, com as ressalvas documentadas. Não se declara nota 9 em todas as dimensões, homologação humana ou conformidade WCAG integral.

### Como reproduzir

```bash
bash scripts/preparar-sessao.sh
NODE_OPTIONS=--max-old-space-size=4096 npm run build
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run verificar:rapido
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run verificar:pr
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run evidencias -- --rotas /custo-de-vida /conectividade /combustiveis /educacao-municipal /eficiencia-estatal --larguras 390,1440 --saida docs/ux-2026-10-27/resposta-na-entrada/depois
I18N_CHROMIUM_EXECUTABLE=/usr/bin/chromium node scripts/evidencias-resposta-entrada.mjs docs/ux-2026-10-27/resposta-na-entrada/jornadas
```

Na revisão independente, os roteiros e os erros do próprio coletor também foram preservados. Eles não são os testes de aceitação do repositório. A diferença entre resultado automático, inspeção visual e homologação humana permanece explícita.


Não houve teste com pessoas, leitor de tela, zoom nativo ou dispositivo físico. A ampliação usa raiz tipográfica a 200%, com fontes computadas registradas; a largura de 720 px simula a geometria de reflow de 1440 px a 200%. Seleções na URL continuam sendo aplicadas na hidratação, sem atribuir a escolha padrão à localização do leitor.

Esta etapa não foi mesclada nem publicada em produção.

## Índice das evidências

- [Antes: capturas novas da base](antes/evidencias.md).
- [Depois: estado inicial com e sem sessão](depois/evidencias.md).
- [Depois: recortes escolhidos, quatro larguras e texto ampliado](jornadas/jornadas.json).
- [Avaliação visual anterior](revisao-layout-antes.md) e [diagnóstico mecânico](revisao-mecanica-antes.md).
- [Revisão mecânica final](revisao-mecanica-final.md), [parecer da candidata](revisao-candidata.md) e [encerramento dos P1](revisao-legibilidade.md).
- [Verificações e logs](verificacoes/).
