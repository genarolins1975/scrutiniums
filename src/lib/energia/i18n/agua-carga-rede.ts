import type { Idioma } from "@/lib/idioma";

/**
 * Tabelas de tradução dos rótulos que chegam da gold nos módulos Água e clima, Carga e Rede (valores
 * fixos de categoria, gravados em português pelo pipeline). A chave é o texto exato da gold; o valor,
 * a forma inglesa. Valor sem entrada sai como veio (o componente decide se marca como trecho em
 * português). Não altera a gold nem o pipeline.
 */

/** Rótulo de categoria no idioma: em português o valor da gold; em inglês a entrada da tabela, ou o valor da gold se faltar. */
export function rotuloDaGold(tabela: Readonly<Record<string, string>>, valor: string, idioma: Idioma): string {
  return idioma === "en" ? (tabela[valor] ?? valor) : valor;
}

/** O valor tem forma inglesa na tabela (para decidir se a célula leva a marca de trecho em português). */
export function temTraducao(tabela: Readonly<Record<string, string>>, valor: string): boolean {
  return Object.prototype.hasOwnProperty.call(tabela, valor);
}

/* ---------- Água e clima ---------- */

/** Abrangência de uma revisão da MLT (agua_detalhe.armazenamento.mlt.revisoes_no_mes[].abrangencia). */
export const ABRANGENCIA_EN: Readonly<Record<string, string>> = { ampla: "broad", pontual: "isolated" };

/** Captura usada em cada ano (reconciliacao_ear.captura_por_ano[].fonte, afluencia.captura_por_ano[].fonte). */
export const FONTE_CAPTURA_EN: Readonly<Record<string, string>> = {
  "silver principal": "main silver capture",
  "recaptura do módulo": "module recapture",
};

/** Precisão da fonte na reconciliação por reservatório (reservatorios_por_ano[].precisao). */
export const PRECISAO_EN: Readonly<Record<string, string>> = { inteiro: "whole numbers", "3 casas": "3 decimal places" };

/** Motivo da ausência de balanço por reservatório, contado na gold (reservatorios.sem_balanco_por_motivo, chaves). */
export const MOTIVO_SEM_BALANCO_EN: Readonly<Record<string, string>> = {
  "sem correspondência no cadastro": "no match in the ONS register",
  "sem volume útil no cadastro": "no useful volume in the register",
  "sem volume útil em percentual nos dados hidráulicos": "no useful volume in percent in the hydraulic data",
  "dia sem vazão ou volume na janela": "day without flow or volume in the window",
};

/** Critério do fechamento por construção (reservatorios.criterio_fecham_por_construcao). */
export const CRITERIO_FECHAMENTO_EN: Readonly<Record<string, string>> = {
  "ao menos 95% dos dias da série diária disponível com |resíduo| dentro do arredondamento":
    "at least 95% of the days of the available daily series with |residual| within rounding",
};
