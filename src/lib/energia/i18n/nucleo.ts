/**
 * Tabelas de tradução do grupo "núcleo" (componentes genéricos do observatório): rótulos que chegam dos dados com valores
 * fixos, traduzidos por correspondência exata do português para o inglês. Valor sem entrada volta null, e o componente o
 * mostra em <TrechoPortugues> (nunca em português solto). Não altera a gold nem o pipeline.
 */
import type { Idioma } from "@/lib/idioma";

/** Frequência de atualização declarada na proveniência (campo `frequencia`). */
export const FREQUENCIA_EN: Record<string, string> = {
  mensal: "monthly",
  "diária": "daily",
  anual: "annual",
  "horária": "hourly",
  trimestral: "quarterly",
  semanal: "weekly",
  "semi-horária": "half-hourly",
  "a cada execução do pipeline": "at each pipeline run",
  "por vigência": "per validity period",
  "mensal e anual": "monthly and annual",
  "por evento": "per event",
  "diária (janela de 30 dias)": "daily (30-day window)",
  "mensal (publicação); anual (comparação)": "monthly (publication); annual (comparison)",
  "anual (DFP) e trimestral (ITR)": "annual (DFP) and quarterly (ITR)",
  "mensal segundo o dicionário": "monthly according to the data dictionary",
  "horária, agregada por dia": "hourly, aggregated by day",
  "semi-horária, agregada por dia e mês": "half-hourly, aggregated by day and month",
  "mensal (competência)": "monthly (reference month)",
  "semana operativa": "operating week",
  "cadastro vigente": "current register",
  "anual (ciclo de planejamento)": "annual (planning cycle)",
  "atualização do portal (sem calendário declarado)": "portal update (no declared schedule)",
  "horária, somada por dia e mês": "hourly, summed by day and month",
  "horária, agregada por dia, mês e janela": "hourly, aggregated by day, month and window",
  "horária, agregada por dia e mês": "hourly, aggregated by day and month",
  "semanal (semana operativa do PMO)": "weekly (PMO operating week)",
  "mensal (dia 1º de cada mês)": "monthly (1st day of each month)",
  "por evento tarifário": "per tariff event",
  "mensal (somado por ano)": "monthly (summed by year)",
  "por resolução": "per resolution",
  "por ato": "per act",
  "semanal (atualização da fonte)": "weekly (source update)",
  "bienal, com revisões": "biennial, with revisions",
  "janela de 30 dias": "30-day window",
  "diária (dia UTC)": "daily (UTC day)",
  "diária (hora solar local)": "daily (local solar time)",
  "diária (dia UTC), a cada rodada": "daily (UTC day), at each run",
  "semi-horária na fonte; horária e diária aqui": "half-hourly at the source; hourly and daily here",
  "por trecho de vigência": "per validity segment",
  "por processo tarifário": "per tariff process",
  "relação vigente": "current list",
  "censitária (2022)": "census (2022)",
  "semana operativa (sábado a sexta)": "operating week (Saturday to Friday)",
  "horária; resumo anual": "hourly; annual summary",
  "horária; resumo anual e mensal": "hourly; annual and monthly summary",
  "horária e diária": "hourly and daily",
  "diária (pregão)": "daily (trading session)",
};

/** Unidade declarada na proveniência ou na série (campo `unidade`). Unidade física sem palavra (MWh, %, R$/MWh) passa como está. */
export const UNIDADE_EN: Record<string, string> = {
  "horas (DEC); interrupções (FEC)": "hours (DEC); interruptions (FEC)",
  "R$/MWh (nominal)": "R$/MWh (nominal)",
  "% da MLT": "% of the long-term average (MLT)",
  "R$ nominais": "nominal R$",
  "% da EAR máxima": "% of maximum stored energy (EAR)",
  "MWh, MW e %": "MWh, MW and %",
  "MW e %": "MW and %",
  "R$/MWh nominais": "nominal R$/MWh",
  "MWmed e %": "MWavg and %",
  MWmed: "MWavg",
  "R$/MWh (tarifa) e R$/mês (perfil)": "R$/MWh (tariff) and R$/month (profile)",
  "R$ (nominal)": "R$ (nominal)",
  "MWmês e %": "MW-month and %",
  "MWh e unidades consumidoras": "MWh and consumer units",
  horas: "hours",
  "MW e usinas": "MW and plants",
  "unidades consumidoras": "consumer units",
  "R$ correntes": "current R$",
  "localidades; pessoas": "localities; people",
  "domicílios; R$ correntes": "households; current R$",
  "MWmédio e empreendimentos": "MWavg and projects",
  "MWh, MWmed e % da geração": "MWh, MWavg and % of generation",
  "MWh e MWmed": "MWh and MWavg",
  "MWh, MWmed e %": "MWh, MWavg and %",
  "R$/MWh e % do total": "R$/MWh and % of total", // i18n: dado
  "R$/mês": "R$/month",
  "número-índice (dez/1993 = 100) e %": "index number (Dec 1993 = 100) and %",
  "versão": "version",
  evento: "event",
  consulta: "consultation",
  atividade: "activity",
  "MWmês e % da EAR máxima": "MW-month and % of maximum stored energy (EAR)",
  "MWmês": "MW-month",
  "mm/dia": "mm/day",
  "mm/dia e °C": "mm/day and °C",
  "MWmed, % e log × 100": "MWavg, % and log × 100",
  "MWh e % da injetada publicada": "MWh and % of published injected energy",
  "% da energia injetada publicada": "% of published injected energy",
  "R$/MWh (nominal, sem tributos)": "R$/MWh (nominal, excluding taxes)",
  "municípios": "municipalities",
  "pessoas e R$ de 2022 por mês": "people and 2022 R$ per month",
  "MWmed (MWh = MWmed × horas do mês)": "MWavg (MWh = MWavg × hours in the month)",
  "agentes, perfis, parcelas de carga": "agents, profiles, load portions",
  "R$ nominais e MWh": "nominal R$ and MWh",
  "mil R$ nominais": "thousand nominal R$",
  "R$/MWh; frequência em fração das horas": "R$/MWh; frequency as a fraction of hours",
  "horas; MWmed": "hours; MWavg",
  "semanas; R$/MWh": "weeks; R$/MWh",
  "horas, dias e fração": "hours, days and fraction",
  "% de participação no índice": "% weight in the index",
  "MW (potência fiscalizada), km de circuito, MVA, unidades consumidoras": "MW (inspected capacity), circuit km, MVA, consumer units",
  dias: "days",
  meses: "months",
  usinas: "plants",
  distribuidoras: "distribution utilities",
  "MWmed (média)": "MWavg (average)",
};

/** Licença declarada para a fonte (campo `fonte.licenca`), nas formas mais frequentes. */
export const LICENCA_EN: Record<string, string> = {
  "Open Data Commons Open Database License (ODbL)": "Open Data Commons Open Database License (ODbL)",
  "Creative Commons Atribuição (CC-BY), conforme o portal de dados abertos do ONS": "Creative Commons Attribution (CC-BY), as stated on the ONS open data portal",
  "Creative Commons Attribution 4.0 (CC-BY-4.0), conforme o portal de dados abertos da CCEE": "Creative Commons Attribution 4.0 (CC-BY-4.0), as stated on the CCEE open data portal",
  "Open Data Commons Open Database License (ODbL), conforme o portal de dados abertos da ANEEL": "Open Data Commons Open Database License (ODbL), as stated on the ANEEL open data portal",
  "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da CVM": "Open Data Commons Open Database License (ODbL), as stated on the CVM open data portal",
  "Sem licença declarada no repositório para os metadados do pipeline; os dados de origem seguem a licença de cada fonte, registrada no catálogo.":
    "No license declared in the repository for the pipeline metadata; the source data follow the license of each source, recorded in the catalog.",
  "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), conforme o rodapé do portal da EPE": "Creative Commons Attribution 4.0 International (CC BY 4.0), as stated in the footer of the EPE portal",
  "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons, conforme o portal de dados abertos da ANEEL": "Open Data Commons Open Database License (ODbL), as stated on the ANEEL open data portal",
  "Creative Commons Atribuição 4.0 Internacional (CC BY 4.0), declarada no portal da EPE; o PASI não traz licença própria.":
    "Creative Commons Attribution 4.0 International (CC BY 4.0), declared on the EPE portal; PASI has no license of its own.",
  "Outra (Aberta), conforme o campo de licença do portal de dados abertos do MME": "Other (Open), as stated in the license field of the MME open data portal",
  "Licença Aberta para Bases de Dados (ODbL) do Open Data Commons": "Open Data Commons Open Database License (ODbL)",
  "Uso livre com citação da fonte (IBGE)": "Free use with source attribution (IBGE)",
  "Conteúdo de portal do Governo Federal (gov.br), uso livre com citação da fonte": "Federal Government portal content (gov.br), free use with source attribution",
  "ODbL (ANEEL), CC-BY (ONS), uso livre com citação (IBGE e EPE)": "ODbL (ANEEL), CC-BY (ONS), free use with attribution (IBGE and EPE)",
};

/** Tradução exata de um valor dos dados, ou null quando não há entrada (o componente mostra o original em TrechoPortugues). */
export function traducaoDoDado(tabela: Record<string, string>, valor: string, idioma: Idioma): string | null {
  if (idioma !== "en") return valor;
  return Object.prototype.hasOwnProperty.call(tabela, valor) ? tabela[valor] : null;
}

/** Sinal de palavra portuguesa numa unidade: acento ou palavra comum das unidades da gold. */
const PALAVRA_PT =
  /[ãõçáéíóúâêô]|(?:^|[^a-z])(?:de|da|do|das|dos|e|por|mil|dias?|horas?|meses|semanas?|anos?|usinas?|unidades?|consumidoras?|nominais|correntes|pessoas|localidades|empreendimentos|agentes|perfis|parcelas|carga|evento|consulta|atividade|indice)(?=$|[^a-z])/i;

/**
 * Unidade no idioma: a da tabela, ou a própria unidade quando ela não tem palavra portuguesa (R$/MWh, MWh, %, °C, tCO2/MWh, ou já
 * em inglês, como MWavg, vinda da página); null quando tem palavra portuguesa sem entrada na tabela.
 */
export function unidadeNoIdioma(unidade: string, idioma: Idioma): string | null {
  if (idioma !== "en") return unidade;
  if (Object.prototype.hasOwnProperty.call(UNIDADE_EN, unidade)) return UNIDADE_EN[unidade];
  return PALAVRA_PT.test(unidade) ? null : unidade;
}
