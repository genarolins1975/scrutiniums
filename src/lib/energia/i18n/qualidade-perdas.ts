import { createElement, Fragment, type ComponentType, type ReactNode } from "react";
import type { Idioma } from "@/lib/idioma";
import { Nome } from "@/components/i18n/Nome";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";

/* as duas marcas com o filho passado como argumento de createElement (o arquivo é .ts, sem JSX) */
const Trecho = TrechoPortugues as ComponentType<{ regiao: string; children?: ReactNode }>;
const NomeProprio = Nome as ComponentType<{ children?: ReactNode }>;

/**
 * Tabelas de tradução do grupo Qualidade e Perdas: rótulos e frases que chegam prontos da gold
 * (public/energia/gold/qualidade.json e perdas.json). Cada chave é o texto português exato da
 * gold; valor sem entrada aqui não é traduzido por aproximação: a página inglesa o mostra em
 * <TrechoPortugues> (ver traduzOuMarca). Gerado a partir da gold publicada; ao mudar a frase na
 * gold, a entrada antiga deixa de casar e o trecho volta marcado como só em português.
 */

/** Nome próprio português dentro de uma tradução: vai entre ⟦ e ⟧ na tabela e sai marcado com <Nome> (ou sem a marca, como texto). */
const NOME = /⟦([^⟧]+)⟧/g;

/** Tradução exata de um texto da gold (texto puro, sem as marcas de nome), ou null quando a tabela não tem a frase. */
export function traducaoExata(pt: string | null | undefined, tabela: Readonly<Record<string, string>>): string | null {
  if (!pt) return null;
  return Object.prototype.hasOwnProperty.call(tabela, pt) ? tabela[pt].replace(NOME, "$1") : null;
}

/** Texto da gold no idioma da página: português como está; inglês pela tabela (nomes próprios marcados), ou o original marcado como só em português. */
export function traduzOuMarca(pt: string | null | undefined, tabela: Readonly<Record<string, string>>, idioma: Idioma, regiao: string): ReactNode {
  if (!pt) return pt ?? null;
  if (idioma !== "en") return pt;
  if (!Object.prototype.hasOwnProperty.call(tabela, pt)) return createElement(Trecho, { regiao }, pt);
  const partes = tabela[pt].split(NOME);
  // split com grupo: posições ímpares são os nomes
  return partes.length === 1 ? partes[0] : createElement(Fragment, null, ...partes.map((p, i) => (i % 2 ? createElement(NomeProprio, { key: i }, p) : p)));
}

/**
 * Frase inglesa montada com nomes próprios portugueses dentro (siglas e nomes de distribuidoras, conjuntos, municípios): na página inglesa,
 * cada nome dado que aparece no texto sai marcado com <Nome>; em português o texto volta como está.
 */
export function marcarNomes(texto: string, nomes: readonly (string | null | undefined)[], idioma: Idioma): ReactNode {
  if (idioma !== "en" || !texto) return texto;
  const lista = Array.from(new Set(nomes.filter((n): n is string => !!n && n.length > 1 && texto.includes(n)))).sort((a, b) => b.length - a.length);
  if (!lista.length) return texto;
  // sem expressão regular: procura, a cada passo, o nome mais longo que começa mais cedo no texto
  const partes: ReactNode[] = [];
  let resto = texto;
  for (;;) {
    let melhor: { pos: number; nome: string } | null = null;
    for (const n of lista) {
      const pos = resto.indexOf(n);
      if (pos >= 0 && (!melhor || pos < melhor.pos)) melhor = { pos, nome: n };
    }
    if (!melhor) break;
    if (melhor.pos > 0) partes.push(resto.slice(0, melhor.pos));
    partes.push(createElement(NomeProprio, { key: partes.length }, melhor.nome));
    resto = resto.slice(melhor.pos + melhor.nome.length);
  }
  if (resto) partes.push(resto);
  return createElement(Fragment, null, ...partes);
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
  "DEC e FEC de distribuidora e Brasil: média mensal dos conjuntos ponderada pelas UCs de cada conjunto no mês; anual = soma dos 12 meses.": "DEC and FEC of a distribution utility and of Brazil: monthly average of the consumer clusters weighted by the consumer units (UCs) of each cluster in the month; annual = sum of the 12 months.",
  "Limite anual da distribuidora: média dos limites anuais dos conjuntos ponderada pelas UCs médias do ano; comparado só com o apurado do mesmo ano.": "Annual limit of the distribution utility: average of the annual limits of the consumer clusters weighted by the average UCs of the year; compared only with the assessed value of the same year.",
  "DEC e FEC apurados (comparados ao limite): desde 2022, exatamente as parcelas internas programada e não programada não expurgável (IP + IND); de 2010 a 2021 o apurado de parte dos conjuntos incluía também as externas não críticas (XN + XP). As demais parcelas aparecem separadas.": "Assessed DEC and FEC (compared with the limit): since 2022, exactly the internal planned and unplanned non-excludable components (IP + IND); from 2010 to 2021 the assessed value of part of the consumer clusters also included the non-critical external components (XN + XP). The other components appear separately.",
  "DEC em horas e centésimos: 10,50 h são 10 horas e 30 minutos.": "DEC in hours and hundredths of an hour: 10.50 h is 10 hours and 30 minutes.",
  "Compensação é crédito na fatura por violação de limite individual (DIC, FIC, DMIC, DICRI, DISE); não se calcula a partir do DEC do conjunto.": "A compensation payment is a credit on the bill for violation of an individual limit (DIC, FIC, DMIC, DICRI, DISE); it is not calculated from the DEC of the consumer cluster.",
  "Ano corrente só é comparado com os mesmos meses do ano anterior, e só com os meses nacionais completos nos dois anos.": "The current year is only compared with the same months of the previous year, and only with the national months that are complete in both years.",
  "Brasil = todas as distribuidoras com indicadores publicados, inclusive permissionárias; o número que a ANEEL divulga cobre só as concessionárias e vai em dec_concessionarias e fec_concessionarias.": "Brazil = all distribution utilities with published indicators, including permit holders; the number ANEEL announces covers only the concession holders and appears separately.",
  "Distribuidora-mês com NumCon implausível (média de até 1 UC por conjunto, ou queda ou pico isolado de mais da metade) fica fora do Brasil; com mais de um conjunto, o DEC e o FEC da distribuidora no mês ficam ausentes.": "A distribution utility-month with an implausible number of UCs reported (average of up to 1 UC per consumer cluster, or an isolated drop or spike of more than half) is excluded from Brazil; with more than one consumer cluster, the DEC and FEC of the distribution utility in that month are absent.",
  "Conjunto acima do limite: DEC anual maior que o limite, os dois em centésimos como a ANEEL publica; igual ao limite não é transgressão.": "Consumer cluster above the limit: annual DEC greater than the limit, both in hundredths as ANEEL publishes them; equal to the limit is not a violation.",
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
  "Cada município recebe os valores anuais dos conjuntos que o atendem segundo a base IndQual Município. O valor é do conjunto inteiro: quando o conjunto cobre vários municípios ou o município é atendido por vários conjuntos, o mapa mostra o intervalo dos conjuntos, nunca um DEC medido no município.": "Each municipality receives the annual values of the consumer clusters that serve it according to the ⟦IndQual Município⟧ database. The value belongs to the whole consumer cluster: when the cluster covers several municipalities or the municipality is served by several clusters, the map shows the range of the clusters, never a DEC measured in the municipality.",
};

/** Definições da gold de Perdas (g.definicoes). */
export const DEFINICOES_PERDAS_EN: Record<string, string> = {
  "Energia injetada na rede da distribuidora que não chega a ser entregue como consumo medido: diferença calculada pela ANEEL no SAMP Balanço (valor medido).": "Energy injected into the distribution utility's grid that is not delivered as metered consumption: the difference calculated by ANEEL in the SAMP balance (measured value).",
  "Parcela atribuída às leis da física (aquecimento de cabos e transformadores). No SAMP é o percentual regulatório do processo tarifário aplicado à energia injetada publicada: estimativa, não medição. Usada só a linha do valor medido.": "Share attributed to the laws of physics (heating of cables and transformers). In SAMP it is the regulatory percentage of the tariff process applied to the published injected energy: an estimate, not a measurement. Only the measured-value line is used.",
  "Linha 'Perdas Não-Técnicas' publicada pela fonte (valor medido); pela definição da ANEEL, perdas totais menos as técnicas, identidade conferida mês a mês (quando não fecha, o agente-ano fica fora dos agregados de separação). Incluem furto, fraude, erros de medição, leitura e faturamento; a fonte não separa essas causas. Pode ser negativa quando a estimativa técnica supera a perda total medida.": "Line ⟦'Perdas Não-Técnicas'⟧ (non-technical losses) published by the source (measured value); by ANEEL's definition, total losses minus technical losses, an identity checked month by month (when it does not close, the agent-year is excluded from the separation aggregates). They include theft, fraud and metering, reading and billing errors; the source does not separate these causes. They can be negative when the technical estimate exceeds the measured total loss.",
  "Energia inserida na rede para atender aos consumidores, incluindo as perdas. Denominador das taxas total e técnica.": "Energy fed into the grid to serve consumers, including losses. Denominator of the total and technical rates.",
  "Energia medida entregue a consumidores de baixa tensão (cativos, consumo próprio e livres). Denominador da taxa não técnica, como na regulação da ANEEL.": "Metered energy delivered to low-voltage consumers (captive, own consumption and free). Denominator of the non-technical rate, as in ANEEL regulation.",
  "Diferença entre a energia injetada publicada e a soma de energia fornecida, irregular e perdas. Mostra o que a fonte não explica; não é outra perda.": "Difference between the published injected energy and the sum of supplied energy, irregular energy and losses. It shows what the source does not explain; it is not another loss.",
  "Percentual de perdas técnicas sobre a energia injetada publicada, inferido pelo observatório da própria série do SAMP onde a razão fica constante por 6 meses ou mais; não é o percentual lido de um ato homologatório.": "Percentage of technical losses over the published injected energy, inferred by the observatory from the SAMP series itself where the ratio stays constant for 6 months or more; it is not the percentage read from a ratification act.",
  "Parte da tarifa residencial B1 (sem tributos) que remunera perdas técnicas, não técnicas e na Rede Básica, em R$/MWh, por processo tarifário.": "Part of the B1 residential tariff (before taxes) that pays for technical losses, non-technical losses and losses in the ⟦Rede Básica⟧ (basic transmission grid), in R$/MWh, per tariff process.",
};

/** Regra do mapa de Perdas (g.mapa.regra). */
export const REGRA_MAPA_PERDAS_EN: Record<string, string> = {
  "Cor da área = valor da distribuidora (nunca repartido entre municípios); município compartilhado aparece com marca própria; vínculo não confirmado aparece só com contorno; vínculo só pelo cadastro de MMGD tem marca própria; município sem vínculo fica sem cor e é listado.": "Area colour = value of the distribution utility (never split among municipalities); a shared municipality has its own mark; an unconfirmed link appears only as an outline; a link only through the MMGD registry has its own mark; a municipality without a link has no colour and is listed.",
};

/** Frases da gold de Perdas: relatório da ANEEL, ressalvas, decisões de método, bloqueios, arquivos, universo fixo, associação e aviso do ano aberto. */
export const TEXTOS_PERDAS_EN: Record<string, string> = {
  "ANEEL/STR, Perdas de Energia Elétrica na Distribuição, edição 2025/2024 (16 p., extração do SAMP de maio de 2025)": "ANEEL/STR, ⟦Perdas de Energia Elétrica na Distribuição⟧ (electricity losses in distribution), 2025/2024 edition (16 pp., SAMP extraction of May 2025)",
  "A injetada de referência de 2024 cai no intervalo implícito no relatório; a taxa total medida fica acima da faturada do relatório porque o mercado faturado inclui o custo de disponibilidade (a própria ANEEL registra essa diferença ao migrar para o mercado medido em 2025).": "The 2024 reference injected energy falls within the range implied by the report; the measured total rate is above the billed rate in the report because the billed market includes the availability charge (ANEEL itself records this difference when moving to the measured market in 2025).",
  "Original em git.aneel.gov.br bloqueado por desafio do Cloudflare; cópia de terceiro (agenciainfra.com, sha256 58d6da5b4edd06f4cf3e2c6c6627a166404de17ad90e81b838a39c139d6aa706). Os valores do relatório aparecem aqui só como alvo desta conferência, rotulados como do relatório; nenhum indicador do observatório é calculado a partir deles.": "Original at git.aneel.gov.br blocked by a Cloudflare challenge; third-party copy (⟦agenciainfra.com⟧, ⟦sha256 58d6da5b4edd06f4cf3e2c6c6627a166404de17ad90e81b838a39c139d6aa706⟧). The report values appear here only as the target of this check, labelled as coming from the report; no observatory indicator is calculated from them.",
  "faturada": "billed",
  "medida": "measured",
  "7 linhas repetidas fora do balanço de distribuição (geradoras antigas); ignoradas": "7 repeated lines outside the distribution balance (former generation companies); ignored",
  "Área desenhada como o conjunto dos municípios do IBGE ligados à distribuidora pela relação oficial conjunto × município (IndQual Município + limites de continuidade do ano), vínculo a vínculo, sem polígono inventado.": "Area drawn as the group of IBGE municipalities linked to the distribution utility by the official consumer cluster × municipality relation (⟦IndQual Município⟧ + continuity limits of the year), link by link, with no invented polygon.",
  "Denominador das taxas: energia injetada publicada no leiaute antigo; no leiaute de 2024, a energia implícita no cálculo da própria fonte (fornecida + irregular + perdas).": "Denominator of the rates: published injected energy in the old layout; in the 2024 layout, the energy implied in the source's own calculation (supplied + irregular + losses).",
  "Base medida (não faturada) como principal, a mesma que a ANEEL adotou a partir de 2025; a faturada segue no CSV para comparação.": "Measured base (not billed) as the main one, the same ANEEL adopted from 2025; the billed base remains in the CSV for comparison.",
  "Agregados só com distribuidoras de ano completo e sem alerta físico (inclui balanço que não fecha acima de 5% da injetada e fornecida maior que a injetada); as excluídas aparecem contadas por motivo.": "Aggregates only with distribution utilities with a complete year and no physical alert (including a balance that does not close above 5% of the injected energy and supplied energy greater than injected); the excluded ones are counted by reason.",
  "Não técnica = linha publicada 'Perdas Não-Técnicas' (valor medido), com a identidade total = técnica + não técnica conferida mês a mês; agente-ano que não fecha sai dos agregados de técnica e não técnica. Técnica só do valor medido, nunca substituída pela faturada.": "Non-technical = published line ⟦'Perdas Não-Técnicas'⟧ (measured value), with the identity total = technical + non-technical checked month by month; an agent-year that does not close leaves the technical and non-technical aggregates. Technical only from the measured value, never replaced by the billed one.",
  "Série nacional com cobertura e marca de universo por linha; variação anual só nas mesmas distribuidoras dos dois anos (sem mudança de escala entre eles) e série de universo fixo para os três últimos anos completos.": "National series with coverage and a universe mark on each line; annual change only in the same distribution utilities of both years (with no change of scale between them) and a fixed-universe series for the last three complete years.",
  "Quebra de escala (injetada mais de 30% maior ou menor) e absorção provável observada no SAMP marcadas em todo par de anos; o par afetado não entra em variação anual.": "Scale break (injected energy more than 30% higher or lower) and probable absorption observed in SAMP are marked in every pair of years; the affected pair does not enter the annual change.",
  "Percentual técnico regulatório: só trechos de 6 meses ou mais formam referência; resolução homologatória associada só com troca de ao menos 0,02 p.p.": "Regulatory technical percentage: only segments of 6 months or more form a reference; a ratification resolution is associated only with a change of at least 0.02 p.p.",
  "Tarifa: só o processo com início ≤ data da consulta ≤ fim é apresentado como vigente; sem ele, o último já iniciado sai com a situação 'vigencia_encerrada'.": "Tariff: only the process with start ≤ query date ≤ end is presented as in force; without it, the latest one already started appears with the status 'vigencia_encerrada' (validity ended).",
  "Ano aberto comparado só com o mesmo período do ano anterior (janeiro até o último mês publicado por ao menos 90% das distribuidoras), sobre as mesmas distribuidoras nos dois recortes.": "Open year compared only with the same period of the previous year (January up to the last month published by at least 90% of the distribution utilities), over the same distribution utilities in both selections.",
  "Divergência entre representações de uma grandeza (linha TOTAL, linha de todos os níveis, soma dos níveis) é arbitrada pela soma dos níveis ou pelo fechamento do balanço do mês; só a que nenhuma das duas confirma gera alerta.": "A divergence between representations of one quantity (TOTAL line, all-levels line, sum of the levels) is settled by the sum of the levels or by the closing of the month's balance; only one that neither confirms raises an alert.",
  "Associação com renda calculada com as perdas de 2022, o ano do Censo, e com o território de 2022 (limites de continuidade daquele ano), para que as três grandezas descrevam o mesmo ano.": "Association with income calculated with the 2022 losses, the Census year, and with the 2022 territory (continuity limits of that year), so that the three quantities describe the same year.",
  "Perda não técnica regulatória e custo total reconhecido em reais por processo tarifário (P057, P058)": "Regulatory non-technical loss and total cost recognized in reais per tariff process (P057, P058)",
  "Polígono oficial da área de concessão ou permissão (P055)": "Official polygon of the concession or permit area (P055)",
  "30/09/2026 (21h50 e 22h42 UTC): HTTP 403 com cabeçalho cf-mitigated: challenge (desafio do Cloudflare) em git.aneel.gov.br, calculostarifarios.aneel.gov.br, www2.aneel.gov.br e biblioteca.aneel.gov.br; portalrelatorios.aneel.gov.br e rap.aneel.gov.br (relatório PerdasDIT, ligado na página S6) encerram a conexão (curl 35). A página de conceito (S5) remete o histórico de perdas não técnicas à página S6, cujos arquivos estão nesses hosts. O relatório da ANEEL (edição 2025/2024) traz os valores regulatórios por distribuidora só em figuras, sem tabela.": "Sep 30, 2026 (21h50 and 22h42 UTC): HTTP 403 with header cf-mitigated: challenge (Cloudflare challenge) at git.aneel.gov.br, calculostarifarios.aneel.gov.br, www2.aneel.gov.br and biblioteca.aneel.gov.br; portalrelatorios.aneel.gov.br and rap.aneel.gov.br (PerdasDIT report, linked on page S6) close the connection (curl 35). The concept page (S5) refers the history of non-technical losses to page S6, whose files are on those hosts. The ANEEL report (2025/2024 edition) gives the regulatory values by distribution utility only in figures, with no table.",
  "Recurso aberto da ANEEL com os percentuais regulatórios homologados (técnico e não técnico) e o valor reconhecido por processo, ou liberação de acesso automatizado aos hosts acima.": "An open ANEEL resource with the ratified regulatory percentages (technical and non-technical) and the value recognized per process, or permission for automated access to the hosts above.",
  "30/09/2026: SIGEL com conexão encerrada; BDGD exige leitor de File Geodatabase (GDAL indisponível no ambiente) e download de centenas de MB por distribuidora.": "Sep 30, 2026: SIGEL closed the connection; BDGD requires a File Geodatabase reader (GDAL unavailable in the environment) and downloading hundreds of MB per distribution utility.",
  "GDAL no ambiente do pipeline para extrair a entidade ARAT da BDGD mais recente de cada distribuidora, ou camada oficial de áreas no SIGEL acessível.": "GDAL in the pipeline environment to extract the ARAT entity from the most recent BDGD of each distribution utility, or an accessible official area layer in SIGEL.",
  "Perdas por distribuidora e ano (CSV)": "Losses by distribution utility and year (CSV)",
  "Balanço mensal por distribuidora, para auditoria (CSV)": "Monthly balance by distribution utility, for audit (CSV)",
  "Série nacional por universo (CSV)": "National series by universe (CSV)",
  "Percentual técnico regulatório implícito (CSV)": "Implicit regulatory technical percentage (CSV)",
  "Componentes de perdas na tarifa B1 (CSV)": "Loss components in the B1 tariff (CSV)",
  "Municípios e distribuidoras (CSV)": "Municipalities and distribution utilities (CSV)",
  "Contexto social por distribuidora (CSV)": "Social context by distribution utility (CSV)",
  "Acumulado do ano aberto e mesmo período do ano anterior (CSV)": "Year to date of the open year and same period of the previous year (CSV)",
  "mesmas distribuidoras com os 12 meses, sem alerta, com não técnica, técnica e mercado BT publicados e decomposição fechando em todos os anos, sem mudança de escala entre eles": "the same distribution utilities with the 12 months, no alert, with non-technical, technical and low-voltage market published and the decomposition closing in every year, with no change of scale between them",
  "renda média domiciliar per capita (Censo 2022) dos municípios da área no ano das perdas": "average household income per capita (2022 Census) of the area's municipalities in the year of the losses",
  "concessionárias com o ano 2022 completo, sem alerta e com território na relação de 2022; não técnica só das que têm a separação publicada e fechando": "concession holders with the complete year 2022, no alert and with territory in the 2022 relation; non-technical losses only for those with the separation published and closing",
  "Associação descritiva entre áreas, não causa: renda municipal média não descreve cada unidade consumidora e perdas dependem também de gestão, rede e fiscalização. Perda não técnica não é atribuída às famílias da área.": "A descriptive association across areas, not a cause: average municipal income does not describe each consumer unit, and losses also depend on management, grid and enforcement. Non-technical losses are not attributed to the households of the area.",
  "2026 tem dados até ago/2026 e não entra em comparações com anos completos; o acumulado de janeiro a julho é comparado com o mesmo período de 2025.": "2026 has data up to Aug 2026 and does not enter comparisons with complete years; the year to date from January to July is compared with the same period of 2025.",
};
