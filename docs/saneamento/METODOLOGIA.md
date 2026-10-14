# Método do Observatório Brasileiro do Saneamento

A versão pública desta página está em `/saneamento/metodologia`. Este documento registra as decisões para quem mantém o código.

## Contrato metodológico

1. **Grão explícito.** Morador, domicílio, economia, imóvel, volume, município, prestador, vínculo prestador × município ou estação. Grãos diferentes não se somam nem se dividem entre si.
2. **Sem média de percentuais.** Territórios agregam por Σ numerador ÷ Σ denominador. Censo: tabulação do IBGE em cada nível (a soma municipal reproduz o Brasil, conferido em teste). SINISA: consolidado oficial por UF, região e Brasil. NR 8: não há agregado oficial; soma de numeradores e denominadores municipais.
3. **Zero, ausência e não informado.** Zero declarado é zero. Vazio é `null` e aparece como "sem dado", com o motivo publicado pelo SINISA quando existe (`nao_calculado_divisao_zero`, `nao_calculado_condicoes`, `nao_calculado_campos_vazios`, `ver_prestador`). Nada é preenchido.
4. **Valores nominais.** Reais correntes do ano de referência; nenhuma série monetária mistura anos.
5. **Validade temporal.** Censo 2022 e SINISA 2024 ficam lado a lado, nunca na mesma razão. Tabelas tarifárias valem pela vigência do ato.
6. **Sem imputação.** Município fora de um módulo fica fora da soma e a cobertura é informada.
7. **Sem dado pessoal.** Bases agregadas por município, prestador ou estação.
8. **Divergências explicadas.** Calculadas, publicadas em `meta.json` e na página de método; nunca redistribuídas.

## Medidas municipais (`src/lib/saneamento/medidas.ts`)

| Medida | Numerador | Denominador | Fonte |
|---|---|---|---|
| Sem ligação à rede geral de água | Moradores sem ligação | Moradores em DPP ocupados | Censo 2022 |
| Ligados à rede com outra fonte principal | Moradores ligados que usam outra fonte | Moradores | Censo 2022 |
| Sem rede geral, pluvial ou fossa ligada | Moradores − moradores com rede | Moradores | Censo 2022 |
| Sem rede nem fossa séptica | Fossa rudimentar, vala, corpo d'água, outra forma, sem banheiro | Moradores | Censo 2022 |
| Não atendidos por rede de água ou de esgoto | DFE0001 − (GTA0001 + GTA0002) ou − (GTE0001 + GTE0002) | DFE0001 | SINISA 2024 |
| Variação da rede de água e de esgoto | p.p. entre 2010 e 2022 da mesma categoria | Moradores de cada Censo | Censos 2010 e 2022 |
| Esgoto tratado sobre coletado (IES2004) e sobre consumido (IES2003) | Indicador oficial | Indicador oficial | SINISA 2024 |
| IAA e IAE da NR 8, parcela de rede | GTA0009 + GTA0016; GTE0009 + GTE0019 | População estimada 2024 ÷ moradores por domicílio do Censo 2022 | SINISA 2024, IBGE, ficha da NR 8 |
| Investimento por habitante | GFI2024 + GFI2036 + GFI2124 + GFI2136 | DFE0001 dos municípios declarantes | SINISA 2024 |

## Conferências registradas

- **População do esgoto.** 173.640.502 (2.749 municípios com indicadores) + 14.615.404 (1.154 com delegação sem atendimento) = 188.255.906 = consolidado Brasil.
- **Água retificada.** A soma municipal retificada da população atendida (174.018.231) é igual ao consolidado Brasil.
- **Investimento.** A soma municipal (prestador + Estado, parcelas informadas) reproduz o consolidado Brasil em água (R$ 14.592.643.032,54) e esgoto (R$ 13.681.999.367,15). A soma dos vínculos prestador × município reproduz o consolidado por origem de recursos.
- **Eficiência Estatal.** Os 429 valores consolidados em comum com `public/eficiencia/saneamento/` são idênticos.

## Prestadores (`src/lib/saneamento/prestadores.ts`)

Fórmulas oficiais aplicadas às somas do prestador em todos os municípios: perdas (IAG2013), micromedição (IAG2002), despesa de exploração por m³ (IFA2004), margem líquida (IFB3005), endividamento (IFB3003). Receita direta por m³ faturado = GFI1001 ÷ GTA1221 (não desconta volume exportado; declarado na nota). Balanço publicado pelo SINISA em milhares de reais (`1000R$/ano`), convertido para reais na ficha.

## Simulador da conta

Tabela por categoria com parte fixa, valor mínimo que cobre os primeiros m³ e faixas cobradas por m³ acima do início da faixa; esgoto por tabela própria ou percentual da água. Aritmética inteira em escala 10⁷, arredondamento ao centavo no fim. Os exemplos de cada tabela são conferidos em Decimal no gerador e em teste automatizado. Na tarifa social, quando o esgoto da categoria não foi verificado, a comparação usa só a água dos dois lados.

## Planejamento

Ritmo aritmético = (meta − valor de 2024) ÷ 9 anos (2025 a 2033), sobre IAG0004 e IES0007 consolidados. Não é projeção. A referência histórica (variação anual da rede de esgoto entre os Censos) é outra medida e está rotulada como tal. Nenhum município é declarado em cumprimento ou descumprimento de meta: faltam ICA, ICE e soluções alternativas.

## Investimento × carência

Municípios declarantes ordenados pela proporção de moradores sem rede nem fossa séptica (Censo 2022) e divididos em cinco grupos com o mesmo número de municípios; em cada grupo, investimento somado ÷ população somada. Descritivo, períodos diferentes declarados.

## Tarifa social e CadÚnico

Denominador: famílias do CadÚnico com renda familiar per capita até meio salário-mínimo (`cadun_qtd_familias_cadastradas_rfpc_ate_meio_sm_i`), MDS, SAGI, API MI Social, dezembro de 2024 (mesmo ano do SINISA) e setembro de 2026 (mais recente publicado), com sha256 de cada consulta. O MDS publica o código do município com 6 dígitos; a junção usa os 6 primeiros do código IBGE. Conferência: até meio salário-mínimo + acima = total de famílias em todos os 11.141 registros municipais dos dois meses. Numerador: economias residenciais com tarifa social de água (GFI1036), somadas sobre os prestadores de água do município. Estado do município: oferece (algum prestador declara tarifa social), não oferece (todos declaram que não; conta zero), sem resposta (fica fora). Razão = Σ economias ÷ Σ famílias × 100, no mesmo universo de municípios. Não é percentual de famílias atendidas: economia não é família, parte das famílias não tem ligação ou não é titular da conta, e critérios locais podem incluir quem não está no CadÚnico. O BPC não é somado: desde o Decreto 8.805/2016 a inscrição no CadÚnico é requisito do benefício, e o MDS o publica por beneficiário.


Regra da Lei 14.898/2024, arts. 2º e 6º (renda per capita até meio salário-mínimo, CadÚnico ou BPC; 50% sobre a primeira faixa nos primeiros 15 m³). Salário-mínimo de 2026: R$ 1.621,00 (Decreto 12.797/2025, conforme Ministério da Previdência Social, gov.br, 05/01/2026). Cenários de peso da conta na renda usam famílias de 3 e 4 pessoas exatamente no limite e 10 m³; são cenários, não medidas. O valor médio da tarifa social declarado ao SINISA (GFI1037) tem registros incompatíveis com conta mensal e não é publicado.
