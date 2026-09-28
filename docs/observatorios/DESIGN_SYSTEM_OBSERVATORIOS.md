# Design system dos observatórios

A família visual é a da Scrutiniums: tipografia, grid, filetes, rótulos em caixa alta, espaço negativo. Cada observatório tem **um** acento. Nada de gradiente decorativo, neon, gauge sem régua ou tela de trading.

## Tokens

| Token | Valor | Uso | Contraste sobre marfim / papel / branco |
| --- | --- | --- | --- |
| `carvao` | `#1A1D21` | texto principal | 14,7 / 15,9 / 16,9 |
| `bronze` | `#966B48` | acento do Crédito e da marca | 4,1 / 4,4 / 4,7 (só texto grande ou marcação) |
| `energia` | `#0E6170` | acento do Setor Elétrico (teal sóbrio) | 6,2 / 6,7 / 7,1 |
| `energia-dark` | `#0A4A56` | hover, foco, texto de destaque | 8,6 / 9,3 / 9,9 |
| `energia-soft` | `#5E98A3` | marcação não textual (filetes, áreas) | 2,8 / 3,0 / 3,2 (nunca texto) |
| `energia-fundo` | `#E6EEEE` | estado ativo e faixas de destaque do domínio | fundo; texto sobre ele só em `carvao`, `carvao-muted`, `energia` ou `energia-dark` (`mineral` fica em 4,43:1) |
| `superficie` | `#FFFFFF` | superfícies de painel no Setor Elétrico | fundo |
| `preco` | `#7A2E4D` | série e tom de mapa do PLD (`--serie-pld`); `preco-soft` e `preco-fundo` para faixa e fundo | 7,9 / 8,5 / 9,0 |
| `mapa.terra`, `mapa.borda` | `#EDE8DC`, `#C9C2B2` | terreno e divisas do mapa esquemático (`--cor-mapa-terra`, `--cor-mapa-borda`) | fundo; nunca texto |
| `--serie-nuclear`, `--serie-biomassa` | `#6B4C9A`, `#4F7A2E` | reservados para a desagregação futura da térmica | só marcação |

Regra herdada: nenhum hexadecimal solto em componente. Os tokens entram em `tailwind.config.ts` e em `globals.css` (`--cor-energia*`). SVG de gráfico usa as variáveis CSS (`var(--cor-mineral)`, `var(--cor-grade)`, `var(--serie-*)`), nunca o hexadecimal. O teste `design-tokens-energia.test.ts` confere contraste AA dos tokens de texto sobre `superficie`, `papel` e `energia-fundo`, a ausência de hexadecimal solto nos componentes do domínio e que `energia-soft` nunca vira cor de texto.

## Selos de natureza do dado

Forma, glifo, rótulo e cor ao mesmo tempo; cor nunca é o único portador.

| Selo | Glifo | Borda | Cor | Significado |
| --- | --- | --- | --- | --- |
| OBSERVADO | ● | contínua | `#1A1D21` | valor publicado diretamente pela fonte primária |
| CALCULADO | ◆ | contínua | `#4A5158` | transformação determinística feita pela Scrutiniums, com fórmula |
| ESTIMADO | ◐ | contínua | `#7A5A12` | procedimento estatístico |
| PREVISTO | ◌ | tracejada | `#5B3F8C` | período futuro, sempre com modelo e versão |
| CENÁRIO | ◇ | pontilhada | `#6B4F3A` | simulação condicional; nunca previsão |

Componente: `SeloNatureza` (`src/components/evidencia/SeloNatureza.tsx`). Todo número de indicador leva selo; o tipo `Indicador` torna `natureza` obrigatória.

## Regra editorial incorporada ao componente

Toda visualização relevante é um `PainelEvidencia` com seis campos obrigatórios, na ordem:

1. **O que estou vendo?** (título em forma de pergunta ou conclusão, e subtítulo `indicador · unidade`)
2. **Por que isso importa?**
3. **O que mudou?**
4. **Como devo interpretar?**
5. **O que NÃO posso concluir?**
6. **Qual é a fonte?** (proveniência completa, drawer "Sobre este dado")

A obrigatoriedade é de tipo (TypeScript): um painel sem "o que não posso concluir" não compila.

## Componentes de evidência (compartilhados)

| Componente | Função |
| --- | --- |
| `SeloNatureza` | selo da taxonomia |
| `SobreEsteDado` | drawer de proveniência (diálogo acessível, Esc fecha, foco preso) com os campos do `MODELO_AUDITABILIDADE.md` |
| `PainelEvidencia` | bloco editorial de seis perguntas com gráfico e rodapé de fonte |
| `Indisponivel` | estado de ausência: motivo, última execução, informação faltante, estado do pipeline. Nunca exibe zero |
| `NumeroIndicador` | número grande com selo, período, variação e posição histórica |
| `ModoProfundidade` | alternância Entender, Analisar, Auditar sobre a mesma página |
| `Termo` | sigla com dica curta e link para o verbete completo |

## Gramática visual do Setor Elétrico

Quando usar mapa, Sankey, fan chart, heatmap, small multiples, infográfico e os demais tipos, com interações, cores, tooltip e celular por tipo, está em [DESIGN_VISUAL_GRAMMAR_ENERGIA.md](./DESIGN_VISUAL_GRAMMAR_ENERGIA.md). A avaliação página a página, com capturas antes e depois e notas em treze dimensões, está em [AVALIACAO_VISUAL_ENERGIA.md](./AVALIACAO_VISUAL_ENERGIA.md).

Componentes visuais do domínio (`src/components/energia`): `MetricaHero`, `Sparkline`, `IconeSetor`, `MapaBrasil`, `MapaVivo`, `SistemaEmUmaTela`, `LinhaDoDia`, `DiagramaFormacao`, `FanChart`, `PrevisaoPld`, `ExplicadorIncerteza`, `MaquinaDoTempo`, `ColunasReservatorio`, `SankeyFontes`, `EvolucaoMatriz`, `HeatmapCalendario`, `AbasVisoes`, `EsquemaConceitual`, `MapaConceitual`, `InfograficoSistema`, `VisualConceito`, `LinhagemDados`, `PipelineEstados`, `CatalogoFiltro`. Na home: `PainelObservatorio`, `MiniaturaEnergia`, `MiniaturaCredito`, alimentados por `src/lib/amostras.ts` com dado real e data de referência.

## Gráficos

* Um gráfico só entra se responde a uma pergunta escrita no título. Ex.: "Quanta água está chegando ao Sudeste/Centro-Oeste?" com subtítulo `ENA · % da MLT`.
* Todo gráfico tem unidade, período, fonte, data de referência, tooltip, link de metodologia e download quando pertinente.
* Paletas validadas com o verificador de daltonismo da skill de visualização (ordem fixa; separação CVD entre séries adjacentes acima de 8; visão normal acima de 15). A primeira proposta (tons terrosos) falhou no piso de croma e na separação CVD e foi substituída. Fontes, nesta ordem: hidráulica `#256ABF`, térmica `#D95926`, eólica `#199E70`, solar `#C98500` (solar abaixo de 3:1 exige rótulo direto e tabela). Submercados: SE/CO `#4A3AA7`, S `#199E70`, NE `#D95926`, N `#2A78D6`. Sempre com rótulo direto no fim da linha e legenda; texto nunca na cor da série.
* Ausência é lacuna na linha, nunca zero. Previsão tracejada com faixa; cenário pontilhado.

## Tipografia e ritmo

Títulos em serifa, texto em Inter 16 a 18 px, rótulos em Archivo Narrow caixa alta com tracking 0,14em. Números em algarismos tabulares. Números grandes só para o indicador principal de cada bloco.

## Acessibilidade

WCAG 2.2 AA: contraste de texto 4,5:1, alvos de toque de 44 px, foco visível na cor do acento, `prefers-reduced-motion` respeitado, tabelas equivalentes para todo gráfico, dicas acessíveis por teclado e toque.

## Mobile

Narrativa preservada em coluna única; cartões de submercado em grade 2×2; tabelas viram listas de definição; mapas escondem os chips e mostram a lista de regiões; Sankey vira barras de mix; grades de etapas quebram em duas colunas; nenhuma rolagem horizontal em página alguma (a captura de auditoria mede o estouro em 390 px e exige zero); drawer de proveniência em tela cheia.
