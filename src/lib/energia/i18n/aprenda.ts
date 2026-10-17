/**
 * Apoio bilíngue do Aprenda (verbetes, trilhas, siglas, perguntas práticas, provas e exemplos).
 *
 * O acervo é feito de constantes de módulo, onde tx() não sabe o idioma (fora de render não há
 * página). Cada arquivo de conteúdo monta então o seu acervo duas vezes, uma por idioma, com uma
 * função que recebe o seu próprio `tx` já preso ao idioma: o português sai idêntico ao que era (a
 * constante antiga continua exportada com ele) e o inglês fica lado a lado no mesmo arquivo, com
 * os mesmos slugs, ids, endereços e fontes. Quem renderiza escolhe o acervo pelo idioma da página.
 *
 * Citação literal de norma ou documento (o "trecho") não é traduzida: fica em português e a tela a
 * mostra dentro de <TrechoPortugues>; a paráfrase em linguagem simples é que ganha a forma inglesa.
 */
import type { Idioma } from "@/lib/idioma";
import type { GrupoConceito } from "@/lib/energia/conteudo/conceitos";
import { TIPOS_LIGACAO, type TipoLigacao } from "@/lib/energia/mapa";
import type { Natureza } from "@/lib/energia/tipos";

/** `tx` preso a um idioma: devolve a primeira forma em português e a segunda em inglês. */
export type TxIdioma = <T>(pt: T, en: T) => T;

/** Monta um acervo nos dois idiomas com a mesma função; a forma portuguesa é exatamente a de antes. */
export function montarNosDoisIdiomas<T>(montar: (tx: TxIdioma, idioma: Idioma) => T): Record<Idioma, T> {
  const pt: TxIdioma = (p) => p;
  const en: TxIdioma = (_p, e) => e;
  return { pt: montar(pt, "pt"), en: montar(en, "en") };
}

/** Nome do tema do verbete. O tema português continua sendo a chave (âncora #g-..., filtro, teste). */
const GRUPO_EN: Record<GrupoConceito, string> = {
  Preço: "Price",
  Água: "Water",
  Operação: "Operation",
  Modelos: "Models",
  Mercado: "Market",
  Rede: "Grid",
  Consumidor: "Consumer",
  "Qualidade e perdas": "Quality and losses",
  Inclusão: "Inclusion",
  Empresas: "Companies",
  Expansão: "Expansion",
  Regulação: "Regulation",
  Transição: "Transition",
  "Fontes de dados": "Data sources",
};

export function rotuloGrupoConceito(g: GrupoConceito, idioma: Idioma): string {
  return idioma === "en" ? GRUPO_EN[g] : g;
}

/** Tipos de ligação do mapa do setor (rótulo e definição de TIPOS_LIGACAO, em mapa.ts), na forma inglesa usada pelas trilhas. */
const LIGACAO_EN: Record<TipoLigacao, { rotulo: string; definicao: string }> = {
  fisico: { rotulo: "Physical flow", definicao: "energy, water or fuel passes from one link to the other." }, // i18n: dado (tabela de tradução)
  operacao: { rotulo: "Operating decision", definicao: "the ONS uses the information to schedule and dispatch the system." }, // i18n: dado (tabela de tradução)
  mercado: { rotulo: "Market rule", definicao: "a trading rule turns a quantity into an amount to be settled." }, // i18n: dado (tabela de tradução)
  custo: { rotulo: "Cost component", definicao: "the cost of a link becomes a portion of a tariff or a bill, by regulatory rule." }, // i18n: dado (tabela de tradução)
  associacao: { rotulo: "Analytical association", definicao: "the quantities tend to vary together; the association does not prove cause." }, // i18n: dado (tabela de tradução)
};

export function textoLigacao(tipo: TipoLigacao, idioma: Idioma): { rotulo: string; definicao: string } {
  return idioma === "en" ? LIGACAO_EN[tipo] : { rotulo: TIPOS_LIGACAO[tipo].rotulo, definicao: TIPOS_LIGACAO[tipo].definicao };
}

/** Natureza do dado (rótulo e definição de NATUREZAS, em SeloNatureza.tsx), para a legenda do exemplo do Aprenda. */
export const NATUREZA_EN: Record<Natureza, { rotulo: string; definicao: string }> = {
  OBSERVADO: { rotulo: "Observed", definicao: "Value published directly by the official or primary source." }, // i18n: dado (tabela de tradução)
  CALCULADO: { rotulo: "Calculated", definicao: "Deterministic transformation made by Scrutiniums, with a published formula." }, // i18n: dado (tabela de tradução)
  ESTIMADO: { rotulo: "Estimated", definicao: "Value obtained by a statistical procedure, with uncertainty." }, // i18n: dado (tabela de tradução)
  PREVISTO: { rotulo: "Forecast", definicao: "Value for a future period, always with model, version and source data." }, // i18n: dado (tabela de tradução)
  CENARIO: { rotulo: "Scenario", definicao: "Simulation conditional on a declared hypothesis. It is not a forecast." }, // i18n: dado (tabela de tradução)
};

/**
 * Rótulos das fichas que o Aprenda mostra como exemplo (indicador, entidade e unidade, lidos da gold): tabela exata do português para o
 * inglês. Valor sem entrada sai em português, marcado (TrechoPortugues); nada é traduzido por aproximação.
 */
const FICHA_EN: Record<string, string> = {
  // indicador
  "Participação do ACL no consumo contabilizado pela CCEE, sem a exportação (12 meses)": "ACL share of the consumption accounted by the CCEE, without exports (12 months)",
  "Fator de ajuste do MRE (GSF)": "MRE adjustment factor (GSF)",
  "Energia não gerada estimada por restrição de operação (eólicas), últimos 12 meses completos": "Estimated energy not generated due to operating restriction (wind plants), last 12 complete months",
  "Encargos de serviços do sistema (ESS) em 12 meses": "System service charges (ESS) over 12 months",
  "Anomalia da temperatura do SIN em 30 dias": "SIN temperature anomaly over 30 days",
  "Pico horário da carga do SIN no dia": "Hourly peak of the SIN load in the day",
  "Parcela da carga global do SIN atendida por MMGD (estimativa do ONS), último mês completo": "Share of SIN global load served by MMGD (ONS estimate), last complete month",
  "Saldo do intercâmbio internacional em 12 meses (positivo = exportação)": "Net international interchange over 12 months (positive = export)",
  "Horas acima do limite sistêmico em 12 meses (ATLS)": "Hours above the system limit over 12 months (ATLS)",
  "Tarifa residencial B1 mediana entre distribuidoras": "Median B1 residential tariff among distribution utilities",
  "Bandeira tarifária acionada": "Tariff flag triggered",
  "Participação das quotas pagas nas tarifas no custeio da CDE": "Share of the quotas paid in the tariffs in funding the CDE",
  "Perdas totais de energia na distribuição": "Total energy losses in distribution", // i18n: dado (tabela de tradução)
  "Perdas não técnicas sobre o mercado de baixa tensão": "Non-technical losses over the low-voltage market",
  "DEC do Brasil (apurado, ponderado por unidades consumidoras; todas as distribuidoras, inclusive permissionárias)":
    "DEC of Brazil (determined, weighted by consumer units; all distribution utilities, including permit holders)",
  "FEC do Brasil (apurado, ponderado por unidades consumidoras; todas as distribuidoras, inclusive permissionárias)":
    "FEC of Brazil (determined, weighted by consumer units; all distribution utilities, including permit holders)",
  "Conjuntos com DEC anual acima do limite": "Groups with annual DEC above the limit",
  "Compensações pagas a unidades consumidoras por violação dos limites individuais de continuidade": "Compensations paid to consumer units for violation of the individual continuity limits",
  "Unidades consumidoras com Tarifa Social": "Consumer units with the Tarifa Social",
  "Fator médio anual de emissão de CO2 do SIN (inventários)": "Annual average CO2 emission factor of the SIN (inventories)",
  "Teto horário do PLD vigente": "Hourly PLD ceiling in force",
  "EAR do SIN": "SIN EAR",
  "Potência instalada de micro e minigeração distribuída no cadastro da ANEEL": "Installed capacity of distributed micro and mini generation in the ANEEL register",
  "Capacidade instalada nacional em 2035 no Cenário de Referência do PDE 2035 (CENÁRIO)": "National installed capacity in 2035 in the Reference Scenario of the PDE 2035 (SCENARIO)",
  "Peso da energia no orçamento (POF 2017-2018)": "Weight of energy in the budget (POF 2017-2018)",
  "População das localidades atendidas por sistemas isolados": "Population of the localities served by isolated systems",
  "ENA bruta de 30 dias do SIN": "30-day gross ENA of the SIN",
  "Geração térmica despachada pelo ONS, últimos 12 meses completos": "Thermal generation dispatched by the ONS, last 12 complete months",
  "Taxa de perdas totais na distribuição": "Total loss rate in distribution", // i18n: dado (tabela de tradução)
  // geração (geracao_detalhe.json, evidencias)
  "Geração do SIN nos últimos 30 dias (todas as categorias, com MMGD)": "SIN generation over the last 30 days (all categories, with MMGD)",
  "Participação de Eólica na geração do SIN, últimos 30 dias": "Wind share of SIN generation, last 30 days",
  "Participação de Solar MMGD (estimativa do ONS) na geração do SIN, últimos 30 dias": "Solar MMGD (ONS estimate) share of SIN generation, last 30 days",
  "Participação de Gás natural na geração do SIN, últimos 30 dias": "Natural gas share of SIN generation, last 30 days",
  "MMGD estimada pelo ONS no primeiro dia em que aparece na Geração por Usina": "MMGD estimated by the ONS on the first day it appears in the ONS generation by plant dataset",
  "Parcela da geração térmica por inflexibilidade (declarada pelo agente ou geração acima do despachado), últimos 12 meses completos":
    "Share of thermal generation due to inflexibility (declared by the agent, or generation above the dispatched amount), last 12 complete months",
  "Taxa de restrição (eólicas), últimos 12 meses completos": "Restriction rate (wind plants), last 12 complete months",
  "Energia não gerada estimada por restrição de operação (fotovoltaicas), últimos 12 meses completos": "Estimated energy not generated due to operating restriction (photovoltaic plants), last 12 complete months",
  "Taxa de restrição (fotovoltaicas), últimos 12 meses completos": "Restriction rate (photovoltaic plants), last 12 complete months",
  "Fator de capacidade de Eólica, últimos 12 meses completos": "Wind capacity factor, last 12 complete months",
  "Fator de capacidade de Solar centralizada, últimos 12 meses completos": "Centralized solar capacity factor, last 12 complete months",
  "Potência instalada das usinas despachadas pelo ONS em operação comercial": "Installed capacity of the plants dispatched by the ONS in commercial operation",
  "Usinas com todos os municípios declarados reconhecidos no cadastro do IBGE": "Plants with all declared municipalities recognized in the IBGE register",
  // entidade
  SIN: "SIN",
  Brasil: "Brazil",
  "Sistema Interligado Nacional": "National Interconnected System",
  "Sudeste/Centro-Oeste": "Southeast/Center-West",
  "Mecanismo de Realocação de Energia (SIN)": "Energy Reallocation Mechanism (SIN)",
  "SIN (27 UF, ponderadas pela população)": "SIN (27 states, weighted by population)",
  "Brasil (SIN) com Argentina e Uruguai": "Brazil (SIN) with Argentina and Uruguay",
  "Fluxo FNESE (Fluxo da Interligação Nordeste-Sudeste/Centro-Oeste)": "FNESE flow (Northeast-Southeast/Center-West interconnection flow)",
  "distribuidoras com tarifa B1 residencial convencional vigente": "distribution utilities with a conventional residential B1 tariff in force",
  "consumidores cativos do SIN": "captive consumers of the SIN",
  "Conta de Desenvolvimento Energético (CDE)": "Energy Development Account (CDE)",
  "Concessionárias de distribuição (Brasil)": "Distribution concession holders (Brazil)",
  "18 concessionárias com separação técnica e não técnica publicada (não é a perda não técnica de todas as 51 concessionárias válidas)":
    "18 concession holders with a published technical and non-technical split (not the non-technical loss of all 51 valid concession holders)",
  "Mercado de Curto Prazo (todos os submercados)": "Short-Term Market (all submarkets)",
  "matriz elétrica nacional (inclui MMGD, baterias e resposta da demanda)": "national electricity mix (includes MMGD, batteries and demand response)",
  "Brasil, famílias com rendimento total até R$ 1.908 (valores de 15/01/2018)": "Brazil, families with total income up to R$ 1,908 (values of Jan 15, 2018)", // i18n: dado (tabela de tradução)
  "Brasil, sistemas isolados": "Brazil, isolated systems",
  // unidade (a base que acompanha o número)
  "% da carga global": "% of global load",
  "% do mercado de baixa tensão medido": "% of the measured low-voltage market",
  "horas por unidade consumidora": "hours per consumer unit",
  "interrupções por unidade consumidora": "interruptions per consumer unit",
  "% dos conjuntos com 12 meses e limite de DEC": "% of the groups with 12 months and a DEC limit",
  "R$ nominais da competência": "nominal R$ of the accrual period",
  "unidades consumidoras": "consumer units",
  "% da EAR máxima": "% of the maximum EAR",
  "% da MLT": "% of the MLT",
  "% da energia injetada": "% of injected energy",
  pessoas: "people",
  horas: "hours",
  MWmed: "MWavg",
};

/**
 * Nome inglês da página de destino pelo primeiro trecho do endereço (/setor-eletrico/<trecho>), para o link "Ver no painel" do índice
 * do Aprenda quando o verbete não dá o nome do painel. Segue a tabela de terminologia de docs/i18n/ENERGIA.md.
 */
const MODULO_EN: Record<string, string> = {
  "": "Home",
  "visao-geral": "Overview",
  territorio: "My region",
  "agua-e-clima": "Water and climate",
  geracao: "Generation",
  carga: "Load",
  rede: "Grid",
  pld: "Short-term price (PLD)",
  mercado: "Market",
  leiloes: "Auctions",
  "conta-de-luz": "Electricity bill",
  perdas: "Energy losses",
  qualidade: "Quality of supply",
  "inclusao-energetica": "Energy inclusion",
  empresas: "Companies",
  expansao: "Expansion",
  transicao: "Transition and environment",
  regulacao: "Regulation",
  aprenda: "Learn",
  dados: "Data",
  metodologia: "Methodology",
};

export function rotuloModuloEn(segmento: string): string | null {
  return MODULO_EN[segmento] ?? null;
}

/** Rótulos de ficha com data ou nome dentro: a parte variável passa como está (data e nome de bacia). */
const FICHA_EN_PADROES: [RegExp, (...g: string[]) => string][] = [
  [/^PLD médio da semana operativa de (\S+) a (\S+)$/, (a, b) => `Average PLD of the operating week from ${a} to ${b}`],
  [/^CMO médio do DESSEM na semana operativa de (\S+) a (\S+)$/, (a, b) => `Average DESSEM CMO in the operating week from ${a} to ${b}`],
  [/^Chuva de 30 dias na bacia (.+)$/, (b) => `30-day rainfall in the ${b} basin`],
  [/^bacia (.+) \(maior EAR máxima\)$/, (b) => `${b} basin (largest maximum EAR)`],
];

/** Rótulo de ficha (indicador, entidade ou unidade) no idioma; null quando não há forma inglesa conferida. */
export function rotuloFicha(texto: string | null | undefined, idioma: Idioma): string | null {
  if (!texto) return null;
  if (idioma === "pt") return texto;
  if (texto in FICHA_EN) return FICHA_EN[texto];
  for (const [re, f] of FICHA_EN_PADROES) {
    const m = re.exec(texto);
    if (m) return f(...m.slice(1));
  }
  return null;
}

/**
 * Valor exibido da ficha (escrito pela gold em português: "R$ 1,60 bilhão", "98.741 MWmed às 19h", "Amarela: R$ 0,01885/kWh") na
 * grafia inglesa: separadores trocados dentro de cada número, palavras de grandeza e unidade traduzidas. O número é o mesmo.
 */
export function valorExibidoNoIdioma(v: string, idioma: Idioma): string {
  if (idioma === "pt") return v;
  return v
    .replace(/\d[\d.,]*\d|\d/g, (n) => n.replace(/[.,]/g, (c) => (c === "." ? "," : ".")))
    .replace(/\bbilhões\b|\bbilhão\b/g, "billion")
    .replace(/\bmilhões\b|\bmilhão\b/g, "million")
    .replace(/\bMWmed\b/g, "MWavg")
    .replace(/ às (\d{1,2})h\b/g, " at $1:00")
    .replace(/^(\S+) horas$/, "$1 hours")
    .replace(/^1 hora$/, "1 hour")
    .replace(/^([\d.,]+) de ([\d.,]+)$/, "$1 of $2")
    .replace(/^Verde:/, "Green:")
    .replace(/^Amarela:/, "Yellow:")
    .replace(/^Vermelha patamar (\d):/, "Red level $1:")
    .replace(/^Vermelha:/, "Red:")
    .replace(/(\d)\s?(%\s.+)$/, (todo, d: string, unidade: string) => (unidade in FICHA_EN ? `${d}${FICHA_EN[unidade]}` : todo));
}
