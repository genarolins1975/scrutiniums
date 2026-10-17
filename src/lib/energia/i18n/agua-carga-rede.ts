import { dataBR } from "@/lib/energia/formato";
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

/** Forma inglesa das mensagens de cópia de MENSAGEM_COPIA (evidencia.ts), usada pelos links de painel destes módulos. */
export const MENSAGEM_COPIA_EN: Readonly<Record<"copiado" | "selecionado" | "falhou", string>> = {
  copiado: "Copied to the clipboard.",
  selecionado: "Text selected: use Ctrl+C (or Copy, in the menu) to copy.",
  falhou: "Could not copy: select the text in the block and copy it.",
};

/* ---------- Carga ---------- */

/** Rótulo das janelas de comparação da carga (carga_detalhe.p025.comparacoes.janelas[].rotulo). */
export const JANELA_CARGA_EN: Readonly<Record<string, string>> = {
  "últimos 7 dias": "last 7 days",
  "últimos 28 dias (4 semanas)": "last 28 days (4 weeks)",
  "mês corrente até o último dia": "current month up to the latest day",
  "último mês completo": "last complete month",
  "últimas 52 semanas": "last 52 weeks",
};

/**
 * O que cada regime do ONS acrescentou à carga, como a página o extrai da descrição publicada (carga_detalhe.regimes[].descricao,
 * primeira frase sem "Inclui").
 */
export const ACRESCIMO_REGIME_EN: Readonly<Record<string, string>> = {
  "a previsão de geração de usinas não despachadas pelo ONS": "the generation forecast of plants not dispatched by ONS",
  "a estimativa da micro e minigeração distribuída (MMGD), com base em dados meteorológicos previstos":
    "the estimate of distributed micro and mini generation (MMGD), based on forecast weather data",
};

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

/** Variantes do modelo de clima e calendário (carga_detalhe.p027.sensibilidade[].rotulo). */
export const VARIANTE_MODELO_EN: Readonly<Record<string, string>> = {
  "Principal: temperatura média com dobras e defasagem, calendário completo": "Main: average temperature with breakpoints and lag, full calendar",
  "Só feriados por lei (sem Carnaval, Cinzas, Corpus Christi, pontes e fim de ano)":
    "Statutory holidays only (without Carnival, Ash Wednesday, Corpus Christi, bridge days and year-end)",
  "Sem temperatura (só calendário, sazonalidade e tendência)": "No temperature (calendar, seasonality and trend only)",
  "Temperatura média só linear (sem dobras nem defasagem)": "Average temperature, linear only (no breakpoints or lag)",
  "Temperatura máxima em vez da média": "Maximum temperature instead of the average",
};

/**
 * Rótulo da variante no idioma. A variante de janela longa traz as datas da gold no texto ("Treino desde dd/mm/aaaa com
 * degrau no regime de dd/mm/aaaa"): as datas são lidas do próprio rótulo, nunca do código.
 */
export function rotuloVarianteModelo(rotulo: string, idioma: Idioma): string {
  if (idioma !== "en") return rotulo;
  const m = /^Treino desde (\d{2})\/(\d{2})\/(\d{4}) com degrau no regime de (\d{2})\/(\d{2})\/(\d{4})$/.exec(rotulo);
  if (m) return `Training since ${dataBR(`${m[3]}-${m[2]}-${m[1]}`, "en")} with a regime step on ${dataBR(`${m[6]}-${m[5]}-${m[4]}`, "en")}`;
  return VARIANTE_MODELO_EN[rotulo] ?? rotulo;
}

/** Base do intervalo de previsão por origem (carga_detalhe.p027.por_origem_sin[].fonte_intervalo). */
export const FONTE_INTERVALO_EN: Readonly<Record<string, string>> = {
  "erros fora da amostra de origens anteriores": "out-of-sample errors from earlier origins",
  "resíduos do treino": "training residuals",
};
