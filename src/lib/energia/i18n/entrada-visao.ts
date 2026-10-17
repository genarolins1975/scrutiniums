/**
 * Tabelas de tradução da página inicial e da Visão geral do Setor Elétrico: textos que chegam da gold
 * (public/energia/gold/*.json) só em português e que a página inglesa mostra. Cada entrada é o texto
 * português exato da gold e o equivalente inglês, com os mesmos números, unidades e datas; o que não
 * está na tabela nem segue um modelo conhecido não é traduzido aqui, e quem exibe decide entre a forma
 * inglesa montada em código e o trecho marcado como só em português (<TrechoPortugues>). A gold e o
 * pipeline não mudam.
 *
 * Só dado e conversão de texto: nada aqui lê o idioma da página. Quem chama escolhe a forma.
 */
import { createElement, type ReactNode } from "react";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import { nomeSubmercado } from "../formato";

/* ------------------------------------------------------------------ conversões de número, data e mês */

const MESES_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MESES_LONGOS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; // i18n: dado
const MESES_LONGOS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Número escrito em português ("1.234,5") na forma inglesa ("1,234.5"). */
export function numeroEn(s: string): string {
  return s.replace(/\./g, "\u0000").replace(/,/g, ".").replace(/\u0000/g, ",");
}

/** "28/09/2026" → "Sep 28, 2026"; "12/2025" → "Dec 2025". */
export function dataEn(s: string): string {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (d) return `${MESES_EN[Number(d[2]) - 1]} ${Number(d[1])}, ${d[3]}`;
  const m = /^(\d{2})\/(\d{4})$/.exec(s);
  if (m) return `${MESES_EN[Number(m[1]) - 1]} ${m[2]}`;
  return s;
}

/** "jun/2026" → "Jun 2026"; "jun" → "Jun". */
export function mesEn(s: string): string {
  const m = /^([a-z]{3})(?:\/(\d{4}))?$/.exec(s);
  const i = m ? MESES_PT.indexOf(m[1]) : -1;
  if (!m || i < 0) return s;
  return m[2] ? `${MESES_EN[i]} ${m[2]}` : MESES_EN[i];
}

/** Todas as datas, meses e números em forma portuguesa dentro de um trecho curto ("R$ 0,8212/kWh", "9,33 h"), na forma inglesa. */
export function trechoEn(s: string): string {
  return s
    .replace(/\b(\d{2}\/\d{2}\/\d{4})\b/g, (x) => dataEn(x))
    .replace(/\b(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\/(\d{4})\b/g, (x) => mesEn(x))
    .replace(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+,\d+/g, (x) => numeroEn(x));
}

/** "1 day" / "2 days" a partir do número escrito na gold. */
const dias = (n: string) => `${n} ${n === "1" ? "day" : "days"}`;
const meses = (n: string) => `${n} ${n === "1" ? "month" : "months"}`;

/* ------------------------------------------------------------------ textos fixos da gold */

/** Rótulos curtos e frases fixas da gold (títulos de painel, rótulos de coluna e de referência, nomes de regra, notas fixas). */
const GOLD_EN: Readonly<Record<string, string>> = {
  // catálogo (quebras de metodologia da base de Perdas)
  "A ANEEL passa a calcular energia requerida e perdas não técnicas sobre o mercado medido em vez do faturado (Despacho 1.220/2025-STR).":
    "ANEEL starts calculating required energy and non-technical losses on the measured market instead of the billed market (Despacho 1.220/2025-STR).",
  // rótulos dos arquivos CSV das fichas (downloads das evidências)
  "Histórico de tarifas de baixa tensão (CSV)": "Low-voltage tariff history (CSV)",
  "Distribuidoras por mês (CSV)": "Distribution utilities by month (CSV)",
  "Série nacional (CSV)": "National series (CSV)",
  "Por distribuidora e ano (CSV)": "By distribution utility and year (CSV)",
  "EAR e ENA diárias por subsistema e SIN, com a captura usada (CSV)": "Daily EAR and ENA by subsystem and SIN, with the capture used (CSV)",
  "PLD horário, quatro submercados (CSV)": "Hourly PLD, four submarkets (CSV)",
  "PLD médio diário, quatro submercados (CSV)": "Daily average PLD, four submarkets (CSV)",
  "Usinas do SIGA com fase, potência e coordenadas (CSV)": "SIGA plants with phase, capacity and coordinates (CSV)",
  "Capacidade em operação por UF, tipo e origem (CSV)": "Capacity in operation by state (UF), type and origin (CSV)",
  "Tarifa Social: série mensal nacional (SCS)": "Tarifa Social: national monthly series (SCS)",
  "Tarifa Social por distribuidora e mês (SCS)": "Tarifa Social by distribution utility and month (SCS)",
  "PNAD Contínua: acesso à energia elétrica": "PNAD Contínua: access to electricity", // i18n: dado (PNAD Contínua é o nome da pesquisa)
  // evidências (entidade da taxa nacional de perdas)
  "Concessionárias de distribuição (Brasil)": "distribution concession holders in Brazil",

  /* ---------------- Visão geral: determinantes (sintese.json, multiplos) */
  Preço: "Price",
  Água: "Water",
  Geração: "Generation",
  Carga: "Load",
  Rede: "Grid",
  "Em que nível está o PLD médio diário?": "At what level is the daily average PLD?",
  "Quanto da capacidade de armazenamento está ocupado?": "How much of the storage capacity is filled?",
  "Quanto da geração veio de térmicas?": "How much of the generation came from thermal plants?",
  "Quanto o sistema está consumindo?": "How much is the system consuming?",
  "Para onde a energia está fluindo entre as regiões?": "Where is energy flowing between regions?",
  "EAR do SIN": "SIN stored energy (EAR)",
  "Térmica, janela de 7 dias": "Thermal, 7-day window",
  "Carga do SIN": "SIN load",
  "SIN, 7 dias": "SIN, 7 days",
  SIN: "SIN",
  "R$/MWh": "R$/MWh",
  "25º a 75º percentil das médias diárias do Sudeste/Centro-Oeste desde 2021": "25th to 75th percentile of the Southeast/Center-West daily averages since 2021",
  "10º a 90º percentil da data (2001 ao ano anterior)": "10th to 90th percentile for the date (2001 to the previous year)",
  "10º a 90º percentil das janelas de 7 dias dos 365 dias anteriores": "10th to 90th percentile of the 7-day windows of the previous 365 days",
  "Mesmo dia da semana do ano anterior, 364 dias antes (só no mesmo regime metodológico)":
    "Same weekday of the previous year, 364 days earlier (only within the same methodological regime)",
  "Zero separa os dois sentidos de cada fronteira": "Zero separates the two directions of each border",
  "Média simples das 24 horas de cada dia, em valores nominais; não é a tarifa do consumidor.": "Simple average of the 24 hours of each day, in nominal values; it is not the consumer tariff.",
  "Razão das somas da energia armazenada e da capacidade dos quatro subsistemas.": "Ratio of the sums of stored energy and of capacity of the four subsystems.",
  "Participação na soma da geração verificada hidráulica, térmica, eólica e solar do balanço do ONS (a solar inclui a MMGD estimada desde 29/04/2023).":
    "Share of the sum of verified hydro, thermal, wind and solar generation in the ONS balance (solar includes the estimated MMGD since Apr 29, 2023).",
  "Inclui a estimativa de micro e minigeração distribuída do ONS desde 29/04/2023; temperatura e calendário não são ajustados.":
    "Includes the ONS estimate of distributed micro and mini generation since Apr 29, 2023; temperature and calendar are not adjusted.",
  "Fluxo médio verificado, positivo da primeira para a segunda ponta de cada fronteira. Este painel não compara o fluxo com limites de intercâmbio: fluxo alto não indica congestionamento.":
    "Average verified flow, positive from the first to the second end of each border. This panel does not compare the flow with interchange limits: high flow does not indicate congestion.",
  "% da EAR máxima": "% of maximum EAR",
  "% da geração verificada": "% of verified generation",
  "% da geração do balanço": "% of balance generation",
  "% da geração possível": "% of possible generation",
  "% da MLT": "% of MLT",
  MWmed: "MWavg",
  horas: "hours",
  dias: "days",
  revisões: "revisions",
  conjuntos: "datasets",
  "Valores copiados das bases publicadas de origem, sem recálculo nem preenchimento: dia sem valor na origem fica sem valor aqui. Escala vertical própria de cada painel (unidades diferentes).":
    "Values copied from the published source bases, with no recalculation or filling: a day with no value at the source has no value here. Each panel has its own vertical scale (different units).",

  /* ---------------- Visão geral: frases (P004) */
  "EAR do SIN = soma das EAR verificadas dos quatro subsistemas (MWmês) ÷ soma das EAR máximas. Mediana, 10º e 90º percentis do valor do mesmo dia do calendário nos anos completos anteriores, desde 2001. Para 29 de fevereiro usa-se 28 de fevereiro.":
    "SIN EAR = sum of the verified EAR of the four subsystems (MWmonth) ÷ sum of the maximum EAR. Median, 10th and 90th percentiles of the value on the same calendar day in the previous complete years, since 2001. For February 29, February 28 is used.",
  "ENA de 30 dias em % da MLT = soma da ENA bruta dos 30 dias ÷ soma da MLT implícita de cada dia (ENA ÷ percentual da MLT informado pelo ONS).":
    "30-day ENA as % of MLT = sum of the gross ENA of the 30 days ÷ sum of the implied MLT of each day (ENA ÷ percentage of MLT reported by ONS).",
  "Média dos últimos 7 ou 30 dias contra os mesmos dias do ano anterior, apenas quando os dois períodos estão no mesmo regime metodológico declarado pelo ONS.":
    "Average of the last 7 or 30 days versus the same days of the previous year, only when both periods are in the same methodological regime declared by ONS.",
  "Participação térmica dos últimos 7 dias comparada às participações térmicas de todas as janelas móveis de 7 dias dos 365 dias anteriores: percentil e mediana.":
    "Thermal share of the last 7 days compared with the thermal shares of all 7-day moving windows of the previous 365 days: percentile and median.",
  "Média aritmética simples das 24 horas do dia (horário local de Brasília). Percentil da média diária do dia de referência na distribuição das médias diárias do mesmo submercado desde 01/01/2021, em valores nominais. Faixa baixa: abaixo do 25º percentil. Central: do 25º ao 75º. Alta: acima do 75º.": // i18n: dado
    "Simple arithmetic average of the 24 hours of the day (Brasília local time). Percentile of the daily average of the reference day in the distribution of daily averages of the same submarket since Jan 1, 2021, in nominal values. Low range: below the 25th percentile. Central: from the 25th to the 75th. High: above the 75th.",
  "Fluxo diário = média das 24 horas do intercâmbio verificado entre subsistemas, com sinal: positivo da primeira para a segunda ponta (N→NE, N→SE/CO, NE→SE/CO, S→SE/CO).":
    "Daily flow = average of the 24 hours of verified interchange between subsystems, with sign: positive from the first to the second end (N→NE, N→SE/CW, NE→SE/CW, S→SE/CW).",
  "previsão de geração das usinas não despachadas pelo ONS, somada pela fonte (não é medição)": "generation forecast for the plants not dispatched by ONS, added by the source (not a measurement)",
  "estimativa da MMGD com base em dados meteorológicos previstos, somada pela fonte e não publicada separada (declarada pelo ONS a partir de 29/04/2023; observada nos dados a partir de 01/05/2023)":
    "estimate of MMGD based on forecast weather data, added by the source and not published separately (declared by ONS from Apr 29, 2023; observed in the data from May 1, 2023)",
  "estimativa da micro e minigeração distribuída somada pelo ONS à geração solar do balanço": "estimate of distributed micro and mini generation added by ONS to the solar generation of the balance",
  "Frases e alertas montados por regras fixas a partir dos dados processados; nenhum texto é redigido livremente. Cada número leva à evidência.":
    "Sentences and alerts built by fixed rules from the processed data; no text is written freely. Each number leads to its evidence.",

  /* ---------------- Visão geral: caixa de destaques */
  "Nenhuma regra de sistema com alerta confirmado nos últimos 14 dias nesta publicação.": "No system rule with an alert confirmed in the last 14 days in this publication.",
  "Frases e destaques são fatos: cada número vem de uma base publicada de origem com caminho e versão. Hipóteses aparecem só nos destaques, rotuladas, como lista fixa por regra, sem teste nesta página; o link indica onde os dados para verificá-las estão.":
    "Sentences and highlights are facts: each number comes from a published source base with its path and version. Hypotheses appear only in the highlights, labeled, as a fixed list per rule, untested on this page; the link shows where the data to check them is.",
  "Só regras sobre o sistema (as de qualidade dos dados ficam na lista completa), com a duração mínima atingida e confirmadas há menos de 14 dias: a caixa responde o que mudou, e uma condição que já dura mais que isso continua no o que observar com a duração do episódio. Ordem pela raridade no histórico (menor fração de dias em alerta primeiro); no máximo três. Hipóteses listadas por regra são fixas, não testadas aqui, e indicam o painel onde a verificação seria feita.":
    "Only rules about the system (data quality rules are in the full list), with the minimum duration reached and confirmed less than 14 days ago: the box answers what changed, and a condition that has lasted longer stays in what to watch, with the duration of the episode. Ordered by rarity in the history (smallest share of days in alert first); at most three. The hypotheses listed for each rule are fixed, not tested here, and point to the panel where the check would be made.",

  /* ---------------- Visão geral: regras do "O que observar" (títulos) */
  "Armazenamento em nível extremo para a data": "Storage at an extreme level for the date",
  "Afluência de 30 dias em nível extremo": "30-day inflow at an extreme level",
  "Participação térmica extrema": "Extreme thermal share",
  "Carga diária entre as mais altas do ano": "Daily load among the highest of the year",
  "Preços separados entre submercados": "Prices separated between submarkets",
  "PLD no piso o dia inteiro": "PLD at the floor all day",
  "PLD no teto horário ou estrutural": "PLD at the hourly or structural ceiling",
  "Restrição de geração eólica entre as maiores do último ano": "Wind generation restriction among the largest of the last year",
  "Restrição de geração solar centralizada entre as maiores do último ano": "Centralized solar generation restriction among the largest of the last year",
  "Revisão material de dado já publicado": "Material revision of already published data",
  "Série de PLD sem atualização recente": "PLD series without a recent update",
  "Fonte desta página com atualização atrasada": "Source of this page with a late update",
  "CMO publicado pelo ONS para a semana operativa mais recente": "CMO published by ONS for the most recent operating week",

  /* ---------------- regras: condição */
  "EAR do SIN abaixo do 5º ou acima do 95º percentil do mesmo dia do calendário nos anos completos anteriores (desde 2001).":
    "SIN EAR below the 5th or above the 95th percentile of the same calendar day in the previous complete years (since 2001).",
  "ENA do SIN acumulada em 30 dias (% da MLT) abaixo do 5º ou acima do 95º percentil da mesma janela nos anos completos anteriores (desde 2001).":
    "SIN ENA accumulated over 30 days (% of MLT) below the 5th or above the 95th percentile of the same window in the previous complete years (since 2001).",
  "Participação térmica dos últimos 7 dias acima do 95º ou abaixo do 5º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes, todas no regime do balanço iniciado em 29/04/2023.":
    "Thermal share of the last 7 days above the 95th or below the 5th percentile of the 7-day windows ending 7 to 371 days earlier, all within the balance regime that began on Apr 29, 2023.",
  "Carga do SIN no dia acima do 95º percentil dos 364 dias anteriores, todos no mesmo regime metodológico declarado pelo ONS.":
    "SIN load on the day above the 95th percentile of the previous 364 days, all within the same methodological regime declared by ONS.",
  "Diferença entre o maior e o menor PLD médio diário dos quatro submercados de pelo menos 10% da média dos quatro e de pelo menos R$ 5,00/MWh.":
    "Difference between the highest and the lowest daily average PLD of the four submarkets of at least 10% of the average of the four and of at least R$ 5.00/MWh.",
  "Algum submercado com as 24 horas do dia no PLD mínimo vigente (igual ao centavo).": "Some submarket with all 24 hours of the day at the PLD floor in force (equal to the cent).",
  "Alguma hora no PLD máximo horário ou média diária no PLD máximo estrutural, em algum submercado.": "Some hour at the hourly PLD ceiling or a daily average at the structural PLD ceiling, in some submarket.",
  "Taxa de restrição eólica do SIN em 7 dias (energia não gerada ÷ geração verificada mais não gerada) acima do 95º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.":
    "SIN 7-day wind restriction rate (energy not generated ÷ verified plus not generated) above the 95th percentile of the 7-day windows ending 7 to 371 days earlier.",
  "Taxa de restrição fotovoltaica do SIN em 7 dias acima do 95º percentil das janelas de 7 dias terminadas de 7 a 371 dias antes.":
    "SIN 7-day photovoltaic restriction rate above the 95th percentile of the 7-day windows ending 7 to 371 days earlier.",
  "Alguma captura dos últimos 7 dias trouxe revisão material de série usada nesta página (EAR, ENA, carga, balanço, intercâmbio, PLD, CMO): variação de pelo menos 1% do valor anterior e acima do piso da unidade (0,1 p.p., 10 MWmed ou MWmês, R$ 0,01/MWh).":
    "Some capture in the last 7 days brought a material revision of a series used on this page (EAR, ENA, load, balance, interchange, PLD, CMO): a change of at least 1% of the previous value and above the unit floor (0.1 p.p., 10 MWavg or MWmonth, R$ 0.01/MWh).", // i18n: dado
  "Último dia de PLD integrado mais de 2 dias antes da data de processamento, contada no horário de Brasília.": "Last integrated PLD day more than 2 days before the processing date, counted in Brasília time.",
  "Algum conjunto usado nesta página com situação ATRASADO no painel de saúde dos dados (prazo derivado da frequência declarada pela fonte).":
    "Some dataset used on this page with LATE status in the data health panel (deadline derived from the frequency declared by the source).",
  "Evento conhecido: publicação semanal do CMO (modelo DECOMP). Não é previsão da Scrutiniums.": "Known event: weekly publication of the CMO (DECOMP model). It is not a Scrutiniums forecast.",

  /* ---------------- regras: limiar */
  "5º e 95º percentis da data para o SIN (a faixa usual do painel Água, do 10º ao 90º, fica como contexto)":
    "5th and 95th percentiles of the date for the SIN (the usual range of the Water panel, from the 10th to the 90th, stays as context)",
  "5º e 95º percentis da mesma janela para o SIN (a faixa usual do painel Água, do 10º ao 90º, fica como contexto)":
    "5th and 95th percentiles of the same window for the SIN (the usual range of the Water panel, from the 10th to the 90th, stays as context)",
  "5º e 95º percentis das 365 janelas anteriores (a faixa usual de geracao.json#termica_contexto, do 10º ao 90º, fica como contexto)":
    "5th and 95th percentiles of the previous 365 windows (the usual range of geracao.json#termica_contexto, from the 10th to the 90th, stays as context)",
  "95º percentil dos 364 dias anteriores": "95th percentile of the previous 364 days",
  "max(R$ 5,00/MWh; 10% da média dos quatro PLD médios do dia)": "max(R$ 5.00/MWh; 10% of the average of the four daily average PLDs)",
  "PLD mínimo do ano (ato da ANEEL), conferido hora a hora no módulo PLD": "PLD floor of the year (ANEEL act), checked hour by hour in the PLD module",
  "PLD máximo horário e estrutural do ano (ato da ANEEL)": "Hourly and structural PLD ceilings of the year (ANEEL act)",
  "95º percentil das 365 janelas anteriores": "95th percentile of the previous 365 windows",
  "1% do valor anterior e piso por unidade": "1% of the previous value and a floor per unit",
  "2 dias": "2 days",
  "tolerância por cadência do módulo Dados (diária 2 dias, semanal 7, mensal 60, anual 365)": "tolerance by update frequency in the Data module (daily 2 days, weekly 7, monthly 60, annual 365)",

  /* ---------------- regras: retorno */
  "Volta ao normal depois de 7 dias seguidos com o SIN entre o 5º e o 95º percentil da data.": "Returns to normal after 7 consecutive days with the SIN between the 5th and the 95th percentile of the date.",
  "Volta ao normal depois de 7 dias seguidos com o SIN entre o 5º e o 95º percentil da janela.": "Returns to normal after 7 consecutive days with the SIN between the 5th and the 95th percentile of the window.",
  "Volta ao normal depois de 7 dias seguidos entre o 5º e o 95º percentil.": "Returns to normal after 7 consecutive days between the 5th and the 95th percentile.",
  "Volta ao normal depois de 3 dias seguidos abaixo do 95º percentil.": "Returns to normal after 3 consecutive days below the 95th percentile.",
  "Volta ao normal depois de 3 dias seguidos com a diferença abaixo do limiar.": "Returns to normal after 3 consecutive days with the difference below the threshold.",
  "Volta ao normal depois de 3 dias seguidos em que nenhum submercado passa o dia inteiro no piso.": "Returns to normal after 3 consecutive days in which no submarket spends the whole day at the floor.",
  "Volta ao normal depois de 7 dias seguidos sem hora no teto horário e sem média no teto estrutural.": "Returns to normal after 7 consecutive days with no hour at the hourly ceiling and no average at the structural ceiling.",
  "Volta ao normal depois de 7 dias seguidos abaixo do 95º percentil.": "Returns to normal after 7 consecutive days below the 95th percentile.",
  "Volta ao normal quando passam 7 dias sem captura com revisão material (a janela de 7 dias está na própria condição).":
    "Returns to normal when 7 days pass with no capture with a material revision (the 7-day window is in the condition itself).",
  "Volta ao normal na primeira publicação com o PLD de até 2 dias antes do processamento.": "Returns to normal at the first publication with a PLD from at most 2 days before processing.",
  "Volta ao normal quando todos os conjuntos usados estão em dia ou sem prazo declarado.": "Returns to normal when all datasets used are up to date or have no declared deadline.",
  "Substituído pela publicação da semana seguinte.": "Replaced by the publication of the following week.",

  /* ---------------- regras: materialidade */
  "O 5º e o 95º percentis deixam de fora um em cada dez anos para a data: o alerta é para nível extremo, não para nível apenas fora do usual. Com a faixa usual (10º a 90º) a regra ficaria em alerta em cerca de um quarto dos dias desde 2021 e, somada às demais, ocuparia a caixa de destaques na maior parte do tempo (alternativas publicadas com a frequência). A EAR muda devagar: 7 dias seguidos separam situação persistente de oscilação perto da borda. A regra olha o SIN; o detalhe por subsistema vai no texto e no painel Água.":
    "The 5th and 95th percentiles leave out one in every ten years for the date: the alert is for an extreme level, not for a level that is merely outside the usual. With the usual range (10th to 90th) the rule would be in alert on about a quarter of the days since 2021 and, together with the others, would fill the highlights box most of the time (alternatives published with their frequency). EAR changes slowly: 7 consecutive days separate a persistent situation from oscillation near the edge. The rule looks at the SIN; the detail by subsystem goes in the text and in the Water panel.",
  "A janela de 30 dias já suaviza eventos curtos; 7 dias seguidos além do 5º ou do 95º percentil indicam um mês extremamente úmido ou seco frente à mesma janela dos anos anteriores. Com a faixa usual a regra dispararia em cerca de um quarto dos dias desde 2021, e com os quatro subsistemas em cerca de dois de cada três (alternativas publicadas).":
    "The 30-day window already smooths short events; 7 consecutive days beyond the 5th or the 95th percentile indicate an extremely wet or dry month compared with the same window of previous years. With the usual range the rule would trigger on about a quarter of the days since 2021, and with the four subsystems on about two of every three (alternatives published).",
  "A janela de 7 dias tira o ciclo da semana; o 5º e o 95º percentis marcam o extremo do último ano, e 7 dias seguidos além deles evitam que uma semana atípica isolada vire alerta.":
    "The 7-day window removes the weekly cycle; the 5th and 95th percentiles mark the extreme of the last year, and 7 consecutive days beyond them keep an isolated atypical week from becoming an alert.",
  "O 95º percentil marca os cerca de 18 dias mais altos de um ano; exigir 2 dias seguidos tira o pico isolado de um único dia útil.":
    "The 95th percentile marks the roughly 18 highest days of a year; requiring 2 consecutive days removes an isolated peak on a single working day.",
  "O limiar relativo acompanha o nível de preço (R$ 5 é muito perto do piso e pouco num preço alto); 3 dias seguidos separam separação persistente de horas isoladas.":
    "The relative threshold follows the price level (R$ 5 is very close to the floor and little at a high price); 3 consecutive days separate persistent separation from isolated hours.",
  "O piso é limite regulatório: um dia inteiro nele indica que o limite, e não o custo marginal, determinou o preço em todas as horas; 3 dias seguidos tiram dias isolados de carga baixa.":
    "The floor is a regulatory limit: a whole day at it indicates that the limit, and not the marginal cost, set the price in every hour; 3 consecutive days remove isolated days of low load.",
  "Atingir o teto é material por definição (o limite regulatório determinou o preço); por isso basta um dia, e o retorno exige uma semana para não alternar o alerta.":
    "Reaching the ceiling is material by definition (the regulatory limit set the price); that is why one day is enough, and the return requires a week so that the alert does not flip back and forth.",
  "Comparação com o próprio último ano, porque a taxa cresceu muito desde 2021; só o lado de cima importa (restrição baixa não é alerta); o 95º percentil e 7 dias seguidos separam mudança persistente de dias de vento atípico. Com o 90º percentil a regra ficaria em alerta em cerca de um quarto dos dias (alternativa publicada).":
    "Comparison with its own last year, because the rate has grown a lot since 2021; only the upper side matters (a low restriction is not an alert); the 95th percentile and 7 consecutive days separate a persistent change from days of atypical wind. With the 90th percentile the rule would be in alert on about a quarter of the days (alternative published).",
  "Mesma regra da eólica; o registro de restrições fotovoltaicas começa em abril de 2024, então o histórico avaliável é mais curto.":
    "Same rule as for wind; the record of photovoltaic restrictions begins in April 2024, so the assessable history is shorter.",
  "Revisão abaixo de 1% raramente muda o número exibido com uma casa; o piso por unidade ignora variações de centésimos em valores perto de zero.":
    "A revision below 1% rarely changes the number displayed with one decimal place; the unit floor ignores changes of hundredths in values near zero.",
  "A CCEE publica o PLD do dia seguinte na véspera; mais de 2 dias de distância indica coleta parada, não oscilação.": "CCEE publishes the next day's PLD the day before; a gap of more than 2 days indicates stalled collection, not fluctuation.",
  "Um número de fonte atrasada continua válido para o seu período, mas não descreve o presente.": "A number from a late source remains valid for its period, but it does not describe the present.",
  "Evento de calendário; sempre listado.": "Calendar event; always listed.",

  /* ---------------- regras: o que não implica */
  "Nível extremo não quer dizer risco de suprimento nem explica o preço; a capacidade máxima de armazenamento mudou ao longo do tempo.":
    "An extreme level does not mean supply risk nor does it explain the price; the maximum storage capacity has changed over time.",
  "Afluência extrema não diz quanto vira armazenamento nem como o preço reage.": "An extreme inflow does not say how much becomes storage nor how the price reacts.",
  "Participação térmica alta ou baixa não indica, sozinha, escassez de água nem custo maior para o consumidor.": "A high or low thermal share does not indicate, on its own, water scarcity or higher cost for the consumer.",
  "Carga alta não mede atividade econômica nem indica, por si, falta de capacidade.": "High load does not measure economic activity nor does it indicate, by itself, a lack of capacity.",
  "Preços diferentes entre submercados não identificam qual restrição de transmissão atuou; os limites de intercâmbio não fazem parte desta regra.":
    "Different prices between submarkets do not identify which transmission restriction was binding; interchange limits are not part of this rule.",
  "Preço no piso não quer dizer energia sem custo nem sobra garantida de água.": "A price at the floor does not mean energy at no cost nor a guaranteed surplus of water.",
  "Preço no teto não identifica a causa nem indica, sozinho, risco de suprimento.": "A price at the ceiling does not identify the cause nor indicate, on its own, supply risk.",
  "A taxa vem de estimativa do ONS da geração possível; restrição alta não identifica sozinha a razão (elétrica, energética ou de confiabilidade).":
    "The rate comes from the ONS estimate of possible generation; a high restriction does not on its own identify the reason (electrical, energy or reliability).",
  "Não inclui micro e minigeração distribuída, que fica fora do registro de restrições do ONS; restrição alta não identifica a razão.":
    "It does not include distributed micro and mini generation, which is outside the ONS restriction record; a high restriction does not identify the reason.",
  "Revisão é prática normal da fonte (dados verificados substituem dados preliminares) e não indica erro.": "Revision is normal practice for the source (verified data replace preliminary data) and does not indicate an error.",
  "Atraso de integração não diz nada sobre o preço.": "An integration delay says nothing about the price.",
  "Atraso pode ser da fonte (não publicou) ou da integração; o painel Dados separa os dois casos.": "A delay may come from the source (it did not publish) or from the integration; the Data panel separates the two cases.",
  "CMO é resultado de modelo do ONS; não é o PLD nem previsão de preço.": "The CMO is an output of an ONS model; it is not the PLD nor a price forecast.",
  "Alerta descreve uma condição medida nos dados publicados; não implica causa, não é previsão e não recomenda decisão.":
    "An alert describes a condition measured in the published data; it does not imply cause, it is not a forecast and it does not recommend a decision.",

  /* ---------------- regras: hipóteses */
  "Afluência acima ou abaixo da média nas semanas anteriores": "Inflow above or below average in the previous weeks",
  "Mudança no uso da água para geração (despacho hidráulico)": "Change in the use of water for generation (hydro dispatch)",
  "Chuva acima ou abaixo da média nas bacias": "Rainfall above or below average in the basins",
  "Despacho por razão elétrica, por segurança energética ou por ordem de mérito": "Dispatch for electrical reasons, for energy security or by merit order",
  "Variação da geração hidráulica, eólica ou solar": "Variation in hydro, wind or solar generation",
  "Temperatura acima da média": "Temperature above average",
  "Calendário (dias úteis seguidos, ausência de feriados)": "Calendar (consecutive working days, absence of holidays)",
  "Fluxo entre subsistemas perto de algum limite operativo": "Flow between subsystems close to an operating limit",
  "Custo marginal de operação abaixo do piso (CMO do DESSEM)": "Marginal operating cost below the floor (DESSEM CMO)",
  "Custo marginal acima do teto em horas de carga alta": "Marginal cost above the ceiling in hours of high load",
  "Limitação de transmissão no Nordeste (razão elétrica)": "Transmission limitation in the Northeast (electrical reason)",
  "Sobra de energia frente à carga (razão energética)": "Energy surplus relative to load (energy reason)",
  "Sobra de energia nas horas de sol (razão energética)": "Energy surplus in the sunlight hours (energy reason)",
  "Consolidação de medição pela fonte nos dias mais recentes": "Consolidation of measurements by the source in the most recent days",

  /* ---------------- regras: histórico e registro */
  "Regra sobre o estado da integração, avaliada a cada processamento; o registro das publicações está no silver sintese, conjunto _visao_alertas.":
    "Rule about the state of the integration, assessed at each processing run; the record of publications is in the silver sintese, dataset _visao_alertas.",
  "A situação vem do painel de saúde dos dados (publicacao.json), recalculada a cada processamento; os conjuntos avaliados são os das frases, dos determinantes, de energia e sociedade e das regras publicadas.":
    "The status comes from the data health panel (publicacao.json), recalculated at each processing run; the datasets assessed are those of the sentences, the determinants, energy and society, and the published rules.",
  "Evento de calendário, não regra de alerta.": "Calendar event, not an alert rule.",
  "Estados das publicações aceitas (gold em public/energia/gold), registrados a partir da publicação seguinte; uma gold que virou stub ou que a sentinela rejeitou não entra. Mede quantos alertas publicados deixaram de se confirmar quando a fonte revisou os dados (regras sem histórico diário não são conferidas).": // i18n: dado
    "States of the accepted publications (gold in public/energia/gold), recorded from the following publication; a gold that became a stub or that the sentinel rejected is not included. It measures how many published alerts failed to be confirmed when the source revised the data (rules without a daily history are not checked).",
  "Cada regra é reavaliada em todos os dias desde 01/01/2021 com os dados vigentes na data de processamento (já revisados): mostra quantas vezes teria disparado e por quanto tempo, não o que se via na época. Cada regra só é avaliável quando a base dela existe (primeiro_dia_avaliado no histórico de cada uma). O registro dos alertas publicados fica no silver sintese, conjunto _visao_alertas, gravado a partir da gold aceita.": // i18n: dado
    "Each rule is reassessed on every day since Jan 1, 2021 with the data in force on the processing date (already revised): it shows how often it would have triggered and for how long, not what was seen at the time. Each rule can only be assessed when its base exists (primeiro_dia_avaliado in the history of each one). The record of published alerts is in the silver sintese, dataset _visao_alertas, written from the accepted gold.",
  "Não há verdade de referência para chamar um alerta de falso. Publicam-se a frequência de disparo, os acionamentos curtos que a duração mínima descartou, a sensibilidade a outras durações, a frequência conjunta da caixa de destaques e, com o registro das publicações, os alertas que deixaram de se confirmar quando a fonte revisou os dados.":
    "There is no ground truth for calling an alert false. What is published is the trigger frequency, the short triggers that the minimum duration discarded, the sensitivity to other durations, the joint frequency of the highlights box and, with the record of publications, the alerts that failed to be confirmed when the source revised the data.",

  /* ---------------- regras: variantes avaliadas e não adotadas */
  "Algum dos quatro subsistemas fora da faixa usual da data (10º a 90º percentil), regra original da síntese.":
    "Any of the four subsystems outside the usual range for the date (10th to 90th percentile), the original rule of the synthesis.",
  "Algum dos quatro subsistemas fora da faixa usual da janela (10º a 90º percentil), regra original da síntese.":
    "Any of the four subsystems outside the usual range for the window (10th to 90th percentile), the original rule of the synthesis.",
  "EAR do SIN fora da faixa usual da data (10º a 90º percentil), regra da versão anterior da síntese.":
    "SIN EAR outside the usual range for the date (10th to 90th percentile), the rule of the previous version of the synthesis.",
  "ENA de 30 dias do SIN fora da faixa usual da janela (10º a 90º percentil), regra da versão anterior da síntese.":
    "SIN 30-day ENA outside the usual range for the window (10th to 90th percentile), the rule of the previous version of the synthesis.",
  "Participação térmica fora do 10º ao 90º percentil das 365 janelas anteriores, regra da versão anterior da síntese.":
    "Thermal share outside the 10th to 90th percentile of the previous 365 windows, the rule of the previous version of the synthesis.",
  "Taxa de 7 dias acima do 90º percentil das 365 janelas anteriores, regra da versão anterior da síntese.":
    "7-day rate above the 90th percentile of the previous 365 windows, the rule of the previous version of the synthesis.",
  "Frequência de alerta alta demais para uma síntese: somada às demais regras, ocupa a caixa de destaques na maior parte dos dias (ruído); mantida aqui para comparação.":
    "Alert frequency too high for a synthesis: together with the other rules, it fills the highlights box on most days (noise); kept here for comparison.",

  /* ---------------- Visão geral: energia e sociedade (P006) */
  "Tarifa residencial de referência": "Reference residential tariff",
  "Continuidade do fornecimento": "Continuity of supply",
  "Perdas na distribuição": "Distribution losses",
  "Alcance da Tarifa Social": "Reach of the Tarifa Social",
  "Quanto custa a energia para uma residência, antes de tributos?": "How much does energy cost for a household, before taxes?",
  "Quanto tempo e quantas vezes, em média, cada consumidor ficou sem energia no ano?": "How long and how many times, on average, was each consumer without power in the year?",
  "Quanto da energia injetada nas redes de distribuição se perdeu?": "How much of the energy injected into the distribution networks was lost?",
  "Quantas unidades consumidoras recebem o desconto da Tarifa Social?": "How many consumer units receive the Tarifa Social discount?",
  "Sem tributos, sem bandeira e sem iluminação pública; não é a conta de luz nem o preço da energia no dia.":
    "Without taxes, tariff flag or public lighting; it is not the electricity bill nor the price of energy on the day.",
  "Média anual ponderada pelas unidades consumidoras de cada conjunto; centésimos de hora não são minutos.": "Annual average weighted by the consumer units of each set; hundredths of an hour are not minutes.",
  "Perdas técnicas e não técnicas somadas; a separação só existe para parte das distribuidoras.": "Technical and non-technical losses added together; the split exists only for some distribution utilities.",
  "Contagem de unidades consumidoras com desconto, não de famílias; a cobertura frente às famílias elegíveis é uma aproximação (painel Inclusão).":
    "Count of consumer units with the discount, not of families; coverage relative to eligible families is an approximation (Inclusion panel).",
  "25º a 75º percentil entre distribuidoras": "25th to 75th percentile across distribution utilities",
  "Custo mensal de 200 kWh na tarifa mediana": "Monthly cost of 200 kWh at the median tariff",
  "FEC (interrupções por unidade consumidora)": "FEC (interruptions per consumer unit)",
  "Limite regulatório agregado do DEC": "Aggregate regulatory DEC limit",
  "Participação nas unidades consumidoras residenciais": "Share of residential consumer units",
  "Faturas com desconto da Tarifa Social no arquivo de Beneficiários da CDE (outra fonte, mês mais recente)":
    "Bills with the Tarifa Social discount in the CDE Beneficiaries file (another source, most recent month)",
  "R$/mês": "R$/month",
  interrupções: "interruptions",
  "horas por unidade consumidora (DEC)": "hours per consumer unit (DEC)",
  "% da energia injetada": "% of injected energy",
  "unidades consumidoras": "consumer units",
  "% das UC residenciais": "% of residential consumer units",
  "faturas de faturamento com desconto no mês": "bills with a discount in the month",
  "Cada indicador mantém o período de referência do módulo de origem (vigência, ano ou mês) e a cobertura declarada; nenhum é apresentado como situação do dia. Valores, evidências e definições são os dos módulos.":
    "Each indicator keeps the reference period of its source module (validity period, year or month) and the declared coverage; none is presented as the situation of the day. Values, evidence and definitions are those of the modules.",

  /* ---------------- Visão geral: limitações e notas da publicação */
  "A síntese reutiliza os números das bases publicadas de origem; limitações de cada fonte valem aqui e estão na proveniência de cada painel de origem.":
    "The synthesis reuses the numbers of the published source bases; the limitations of each source apply here and are in the provenance of each source panel.",
  "O histórico das regras usa os dados da data de processamento, já revisados; não reproduz o que um leitor via em cada data passada.":
    "The history of the rules uses the data of the processing date, already revised; it does not reproduce what a reader saw on each past date.",
  "Cada regra tem o próprio histórico avaliável (primeiro dia avaliado e número de dias avaliados): a carga extrema só é avaliada com os 364 dias anteriores no mesmo regime do ONS (de 01/01 a 28/02/2021, de 28/02/2022 a 28/04/2023 e desde 27/04/2024); a térmica, a restrição eólica e a fotovoltaica começam depois de 2021 por exigirem 365 janelas anteriores no mesmo regime ou universo.":
    "Each rule has its own assessable history (first day assessed and number of days assessed): extreme load is only assessed with the previous 364 days in the same ONS regime (from Jan 1 to Feb 28, 2021, from Feb 28, 2022 to Apr 28, 2023 and since Apr 27, 2024); thermal, wind restriction and photovoltaic restriction start after 2021 because they require 365 previous windows in the same regime or universe.",
  "As revisões entre capturas só existem a partir das capturas versionadas (silver principal desde 27/09/2026); antes disso não há como medi-las.":
    "Revisions between captures only exist from the versioned captures onward (main silver since Sep 27, 2026); before that there is no way to measure them.",
  "Restrições de eólicas e fotovoltaicas usam a geração possível estimada pelo ONS; o registro fotovoltaico começa em abril de 2024.":
    "Wind and photovoltaic restrictions use the possible generation estimated by ONS; the photovoltaic record begins in April 2024.",
  "Os indicadores de energia e sociedade têm períodos de referência diferentes (vigência, ano, mês) e não descrevem o dia.":
    "The energy and society indicators have different reference periods (validity period, year, month) and do not describe the day.",
  "Estados diários das regras desde 2021 (CSV)": "Daily states of the rules since 2021 (CSV)",
  "Episódios de alerta das regras (CSV)": "Alert episodes of the rules (CSV)",
  "Determinantes alinhados, últimos 90 dias (CSV)": "Aligned determinants, last 90 days (CSV)",
  "Revisões entre capturas das séries da Visão geral (CSV)": "Revisions between captures of the Overview series (CSV)",
  "Revisões entre capturas (CSV)": "Revisions between captures (CSV)",
};

/** A forma inglesa de um texto da gold, quando a tabela a tem; null quando não tem (quem chama decide o que mostrar). */
export function traduzDaGold(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return GOLD_EN[texto.trim()] ?? null;
}

/* ------------------------------------------------------------------ frases da gold montadas com números */

/** Nome de submercado como a gold o escreve, em inglês ("Sudeste/Centro-Oeste" → "Southeast/Center-West"). */
const SUBMERCADO_POR_NOME: Readonly<Record<string, string>> = { "Sudeste/Centro-Oeste": "SE", Sul: "S", Nordeste: "NE", Norte: "N" };

/** Nome de submercado ou de fronteira da gold ("Norte → Nordeste") em inglês; parte que não se reconhece volta como veio. */
export function fronteiraEn(nome: string): string {
  return nome
    .split(" → ")
    .map((p) => (SUBMERCADO_POR_NOME[p] ? nomeSubmercado(SUBMERCADO_POR_NOME[p], "en") : p))
    .join(" → ");
}

/** Partes da Visão geral que o aviso de datas nomeia. */
const PARTES_EN: Readonly<Record<string, string>> = { preço: "price", água: "water", geração: "generation", carga: "load", rede: "grid" };

/** "acima"/"abaixo" da gold em inglês. */
const LADO_EN: Readonly<Record<string, string>> = { acima: "above", abaixo: "below", dentro: "within" };

/** Lista "a; b; c" de subsistemas fora da faixa: "Nordeste com 68,9% (acima da faixa de 14,2% a 68,0%)". */
function subsistemasForaEn(lista: string): string | null {
  const itens = lista.split("; ").map((x) => {
    const m = /^(.+?) com ([\d.,]+%)( da MLT)? \((acima|abaixo) da faixa de ([\d.,]+%) a ([\d.,]+%)\)$/.exec(x);
    if (!m) return null;
    return `${fronteiraEn(m[1])} at ${numeroEn(m[2])}${m[3] ? " of MLT" : ""} (${LADO_EN[m[4]]} the range of ${numeroEn(m[5])} to ${numeroEn(m[6])})`;
  });
  return itens.every((x) => x !== null) ? itens.join("; ") : null;
}

/** "Sudeste/Centro-Oeste 10; Sul 14" → "Southeast/Center-West 10; South 14". */
function horasPorSubmercadoEn(lista: string): string | null {
  const itens = lista.split("; ").map((x) => {
    const m = /^(.+?) (\d+)$/.exec(x);
    return m ? `${fronteiraEn(m[1])} ${m[2]}` : null;
  });
  return itens.every((x) => x !== null) ? itens.join("; ") : null;
}

const N = String.raw`[\d.,]+`;
const D = String.raw`\d{2}\/\d{2}\/\d{4}`;
const CADENCIA_EN: Readonly<Record<string, string>> = { diária: "daily", semanal: "weekly", mensal: "monthly", anual: "annual" };

/**
 * Modelos das frases da gold que levam números e datas: o texto português é reconhecido por expressão regular e a frase inglesa é
 * escrita com os mesmos números (na forma inglesa) e as mesmas datas. Texto que não segue nenhum modelo devolve null.
 */
const MODELOS_EN: readonly [RegExp, (m: RegExpExecArray) => string | null][] = [
  [/^(\d[\d.]*) concessionárias com os 12 meses de (\d{4}) e sem alerta$/, (m) => `${numeroEn(m[1])} concession holders with all 12 months of ${m[2]} and no alert`],
  // defasagem até o processamento
  [
    new RegExp(`^Referência (${D}), (\\d+) dias? antes da data de processamento \\((${D})\\)\\.$`),
    (m) => `Reference date ${dataEn(m[1])}, ${dias(m[2])} before the processing date (${dataEn(m[3])}).`,
  ],
  [
    /^Ano encerrado em (\d{2}\/\d{4}); o último mês completo publicado é ([a-z]{3}\/\d{4})\.$/,
    (m) => `Year ended in ${dataEn(m[1])}; the latest complete month published is ${mesEn(m[2])}.`,
  ],
  [/^Ano encerrado em (\d{2}\/\d{4}); última competência publicada ([a-z]{3}\/\d{4})\.$/, (m) => `Year ended in ${dataEn(m[1])}; latest reference month published: ${mesEn(m[2])}.`],
  [
    /^Mês de referência ([a-z]{3}\/\d{4}), (\d+) meses? antes do processamento; o conjunto (\S+) está (ATRASADO|EM DIA) no painel de saúde dos dados \((\d+) dias? além do prazo\)\.$/,
    (m) =>
      `Reference month ${mesEn(m[1])}, ${meses(m[2])} before processing; the ${m[3]} dataset is ${m[4] === "ATRASADO" ? "late" : "up to date"} in the data health panel (${dias(m[5])} past the deadline).`,
  ],
  [/^Mês de referência ([a-z]{3}\/\d{4}), (\d+) meses? antes do processamento\.$/, (m) => `Reference month ${mesEn(m[1])}, ${meses(m[2])} before processing.`],
  // aviso das datas dos determinantes
  [
    /^Os painéis estão alinhados pelo calendário e terminam em datas diferentes: (.+?)\. O trecho sem dado fica em branco\. Valores da mesma data não vêm da mesma publicação e não indicam que uma série explica a outra\.$/,
    (m) => {
      const grupos = m[1].split("; ").map((g) => {
        const x = new RegExp(`^(.+?) até (${D})$`).exec(g);
        if (!x) return null;
        const nomes = x[1].split(", ").map((n) => PARTES_EN[n]);
        return nomes.every(Boolean) ? `${nomes.join(", ")} through ${dataEn(x[2])}` : null;
      });
      if (!grupos.every(Boolean)) return null;
      return `The panels are aligned by calendar and end on different dates: ${grupos.join("; ")}. The stretch with no data is left blank. Values for the same date do not come from the same publication and do not indicate that one series explains the other.`;
    },
  ],
  // regras do "O que observar": o texto do dia
  [
    new RegExp(
      `^Em (${D}), EAR do SIN de (${N}%) da EAR máxima; o alerta exige ficar abaixo de (${N}%) \\((\\d+)º percentil da data\\) ou acima de (${N}%) \\((\\d+)º percentil\\), com mediana de (${N}%) em (\\d+) anos \\((\\d{4}) a (\\d{4})\\)\\.(?: Subsistemas fora da faixa usual do painel Água \\(10º a 90º percentil\\): (.+)\\.)?$`,
    ),
    (m) => {
      const fora = m[11] ? subsistemasForaEn(m[11]) : "";
      if (fora === null) return null;
      return `On ${dataEn(m[1])}, SIN EAR at ${numeroEn(m[2])} of maximum EAR; the alert requires falling below ${numeroEn(m[3])} (${m[4]}th percentile of the date) or rising above ${numeroEn(m[5])} (${m[6]}th percentile), with a median of ${numeroEn(m[7])} over ${m[8]} years (${m[9]} to ${m[10]}).${fora ? ` Subsystems outside the usual range of the Water panel (10th to 90th percentile): ${fora}.` : ""}`;
    },
  ],
  [
    new RegExp(
      `^Nos 30 dias até (${D}), ENA do SIN de (${N}%) da MLT; o alerta exige ficar abaixo de (${N}%) \\((\\d+)º percentil da mesma janela\\) ou acima de (${N}%) \\((\\d+)º percentil\\), com mediana de (${N}%) em (\\d+) anos \\((\\d{4}) a (\\d{4})\\)\\.(?: Subsistemas fora da faixa usual do painel Água \\(10º a 90º percentil\\): (.+)\\.)?$`,
    ),
    (m) => {
      const fora = m[11] ? subsistemasForaEn(m[11]) : "";
      if (fora === null) return null;
      return `In the 30 days through ${dataEn(m[1])}, SIN ENA at ${numeroEn(m[2])} of MLT; the alert requires falling below ${numeroEn(m[3])} (${m[4]}th percentile of the same window) or rising above ${numeroEn(m[5])} (${m[6]}th percentile), with a median of ${numeroEn(m[7])} over ${m[8]} years (${m[9]} to ${m[10]}).${fora ? ` Subsystems outside the usual range of the Water panel (10th to 90th percentile): ${fora}.` : ""}`;
    },
  ],
  [
    new RegExp(
      `^(${N}%) nos 7 dias até (${D}); o alerta exige ficar abaixo de (${N}%) \\(5º percentil\\) ou acima de (${N}%) \\(95º percentil\\) das (\\d+) janelas anteriores, com mediana de (${N}%)\\. Faixa usual do painel Geração \\(10º a 90º percentil\\): de (${N}%) a (${N}%)\\.$`,
    ),
    (m) =>
      `${numeroEn(m[1])} in the 7 days through ${dataEn(m[2])}; the alert requires falling below ${numeroEn(m[3])} (5th percentile) or rising above ${numeroEn(m[4])} (95th percentile) of the previous ${m[5]} windows, with a median of ${numeroEn(m[6])}. Usual range of the Generation panel (10th to 90th percentile): from ${numeroEn(m[7])} to ${numeroEn(m[8])}.`,
  ],
  [
    new RegExp(`^(${N}) MWmed em (${D}); 95º percentil dos (\\d+) dias anteriores: (${N}) MWmed\\.$`),
    (m) => `${numeroEn(m[1])} MWavg on ${dataEn(m[2])}; 95th percentile of the previous ${m[3]} days: ${numeroEn(m[4])} MWavg.`,
  ],
  [
    new RegExp(`^Em (${D}), diferença de R\\$ (${N})\\/MWh entre (.+?) e (.+?); limiar do dia R\\$ (${N})\\/MWh\\.$`),
    (m) => `On ${dataEn(m[1])}, a difference of R$ ${numeroEn(m[2])}/MWh between ${fronteiraEn(m[3])} and ${fronteiraEn(m[4])}; threshold of the day R$ ${numeroEn(m[5])}/MWh.`,
  ],
  [
    new RegExp(`^Em (${D}), horas no piso de R\\$ (${N})\\/MWh: (.+?) \\(de 24\\)\\.$`),
    (m) => {
      const h = horasPorSubmercadoEn(m[3]);
      return h ? `On ${dataEn(m[1])}, hours at the floor of R$ ${numeroEn(m[2])}/MWh: ${h} (out of 24).` : null;
    },
  ],
  [
    new RegExp(`^Em (${D}), horas no teto horário de R\\$ (${N})\\/MWh: (.+?)\\. Teto estrutural \\(média diária\\) de R\\$ (${N})\\/MWh (não atingido|atingido)\\.$`),
    (m) => {
      const h = horasPorSubmercadoEn(m[3]);
      if (!h) return null;
      return `On ${dataEn(m[1])}, hours at the hourly ceiling of R$ ${numeroEn(m[2])}/MWh: ${h}. Structural ceiling (daily average) of R$ ${numeroEn(m[4])}/MWh ${m[5] === "atingido" ? "reached" : "not reached"}.`;
    },
  ],
  [
    new RegExp(`^Taxa de restrição de (${N}%) nos 7 dias até (${D}); 95º percentil das janelas anteriores (${N}%) \\(mediana (${N}%)\\)\\.$`),
    (m) => `Restriction rate of ${numeroEn(m[1])} in the 7 days through ${dataEn(m[2])}; 95th percentile of the previous windows ${numeroEn(m[3])} (median ${numeroEn(m[4])}).`,
  ],
  [
    /^Capturas dos últimos 7 dias: (.+)\.$/,
    (m) => {
      const itens = m[1].split("; ").map((x) => {
        const y = new RegExp(`^(${D}) com (\\d+) revis(?:ões|ão) materia(?:is|l) em séries usadas nesta página$`).exec(x);
        return y ? `${dataEn(y[1])} with ${y[2]} material ${y[2] === "1" ? "revision" : "revisions"} in series used on this page` : null;
      });
      return itens.every(Boolean) ? `Captures of the last 7 days: ${itens.join("; ")}.` : null;
    },
  ],
  [
    /^([a-z0-9_]+): último período (\d{4})-(\d{2}), (\d+) dias? além do prazo da cadência (diária|semanal|mensal|anual)\.$/,
    (m) => `${m[1]}: latest period ${MESES_EN[Number(m[3]) - 1]} ${m[2]}, ${dias(m[4])} past the deadline of the ${CADENCIA_EN[m[5]]} update frequency.`,
  ],
  [
    new RegExp(`^Semana de referência (${D}): (.+?) R\\$ (${N})\\/MWh; (.+?) R\\$ (${N}); (.+?) R\\$ (${N}); (.+?) R\\$ (${N})\\.$`),
    (m) =>
      `Reference week ${dataEn(m[1])}: ${fronteiraEn(m[2])} R$ ${numeroEn(m[3])}/MWh; ${fronteiraEn(m[4])} R$ ${numeroEn(m[5])}; ${fronteiraEn(m[6])} R$ ${numeroEn(m[7])}; ${fronteiraEn(m[8])} R$ ${numeroEn(m[9])}.`,
  ],
  [
    new RegExp(
      `^Último dia integrado: (${D})\\. Referência (${D}), (\\d+) dias? antes da data de processamento \\((${D})\\)\\. Última tentativa de coleta direta na CCEE registrada em pld\\.json: (${D}) às (\\d{2}:\\d{2}) UTC, (bem-sucedida|sem sucesso)\\.(.*)$`,
    ),
    (m) => {
      const resto = m[8].trim();
      const bloqueio = new RegExp(
        `^O módulo PLD registrou também resposta HTTP (\\d{3}) com página "Acesso bloqueado" do firewall da origem em (${D}), também para o portal de dados abertos e para o servidor de download \\(([^)]+)\\); enquanto a origem recusar o acesso, a série só avança com nova coleta bem-sucedida\\.$`,
      ).exec(resto);
      if (resto && !bloqueio) return null;
      const extra = bloqueio
        ? ` The PLD module also recorded an HTTP ${bloqueio[1]} response with an access blocked page from the origin firewall on ${dataEn(bloqueio[2])}, also for the open data portal and for the download server (${bloqueio[3]}); while the origin refuses access, the series only moves forward with a new successful collection.`
        : "";
      return `Last integrated day: ${dataEn(m[1])}. Reference date ${dataEn(m[2])}, ${dias(m[3])} before the processing date (${dataEn(m[4])}). Last direct collection attempt at CCEE recorded in pld.json: ${dataEn(m[5])} at ${m[6]} UTC, ${m[7] === "bem-sucedida" ? "successful" : "unsuccessful"}.${extra}`;
    },
  ],
  // energia e sociedade: complementos e cobertura
  [/^DEC parcial de (\d{4}) \((\d+) meses?\) e mesmos meses do ano anterior$/, (m) => `Partial DEC for ${m[1]} (${meses(m[2])}) and the same months of the previous year`],
  [/^Acumulado de ([a-z]{3}) a ([a-z]{3}) de (\d{4}) e mesmo período do ano anterior$/, (m) => `Cumulative from ${mesEn(m[1])} to ${mesEn(m[2])} ${m[3]} and the same period of the previous year`],
  [
    /^(\d{4}) tem dados até ([a-z]{3}\/\d{4}) e não entra em comparações com anos completos; o acumulado de janeiro a ([a-zç]+) é comparado com o mesmo período de (\d{4})\.$/,
    (m) => {
      const mes = MESES_LONGOS_PT.indexOf(m[3]);
      if (mes < 0) return null;
      return `${m[1]} has data through ${mesEn(m[2])} and is not used in comparisons with complete years; the cumulative from January to ${MESES_LONGOS_EN[mes]} is compared with the same period of ${m[4]}.`;
    },
  ],
  [
    /^Soma dos meses nacionais completos de (\d{4}) até ([a-z]{3}) \(([a-z, ]+)\), comparada com os mesmos meses de (\d{4}); não é comparável a um ano completo\.(?: ([a-z]{3}\/\d{4}) fica fora \(UCs com DEC em ([\d.,]+%) do máximo dos 12 meses anteriores; NumCon implausível de ([^)]+)\)\.)?$/,
    (m) => {
      const lista = m[3].split(", ").map(mesEn).join(", ");
      const fora = m[5] ? ` ${mesEn(m[5])} is left out (consumer units with DEC at ${numeroEn(m[6])} of the maximum of the previous 12 months; implausible NumCon from ${m[7]}).` : "";
      return `Sum of the complete national months of ${m[1]} through ${mesEn(m[2])} (${lista}), compared with the same months of ${m[4]}; not comparable to a complete year.${fora}`;
    },
  ],
  [
    /^(\d+) distribuidoras com vigência na data, de (\d+) CNPJs com tarifa B1 residencial no conjunto\. (\d+) de (\d+) CNPJs\. Ponderação: nenhuma: cada distribuidora conta uma vez, independentemente do número de consumidores\.$/,
    (m) =>
      `${m[1]} distribution utilities with a validity period on the date, out of ${m[2]} CNPJs with a B1 residential tariff in the dataset. ${m[3]} of ${m[4]} CNPJs. Weighting: none: each distribution utility counts once, regardless of the number of consumers.`,
  ],
  [
    /^(\d+) conjuntos de (\d+) distribuidoras \(concessionárias e permissionárias\) que enviaram DEC em (\d{4}); só concessionárias: ([\d.,]+)\. (\d+) de (\d+) meses; em cada mês, ao menos ([\d.,]+%) das UCs com NumCon têm DEC\.$/,
    (m) =>
      `${numeroEn(m[1])} sets from ${m[2]} distribution utilities (concession and permit holders) that submitted DEC in ${m[3]}; concession holders only: ${numeroEn(m[4])}. ${m[5]} of ${m[6]} months; in each month, at least ${numeroEn(m[7])} of the consumer units with NumCon have a DEC.`,
  ],
  [
    /^(\d+) concessionárias com os 12 meses de (\d{4}) e sem alerta\. (\d+) de (\d+) concessionárias com dado em (\d{4})\.$/,
    (m) => `${m[1]} concession holders with all 12 months of ${m[2]} and no alert. ${m[3]} of ${m[4]} concession holders with data in ${m[5]}.`,
  ],
  [
    /^(\d+) distribuidoras que informaram o SCS na competência\. (\d+) distribuidoras; mês completo pela regra do módulo \(nenhuma distribuidora esperada faltando\)\.$/,
    (m) => `${m[1]} distribution utilities that reported to the SCS in the reference month. ${m[2]} distribution utilities; complete month by the module's rule (no expected distribution utility missing).`,
  ],
];

/** A forma inglesa de um texto da gold: pela tabela exata ou por um modelo com números; null quando nenhum dos dois o reconhece. */
export function traduzModeloDaGold(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const direto = traduzDaGold(texto);
  if (direto) return direto;
  const t = texto.trim();
  // nome de submercado ou de fronteira ("Nordeste → Sudeste/Centro-Oeste")
  const fronteira = fronteiraEn(t);
  if (fronteira !== t) return fronteira;
  for (const [re, f] of MODELOS_EN) {
    const m = re.exec(t);
    if (m) {
      const r = f(m);
      if (r) return r;
    }
  }
  return null;
}

/** Texto da gold dentro de uma frase em string: a forma inglesa quando existe; senão o texto como veio. */
export function goldEmString(texto: string, idioma: "pt" | "en"): string {
  if (idioma !== "en") return texto;
  return traduzModeloDaGold(texto) ?? texto;
}

/**
 * Texto da gold num bloco que o leitor vê: em português, o texto como veio; em inglês, a forma inglesa ou, sem ela, o trecho
 * marcado como só em português (TrechoPortugues), nunca português solto.
 */
export function goldNoBloco(texto: string, idioma: "pt" | "en", regiao: string): ReactNode {
  if (idioma !== "en") return texto;
  const en = traduzModeloDaGold(texto);
  return en ?? createElement(TrechoPortugues, { regiao }, texto);
}

/**
 * Nome inglês dos órgãos que publicam as fontes, como cada um se apresenta em inglês. A sigla fica (ANEEL, ONS, CCEE);
 * casas legislativas são nome próprio e ficam em português, com o equivalente entre parênteses.
 */
export const ORGAOS_EN: Readonly<Record<string, string>> = {
  ANEEL: "Brazilian Electricity Regulatory Agency",
  ONS: "National Electric System Operator",
  CCEE: "Electric Energy Trading Chamber",
  EPE: "Energy Research Office",
  MME: "Ministry of Mines and Energy",
  IBGE: "Brazilian Institute of Geography and Statistics",
  CVM: "Brazilian Securities and Exchange Commission",
  MCTI: "Ministry of Science, Technology and Innovation",
  MDS: "Ministry of Development and Social Assistance, Family and Fight Against Hunger",
  "Câmara dos Deputados": "Chamber of Deputies",
  "Senado Federal": "Federal Senate",
};

/** "a", "a and b", "a, b and c". */
export function listaEn(xs: readonly string[]): string {
  if (xs.length <= 1) return xs.join("");
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

/** Legenda inglesa dos órgãos de uma tabela: "ANEEL, Brazilian Electricity Regulatory Agency; ONS, ...". Órgão sem nome inglês sai só com o nome. */
export function legendaDeOrgaosEn(orgaos: readonly string[]): string {
  return orgaos.map((o) => (ORGAOS_EN[o] ? (/^[A-Z]{2,}$/.test(o) ? `${o}, ${ORGAOS_EN[o]}` : `${o} (${ORGAOS_EN[o]})`) : o)).join("; ");
}
