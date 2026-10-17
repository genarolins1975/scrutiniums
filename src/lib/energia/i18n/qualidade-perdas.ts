import { createElement, type ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

/**
 * Tabelas de tradução do grupo Qualidade e Perdas: rótulos e frases que chegam prontos da gold
 * (public/energia/gold/qualidade.json e perdas.json). Cada chave é o texto português exato da
 * gold; valor sem entrada aqui não é traduzido por aproximação: a página inglesa o mostra em
 * <TrechoPortugues> (ver traduzOuMarca). Gerado a partir da gold publicada; ao mudar a frase na
 * gold, a entrada antiga deixa de casar e o trecho volta marcado como só em português.
 */

/** Tradução exata de um texto da gold, ou null quando a tabela não tem a frase. */
export function traducaoExata(pt: string | null | undefined, tabela: Readonly<Record<string, string>>): string | null {
  if (!pt) return null;
  return Object.prototype.hasOwnProperty.call(tabela, pt) ? tabela[pt] : null;
}

/** Texto da gold no idioma da página: português como está; inglês pela tabela, ou o original marcado como só em português. */
export function traduzOuMarca(pt: string | null | undefined, tabela: Readonly<Record<string, string>>, idioma: Idioma, regiao: string): ReactNode {
  if (!pt) return pt ?? null;
  if (idioma !== "en") return pt;
  return traducaoExata(pt, tabela) ?? createElement(TrechoPortugues, { regiao }, pt);
}

/** Classificação da distribuidora como a ANEEL a publica. */
export const CLASSIFICACAO_EN: Record<string, string> = {
  "Concessionária": "Concession holder",
  "Permissionária": "Permit holder",
  "Permissionária de Serviço Público de Distribuição": "Public distribution service permit holder",
};

/** Porte no ranking da continuidade da ANEEL. */
export const PORTE_EN: Record<string, string> = { grande: "large", pequeno: "small" };

/** Origem declarada dos eventos em situação de emergência. */
export const ORIGEM_EVENTO_EN: Record<string, string> = {
  "Evento oriundo de ultrapassagem do CHI Limite": "Event triggered by exceeding the CHI limit",
};


/** Regras da gold de Qualidade (g.regras), pelo texto português exato. */
export const REGRAS_QUALIDADE_EN: Record<string, string> = {
  "DEC e FEC de distribuidora e Brasil: média mensal dos conjuntos ponderada pelas UCs de cada conjunto no mês; anual = soma dos 12 meses.": "DEC and FEC of a distribution utility and of Brazil: monthly average of the consumer sets weighted by the consumer units (UCs) of each set in the month; annual = sum of the 12 months.",
  "Limite anual da distribuidora: média dos limites anuais dos conjuntos ponderada pelas UCs médias do ano; comparado só com o apurado do mesmo ano.": "Annual limit of the distribution utility: average of the annual limits of the consumer sets weighted by the average UCs of the year; compared only with the assessed value of the same year.",
  "DEC e FEC apurados (comparados ao limite): desde 2022, exatamente as parcelas internas programada e não programada não expurgável (IP + IND); de 2010 a 2021 o apurado de parte dos conjuntos incluía também as externas não críticas (XN + XP). As demais parcelas aparecem separadas.": "Assessed DEC and FEC (compared with the limit): since 2022, exactly the internal planned and unplanned non-excludable components (IP + IND); from 2010 to 2021 the assessed value of part of the consumer sets also included the non-critical external components (XN + XP). The other components appear separately.",
  "DEC em horas e centésimos: 10,50 h são 10 horas e 30 minutos.": "DEC in hours and hundredths of an hour: 10.50 h is 10 hours and 30 minutes.",
  "Compensação é crédito na fatura por violação de limite individual (DIC, FIC, DMIC, DICRI, DISE); não se calcula a partir do DEC do conjunto.": "A compensation payment is a credit on the bill for violation of an individual limit (DIC, FIC, DMIC, DICRI, DISE); it is not calculated from the DEC of the consumer set.",
  "Ano corrente só é comparado com os mesmos meses do ano anterior, e só com os meses nacionais completos nos dois anos.": "The current year is only compared with the same months of the previous year, and only with the national months that are complete in both years.",
  "Brasil = todas as distribuidoras com indicadores publicados, inclusive permissionárias; o número que a ANEEL divulga cobre só as concessionárias e vai em dec_concessionarias e fec_concessionarias.": "Brazil = all distribution utilities with published indicators, including permit holders; the number ANEEL announces covers only the concession holders and appears separately.",
  "Distribuidora-mês com NumCon implausível (média de até 1 UC por conjunto, ou queda ou pico isolado de mais da metade) fica fora do Brasil; com mais de um conjunto, o DEC e o FEC da distribuidora no mês ficam ausentes.": "A distribution utility-month with an implausible number of UCs reported (average of up to 1 UC per consumer set, or an isolated drop or spike of more than half) is left out of Brazil; with more than one consumer set, the DEC and FEC of the distribution utility in that month are absent.",
  "Conjunto acima do limite: DEC anual maior que o limite, os dois em centésimos como a ANEEL publica; igual ao limite não é transgressão.": "Consumer set above the limit: annual DEC greater than the limit, both in hundredths as ANEEL publishes them; equal to the limit is not a violation.",
  "Um mês nacional só entra em gráfico, ano e comparação quando as unidades consumidoras com DEC chegam a 99% do máximo dos 12 meses anteriores; antes disso o valor publicado fica na tabela, marcado como incompleto.": "A national month only enters charts, annual values and comparisons when the consumer units with DEC reach 99% of the maximum of the previous 12 months; before that the published value stays in the table, marked as incomplete.",
  "Um mês de compensação só entra em gráfico e ano quando as distribuidoras que informaram somam ao menos 99% do máximo informado nos 12 meses anteriores; antes disso o valor publicado fica na tabela, marcado como incompleto.": "A month of compensation payments only enters charts and annual values when the reporting distribution utilities add up to at least 99% of the maximum reported in the previous 12 months; before that the published value stays in the table, marked as incomplete.",
};

/** Universos do DEC e do FEC nacionais (g.brasil.universo). */
export const UNIVERSO_QUALIDADE_EN: Record<string, string> = {
  "Todas as distribuidoras com indicadores publicados, inclusive permissionárias (dec, fec).": "All distribution utilities with published indicators, including permit holders.",
  "Só concessionárias (dec_concessionarias, fec_concessionarias): o universo do DEC e do FEC nacionais que a ANEEL divulga; de 2019 em diante, quando todas as distribuidoras do ano têm classificação publicada.": "Concession holders only: the universe of the national DEC and FEC that ANEEL announces; from 2019 onwards, when all distribution utilities of the year have a published classification.",
};

/** Rótulos das parcelas do DEC (g.parcelas.rotulos). */
export const PARCELAS_ROTULOS_EN: Record<string, string> = {
  "Interna, programada e não programada não expurgável (IP + IND): desde 2022 igual ao DEC apurado": "Internal, planned and unplanned non-excludable (IP + IND): since 2022 equal to the assessed DEC",
  "Situação de emergência (expurgada)": "Emergency situation (excluded)",
  "Dia crítico (expurgada)": "Critical day (excluded)",
  "Origem externa ao sistema de distribuição (expurgada)": "External to the distribution system (excluded)",
  "Racionamento ou alívio de carga pelo ONS (expurgada)": "Rationing or load relief by the National System Operator (ONS) (excluded)",
};

/** Definição de cada parcela da ANEEL (g.parcelas.definicao). */
export const PARCELAS_DEFINICAO_EN: Record<string, string> = {
  "interna, programada": "internal, planned",
  "interna, não programada, não expurgável": "internal, unplanned, non-excludable",
  "interna, não programada, em situação de emergência": "internal, unplanned, in an emergency situation",
  "interna, não programada, em dia crítico": "internal, unplanned, on a critical day",
  "interna, programada, em dia crítico": "internal, planned, on a critical day",
  "interna, não programada, racionamento ou alívio de carga determinado pelo ONS": "internal, unplanned, rationing or load relief ordered by the ONS",
  "externa ao sistema de distribuição, não programada": "external to the distribution system, unplanned",
  "externa ao sistema de distribuição, programada": "external to the distribution system, planned",
  "externa, não programada, em dia crítico": "external, unplanned, on a critical day",
  "externa, programada, em dia crítico": "external, planned, on a critical day",
};

/** Tipos de violação que geram compensação (g.compensacoes.rotulos_tipo). */
export const ROTULOS_TIPO_COMPENSACAO_EN: Record<string, string> = {
  "Violação dos limites mensais de DIC, FIC ou DMIC": "Violation of the monthly DIC, FIC or DMIC limits",
  "Violação dos limites trimestrais de DIC ou FIC": "Violation of the quarterly DIC or FIC limits",
  "Violação dos limites anuais de DIC ou FIC": "Violation of the annual DIC or FIC limits",
  "Violação do limite de DICRI (interrupção em dia crítico)": "Violation of the DICRI limit (interruption on a critical day)",
  "Violação do limite de DISE (interrupção em situação de emergência)": "Violation of the DISE limit (interruption in an emergency situation)",
};

/** Categorias do IASC (grupos de distribuidoras da pesquisa). */
export const CATEGORIA_IASC_EN: Record<string, string> = {
  "Permissionárias até 10 mil unidades consumidoras": "Permit holders with up to 10 thousand consumer units",
  "Permissionárias acima de 10 mil unidades consumidoras": "Permit holders with more than 10 thousand consumer units",
  "Região Sudeste acima de 500 mil unidades consumidoras": "Southeast region, more than 500 thousand consumer units",
  "Região Nordeste": "Northeast region",
  "Regiões Sul, Sudeste e Centro-Oeste acima de 30 mil e até 500 mil unidades consumidoras": "South, Southeast and Center-West regions, more than 30 thousand and up to 500 thousand consumer units",
  "Região Norte": "North region",
  "Regiões Sul, Sudeste e Centro-Oeste até 30 mil unidades consumidoras": "South, Southeast and Center-West regions, up to 30 thousand consumer units",
  "Região Sul acima de 500 mil unidades consumidoras": "South region, more than 500 thousand consumer units",
  "Região Centro-Oeste acima de 500 mil unidades consumidoras": "Center-West region, more than 500 thousand consumer units",
};

/** Regra do mapa municipal de Qualidade (g.mapa.regra). */
export const REGRA_MAPA_QUALIDADE_EN: Record<string, string> = {
  "Cada município recebe os valores anuais dos conjuntos que o atendem segundo a base IndQual Município. O valor é do conjunto inteiro: quando o conjunto cobre vários municípios ou o município é atendido por vários conjuntos, o mapa mostra o intervalo dos conjuntos, nunca um DEC medido no município.": "Each municipality receives the annual values of the consumer sets that serve it according to the IndQual Município database. The value belongs to the whole consumer set: when the set covers several municipalities or the municipality is served by several sets, the map shows the range of the sets, never a DEC measured in the municipality.",
};

/** Definições da gold de Perdas (g.definicoes). */
export const DEFINICOES_PERDAS_EN: Record<string, string> = {
  "Energia injetada na rede da distribuidora que não chega a ser entregue como consumo medido: diferença calculada pela ANEEL no SAMP Balanço (valor medido).": "Energy injected into the distribution utility's grid that is not delivered as metered consumption: the difference calculated by ANEEL in the SAMP balance (measured value).",
  "Parcela atribuída às leis da física (aquecimento de cabos e transformadores). No SAMP é o percentual regulatório do processo tarifário aplicado à energia injetada publicada: estimativa, não medição. Usada só a linha do valor medido.": "Share attributed to the laws of physics (heating of cables and transformers). In SAMP it is the regulatory percentage of the tariff process applied to the published injected energy: an estimate, not a measurement. Only the measured-value line is used.",
  "Linha 'Perdas Não-Técnicas' publicada pela fonte (valor medido); pela definição da ANEEL, perdas totais menos as técnicas, identidade conferida mês a mês (quando não fecha, o agente-ano fica fora dos agregados de separação). Incluem furto, fraude, erros de medição, leitura e faturamento; a fonte não separa essas causas. Pode ser negativa quando a estimativa técnica supera a perda total medida.": "Line 'Perdas Não-Técnicas' (non-technical losses) published by the source (measured value); by ANEEL's definition, total losses minus technical losses, an identity checked month by month (when it does not close, the agent-year is left out of the separation aggregates). They include theft, fraud and metering, reading and billing errors; the source does not separate these causes. They can be negative when the technical estimate exceeds the measured total loss.",
  "Energia inserida na rede para atender aos consumidores, incluindo as perdas. Denominador das taxas total e técnica.": "Energy fed into the grid to serve consumers, including losses. Denominator of the total and technical rates.",
  "Energia medida entregue a consumidores de baixa tensão (cativos, consumo próprio e livres). Denominador da taxa não técnica, como na regulação da ANEEL.": "Metered energy delivered to low-voltage consumers (captive, own consumption and free). Denominator of the non-technical rate, as in ANEEL regulation.",
  "Diferença entre a energia injetada publicada e a soma de energia fornecida, irregular e perdas. Mostra o que a fonte não explica; não é outra perda.": "Difference between the published injected energy and the sum of supplied energy, irregular energy and losses. It shows what the source does not explain; it is not another loss.",
  "Percentual de perdas técnicas sobre a energia injetada publicada, inferido pelo observatório da própria série do SAMP onde a razão fica constante por 6 meses ou mais; não é o percentual lido de um ato homologatório.": "Percentage of technical losses over the published injected energy, inferred by the observatory from the SAMP series itself where the ratio stays constant for 6 months or more; it is not the percentage read from a ratification act.",
  "Parte da tarifa residencial B1 (sem tributos) que remunera perdas técnicas, não técnicas e na Rede Básica, em R$/MWh, por processo tarifário.": "Part of the B1 residential tariff (before taxes) that pays for technical losses, non-technical losses and losses in the Rede Básica (basic transmission grid), in R$/MWh, per tariff process.",
};

/** Regra do mapa de Perdas (g.mapa.regra). */
export const REGRA_MAPA_PERDAS_EN: Record<string, string> = {
  "Cor da área = valor da distribuidora (nunca repartido entre municípios); município compartilhado aparece com marca própria; vínculo não confirmado aparece só com contorno; vínculo só pelo cadastro de MMGD tem marca própria; município sem vínculo fica sem cor e é listado.": "Area colour = value of the distribution utility (never split among municipalities); a shared municipality has its own mark; an unconfirmed link appears only as an outline; a link only through the MMGD registry has its own mark; a municipality without a link has no colour and is listed.",
};
