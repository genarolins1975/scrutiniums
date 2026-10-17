/**
 * Tabelas de tradução da página inicial e da Visão geral do Setor Elétrico: textos que chegam da gold
 * (public/energia/gold/*.json) só em português e que a página inglesa mostra. Cada entrada é o texto
 * português exato da gold e o equivalente inglês, com os mesmos números, unidades e datas; o que não
 * está na tabela não é traduzido aqui, e quem exibe decide entre a forma inglesa montada em código e o
 * trecho marcado como só em português (<TrechoPortugues>). A gold e o pipeline não mudam.
 *
 * Só dado: nada aqui lê o idioma da página. Quem chama escolhe a forma.
 */
import { nomeSubmercado } from "../formato";

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
};

/** A forma inglesa de um texto da gold, quando a tabela a tem; null quando não tem (quem chama decide o que mostrar). */
export function traduzDaGold(texto: string | null | undefined): string | null {
  if (!texto) return null;
  return GOLD_EN[texto.trim()] ?? null;
}

/**
 * Frases da gold montadas com números, que a tabela exata não alcança: o modelo português é reconhecido por expressão
 * regular e a frase inglesa é escrita com os mesmos números. Null quando o texto não segue nenhum modelo conhecido.
 */
const MODELOS_EN: readonly [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(\d[\d.]*) concessionárias com os 12 meses de (\d{4}) e sem alerta$/, (m) => `${m[1].replaceAll(".", ",")} concession holders with all 12 months of ${m[2]} and no alert`],
];

export function traduzModeloDaGold(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const direto = traduzDaGold(texto);
  if (direto) return direto;
  for (const [re, f] of MODELOS_EN) {
    const m = re.exec(texto.trim());
    if (m) return f(m);
  }
  return null;
}

/** Submercado pelo nome português da gold ("Sudeste/Centro-Oeste"), para trocar pelo nome inglês. */
const SUBMERCADO_POR_NOME: Readonly<Record<string, string>> = { "Sudeste/Centro-Oeste": "SE", Sul: "S", Nordeste: "NE", Norte: "N" };

/** Nome de submercado ou de fronteira da gold ("Norte → Nordeste") em inglês; parte que não se reconhece volta como veio. */
export function fronteiraEn(nome: string): string {
  return nome
    .split(" → ")
    .map((p) => (SUBMERCADO_POR_NOME[p] ? nomeSubmercado(SUBMERCADO_POR_NOME[p], "en") : p))
    .join(" → ");
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
