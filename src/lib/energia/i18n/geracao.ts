import { createElement, type ReactNode } from "react";
import { TrechoPortugues } from "@/components/i18n/TrechoPortugues";
import type { Idioma } from "@/lib/idioma";

/**
 * Inglês da Geração (matriz, térmica, restrições, capacidade e curtailment): o `tx` preso a um idioma explícito, para as
 * funções de lib chamadas tanto pelo servidor quanto pelo cliente, e as tabelas exatas dos rótulos que vêm da gold
 * (public/energia/gold/geracao_detalhe.json). A chave é o texto português exatamente como a gold publica; valor sem
 * entrada não é inventado: em texto corrido sai marcado como português (TrechoPortugues) e, onde só cabe texto, a função
 * que chama usa o nome curto inglês da categoria pelo identificador.
 */

/** `tx` preso a um idioma explícito: `const tx = txEm(idioma)` e depois `tx("pt", "en")`. */
export function txEm(idioma: Idioma): <T>(pt: T, en: T) => T {
  return <T,>(pt: T, en: T): T => (idioma === "en" ? en : pt);
}

/** Rótulos de categoria publicados na gold da Geração (tipo de usina, combustível, natureza, motivo, razão), em inglês. */
export const ROTULOS_GOLD_GERACAO_EN: Record<string, string> = {
  // categorias da matriz (categorias[].rotulo, por_categoria[].rotulo, cvu.por_combustivel[].rotulo)
  "Hidráulica": "Hydropower",
  "Eólica": "Wind",
  "Solar centralizada": "Centralized solar",
  "Solar MMGD (estimativa do ONS)": "Solar MMGD (ONS estimate)",
  "Nuclear": "Nuclear",
  "Gás natural": "Natural gas",
  "Carvão mineral": "Coal",
  "Óleo combustível e diesel": "Fuel oil and diesel",
  "Biomassa": "Biomass",
  "Outras térmicas (resíduos industriais do ONS, que incluem gases de siderurgia e licor negro de celulose, e multicombustível gás/diesel)":
    "Other thermal (ONS industrial waste, which includes steelmaking gases and pulp black liquor, and gas/diesel multi-fuel)",
  "Térmicas pequenas sem combustível identificado (grupos Tipo III)": "Small thermal plants without an identified fuel (Type III groups)",
  "Categoria não mapeada": "Unmapped category",
  // natureza do dado (naturezas[].rotulo)
  "Geração verificada (usinas e conjuntos com relacionamento com o ONS)": "Verified generation (plants and plant clusters with a relationship with the ONS)",
  "Previsão do ONS para grupos de pequenas usinas Tipo III": "ONS forecast for groups of small Type III plants",
  "Estimativa do ONS para a micro e minigeração distribuída (MMGD)": "ONS estimate for distributed micro and mini generation (MMGD)",
  // razões oficiais de restrição (razoes[].rotulo, por_razao[].rotulo)
  "Razão elétrica (indisponibilidade externa)": "Electrical reason (external unavailability)",
  "Confiabilidade (requisitos de confiabilidade)": "Reliability (reliability requirements)",
  "Razão energética": "Energy reason",
  "Restrição indicada no parecer de acesso": "Restriction stated in the grid access opinion",
  "Limitação sem razão informada": "Limitation with no reason given",
  // motivos de despacho térmico (termica.motivos[].rotulo, por_motivo[].rotulo)
  "Ordem de mérito (acima da inflexibilidade)": "Merit order (above inflexibility)",
  "Inflexibilidade (declarada pelo agente ou geração acima do despachado)": "Inflexibility (declared by the agent, or generation above the dispatched amount)",
  "Razão elétrica (necessidade do SIN)": "Electrical reason (SIN requirement)",
  "Garantia de suprimento energético (decisão do CMSE)": "Energy supply security (CMSE decision)",
  "Geração fora da ordem de mérito para compensar falta futura de combustível (GFOM)": "Out-of-merit-order generation to offset a future fuel shortage (GFOM)",
  "Reposição de perdas": "Loss replacement",
  "Exportação": "Export",
  "Recomposição da reserva de potência operativa": "Restoration of the operating capacity reserve",
  "Substituição de usina sem combustível": "Replacement of a plant left without fuel",
  "Unit commitment (rampa e tempos mínimos)": "Unit commitment (ramping and minimum times)",
  // combustível e modalidade como o ONS rotula (matriz.rotulos, termica.usinas_12m[].combustivel)
  "Carvão": "Coal",
  "Fotovoltaica": "Photovoltaic",
  "Gás": "Gas",
  "Multi-Combustível Diesel/Óleo": "Multi-fuel diesel/oil",
  "Outras Multi-Combustível": "Other multi-fuel",
  "Resíduos Industriais": "Industrial waste",
  "Óleo Combustível": "Fuel oil",
  "Óleo Diesel": "Diesel oil",
  "Conjunto de Usinas": "Plant cluster",
  "Pequenas Usinas (MMGD)": "Small plants (MMGD)",
  "Pequenas Usinas (Tipo III)": "Small plants (Type III)",
  "TIPO I": "Type I",
  "TIPO II-A": "Type II-A",
  "TIPO II-B": "Type II-B",
  "TIPO II-C": "Type II-C",
  "TIPO III": "Type III",
  // tipo da usina como o ONS rotula (matriz.rotulos[].tipo)
  "HIDROELÉTRICA": "Hydroelectric",
  "EOLIELÉTRICA": "Wind",
  "TÉRMICA": "Thermal",
  "FOTOVOLTAICA": "Photovoltaic",
  "NUCLEAR": "Nuclear",
  // SIGA: fontes contadas em "outros" (capacidade.contexto.siga.fontes_em_outros)
  "Fóssil": "Fossil",
  "Outros Fósseis": "Other fossil",
  // fonte da ANEEL na decomposição de outras térmicas (matriz.outros_por_ceg.itens[].fonte_aneel)
  "Fóssil: carvão mineral (inclui gases de siderurgia)": "Fossil: coal (includes steelmaking gases)",
  "Biomassa: floresta (inclui licor negro de celulose)": "Biomass: forest (includes pulp black liquor)",
  "Conjunto de usinas sem CEG próprio": "Plant cluster without its own CEG",
  // motivo de variação suprimida (matriz.comparacao_12m.variacao_suprimida.*.motivo)
  "salto no número de usinas com dado na fonte dentro das janelas comparadas": "jump in the number of plants with data in the source within the compared windows",
};

/** Arquivos para download publicados na gold (downloads[].rotulo), com a correção de 366 para 365 dias já aplicada. */
export const DOWNLOADS_GERACAO_EN: Record<string, string> = {
  "Matriz diária por região e categoria (CSV)": "Daily mix by region and category (CSV)",
  "Matriz horária do SIN, últimos 365 dias (CSV)": "Hourly SIN mix, last 365 days (CSV)",
  "Matriz horária do SIN, últimos 366 dias (CSV)": "Hourly SIN mix, last 366 days (CSV)",
  "Rótulos da fonte e categorias (CSV)": "Source labels and categories (CSV)",
  "Conferência diária da solar com o Balanço (CSV)": "Daily check of solar against the Balance (CSV)",
  "Reconciliação mensal com o Balanço (CSV)": "Monthly reconciliation with the Balance (CSV)",
  "Térmica por motivo, mensal (CSV)": "Thermal by dispatch reason, monthly (CSV)",
  "Térmica por usina, combustível e motivo (CSV)": "Thermal by plant, fuel and dispatch reason (CSV)",
  "CVU semanal por usina (CSV)": "Weekly CVU by plant (CSV)",
  "Restrições por dia, razão e origem (CSV)": "Restrictions by day, reason and origin (CSV)",
  "Restrições por usina e mês (CSV)": "Restrictions by plant and month (CSV)",
  "Unidades geradoras e datas (CSV)": "Generating units and dates (CSV)",
  "Fator de capacidade por usina e mês (CSV)": "Capacity factor by plant and month (CSV)",
  "Capacidade e fator de capacidade por fonte (CSV)": "Capacity and capacity factor by source (CSV)",
};

/** Nomes dos controles publicados na gold (controles[].nome), depois de `emPortugues`. */
export const CONTROLES_GERACAO_EN: Record<string, string> = {
  "Dia de referência não futuro": "Reference day is not in the future",
  "Participações somam 100% em todas as janelas e regiões": "Shares add up to 100% in every window and region",
  "Rótulos da fonte sem categoria": "Source labels without a category",
  "Reconciliação diária com o Balanço (hidráulica)": "Daily reconciliation with the Balance (hydropower)",
  "Reconciliação diária com o Balanço (térmica)": "Daily reconciliation with the Balance (thermal)",
  "Reconciliação diária com o Balanço (eólica)": "Daily reconciliation with the Balance (wind)",
  "Reconciliação diária com o Balanço (solar)": "Daily reconciliation with the Balance (solar)",
  "Valores negativos na térmica por motivo (fonte)": "Negative values in thermal by dispatch reason (source)",
  "Térmicas sem combustível identificado": "Thermal plants without an identified fuel",
  "Código do CVU ligado a uma só usina da térmica por motivo": "CVU code linked to a single plant in thermal by dispatch reason",
  "GNRa do ONS igual à regra (eólica)": "ONS GNRa equal to the rule (wind)",
  "Razões dentro do domínio do dicionário (eólica)": "Reasons within the data dictionary domain (wind)",
  "Valores negativos (eólica)": "Negative values (wind)",
  "Corte simultâneo não excede a soma das referências da meia hora (eólica)": "Simultaneous cut does not exceed the sum of the half-hour references (wind)",
  "GNRa do ONS igual à regra (solar)": "ONS GNRa equal to the rule (solar)",
  "Razões dentro do domínio do dicionário (solar)": "Reasons within the data dictionary domain (solar)",
  "Valores negativos (solar)": "Negative values (solar)",
  "Corte simultâneo não excede a soma das referências da meia hora (solar)": "Simultaneous cut does not exceed the sum of the half-hour references (solar)",
  "Fator de capacidade mensal acima de 100% numa usina": "Monthly capacity factor above 100% at a plant",
  "Potência da categoria cobre o denominador do fator de capacidade": "Category capacity covers the capacity factor denominator",
  "Sequências longas de zero exato depois de produção positiva": "Long runs of exact zero after positive output",
  "Identificadores sem valor ou sem linhas no último mês completo": "Identifiers with no value or no rows in the latest complete month",
};

/** Resultado de controle publicado na gold (controles[].resultado). */
export const RESULTADOS_CONTROLE_EN: Record<string, string> = {
  aprovado: "passed",
  ressalva: "caveat", // i18n: dado (valor já em inglês)
  reprovado: "failed",
};

// i18n: dado
const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Nome do estudo do ONS ("PMO Outubro 2026") no idioma: só o mês muda; sigla e ano ficam. */
export function estudoNoIdioma(estudo: string, idioma: Idioma): string {
  if (idioma !== "en") return estudo;
  return estudo.replace(new RegExp(`\\b(${MESES_PT.join("|")})\\b`, "g"), (m) => MONTHS_EN[MESES_PT.indexOf(m)]);
}

/** Rótulo da gold em inglês pela tabela exata; null quando a tabela não tem a entrada. */
export function rotuloGoldEn(pt: string, tabela: Record<string, string> = ROTULOS_GOLD_GERACAO_EN): string | null {
  return tabela[pt] ?? null;
}

/**
 * Rótulo da gold no idioma, para texto que só aceita string: em inglês, a tradução exata ou, sem entrada, o `reserva`
 * (o nome curto inglês da mesma categoria, pelo identificador). Em português, o rótulo como a gold publica.
 */
export function rotuloGold(pt: string, idioma: Idioma, reserva?: string, tabela: Record<string, string> = ROTULOS_GOLD_GERACAO_EN): string {
  if (idioma !== "en") return pt;
  return tabela[pt] ?? reserva ?? pt;
}

/** Rótulo da gold no idioma, para JSX: sem tradução exata, sai marcado como trecho só em português. */
export function rotuloGoldNo(pt: string, idioma: Idioma, regiao: string, tabela: Record<string, string> = ROTULOS_GOLD_GERACAO_EN): ReactNode {
  if (idioma !== "en") return pt;
  const en = tabela[pt];
  return en ?? createElement(TrechoPortugues, { regiao, children: pt });
}

/** Prosa da gold sem versão inglesa (nota, regra, descrição publicada): em inglês, marcada como trecho só em português. */
export function trechoPt(texto: string, regiao: string, idioma: Idioma, como: "span" | "div" = "span"): ReactNode {
  if (idioma !== "en") return texto;
  return createElement(TrechoPortugues, { regiao, como, children: texto });
}
