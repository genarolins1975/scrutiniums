/**
 * Contas dos modelos didáticos do Observatório do Saneamento. Funções puras, sem
 * estado: os componentes de tela só escolhem os parâmetros e desenham o resultado.
 *
 *  1. Da receita à tarifa média (blocos de custo), partindo dos valores publicados
 *     pela ARSESP no 1º reajuste da Sabesp. Só a aritmética do bloco é reproduzida;
 *     o que o modelo deixa de fora fica declarado na tela.
 *  2. Ritmo até a meta legal, na régua do Censo (mesma medida em 2010 e 2022), como
 *     projeção aritmética, não previsão.
 */

import { ESTUDOS, type Linha } from "@/lib/saneamento/dados/estudos";

/* ------------------------------------------------------------------ 1. receita e tarifa */

export type ParametrosReceita = {
  /** OPEX regulatório, outras despesas e receitas irrecuperáveis, R$ milhões por ano. */
  custos: number;
  /** Base de remuneração líquida mais outorga líquida, R$ milhões. */
  base: number;
  /** WACC real antes de impostos, em %. */
  wacc: number;
  /** Quota de reintegração regulatória (depreciação), R$ milhões por ano. */
  depreciacao: number;
  /** Remuneração da necessidade de capital de giro, R$ milhões por ano. */
  capitalGiro: number;
  /** Fator K, receitas complementares e adicionais deduzidas, R$ milhões por ano. */
  deducoes: number;
  /** Volume medido, milhões de m³ por ano. */
  volume: number;
};

export type ResultadoReceita = {
  remuneracao: number;
  receitaRequerida: number;
  receitaTarifaria: number;
  /** R$ por m³. */
  tarifaMedia: number;
};

export function receitaATarifa(p: ParametrosReceita): ResultadoReceita {
  const remuneracao = (p.base * p.wacc) / 100;
  const receitaRequerida = p.custos + remuneracao + p.depreciacao + p.capitalGiro;
  const receitaTarifaria = receitaRequerida - p.deducoes;
  return { remuneracao, receitaRequerida, receitaTarifaria, tarifaMedia: p.volume > 0 ? receitaTarifaria / p.volume : 0 };
}

const SABESP = ESTUDOS.find((e) => e.id === "sabesp-2026")!;
function valor(linhas: Linha[], inicio: string): number {
  const l = linhas.find((x) => x.rotulo.startsWith(inicio));
  if (l?.valor == null) throw new Error(`Linha ausente no estudo da Sabesp: ${inicio}`);
  return l.valor;
}

/**
 * Base de remuneração líquida (85.856,72) mais outorga líquida (2.803,68), R$ milhões,
 * NT Equilíbrio da ARSESP, PDF p.56. O estudo guarda as duas só na nota da linha de
 * remuneração do capital; o teste confere que base × WACC reproduz essa linha.
 */
export const BASE_SABESP = 85856.72 + 2803.68;

/** Parâmetros publicados no 1º reajuste da Sabesp (preços de outubro de 2025, ano de referência 2024). */
export const PARAMETROS_SABESP: ParametrosReceita = {
  custos:
    valor(SABESP.receita.linhas, "Custos operacionais") + valor(SABESP.receita.linhas, "Outras despesas") + valor(SABESP.receita.linhas, "Receitas irrecuperáveis"),
  base: BASE_SABESP,
  wacc: valor(SABESP.wacc, "WACC real antes de impostos"),
  depreciacao: valor(SABESP.receita.linhas, "Quota de reintegração"),
  capitalGiro: valor(SABESP.receita.linhas, "Remuneração da necessidade de capital de giro"),
  deducoes: -valor(SABESP.ponte!.linhas, "(−) Fator K"),
  volume: valor(SABESP.ponte!.linhas, "÷ volume medido"),
};

/** Valores publicados que o modelo deve reproduzir sem nenhum ajuste. */
export const PUBLICADO_SABESP = {
  receitaRequerida: SABESP.receita.total.valor!,
  tarifaMediaBase: valor(SABESP.ponte!.linhas, "Tarifa média base"),
  componentesFinanceiros: valor(SABESP.ponte!.linhas, "Componentes financeiros"),
  tarifaEquilibrio: valor(SABESP.ponte!.linhas, "Tarifa de equilíbrio"),
};

/** Parâmetros com as variações escolhidas (em % sobre o publicado; WACC em valor absoluto). */
export function variarSabesp(v: { custosPct: number; basePct: number; wacc: number; volumePct: number }): ParametrosReceita {
  const p = PARAMETROS_SABESP;
  return {
    ...p,
    custos: p.custos * (1 + v.custosPct / 100),
    base: p.base * (1 + v.basePct / 100),
    wacc: v.wacc,
    volume: p.volume * (1 + v.volumePct / 100),
  };
}

/* ------------------------------------------------------------------ 2. ritmo até a meta */

/** Datas de referência dos Censos (noite de 31 de julho para 1º de agosto) e prazo legal, em anos decimais. */
export const ANO_CENSO_2010 = 2010 + 7 / 12;
export const ANO_CENSO_2022 = 2022 + 7 / 12;
/** 31/12/2033, fim do prazo do art. 11-B da Lei 11.445/2007. */
export const ANO_PRAZO = 2034;

export type Trajetoria = {
  v2010: number;
  v2022: number;
  meta: number;
};

export type ResultadoRitmo = {
  /** p.p. por ano entre os Censos (pode ser negativo). */
  observado: number;
  /** p.p. por ano de agosto de 2022 ao fim de 2033 para chegar à meta; 0 se já está nela. */
  exigido: number;
  /** Quantas vezes o exigido é o observado; null quando o observado não é positivo ou nada falta. */
  razao: number | null;
  /** Valor em 31/12/2033 no ritmo escolhido, limitado a 100%. */
  em2033: number;
  /** Ano decimal em que a meta seria alcançada no ritmo escolhido; null se não alcança (ritmo ≤ 0). */
  anoMeta: number | null;
};

export function ritmoAteMeta(t: Trajetoria, ritmo: number): ResultadoRitmo {
  const observado = (t.v2022 - t.v2010) / (ANO_CENSO_2022 - ANO_CENSO_2010);
  const falta = Math.max(0, t.meta - t.v2022);
  const exigido = falta / (ANO_PRAZO - ANO_CENSO_2022);
  const razao = observado > 0 && exigido > 0 ? exigido / observado : null;
  const em2033 = Math.min(100, t.v2022 + ritmo * (ANO_PRAZO - ANO_CENSO_2022));
  const anoMeta = falta === 0 ? ANO_CENSO_2022 : ritmo > 0 ? ANO_CENSO_2022 + falta / ritmo : null;
  return { observado, exigido, razao, em2033, anoMeta };
}

/**
 * Ano civil de um instante em ano decimal: 2030,3 cai em 2030; 2034,0 é o fim de 2033. A virada de ano tolera o erro
 * de ponto flutuante (menos de um minuto), para o ritmo exigido exato cair em 2033 e não em 2034 por 1e-12.
 */
export function anoCivil(anoDecimal: number): number {
  const virada = Math.round(anoDecimal);
  return Math.abs(anoDecimal - virada) < 1e-6 ? virada - 1 : Math.floor(anoDecimal);
}
