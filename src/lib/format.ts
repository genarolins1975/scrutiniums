import type { Idioma } from "./idioma";

/**
 * Formatação numérica padronizada da plataforma.
 * Um mesmo conceito tem sempre a mesma formatação em todas as páginas.
 */
const locales = { pt: "pt-BR", en: "en-US" } as const;

/** Opções explícitas preservam formatos variáveis; BRL inglês sempre usa R$. */
export function formatadorNumero(idioma: Idioma, opcoes: Intl.NumberFormatOptions): Intl.NumberFormat {
  const brlEmIngles = idioma === "en" && opcoes.style === "currency" && opcoes.currency?.toUpperCase() === "BRL";
  return new Intl.NumberFormat(locales[idioma], brlEmIngles ? { ...opcoes, currencyDisplay: "narrowSymbol" } : opcoes);
}

/** O consumidor declara precisão e fuso; formatToParts preserva composições existentes. */
export function formatadorDataHora(idioma: Idioma, opcoes: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locales[idioma], opcoes);
}

/** Preserva o despacho nativo em fronteiras que já chamam toLocaleString sem opções. */
export function formatarLocalNativo(valor: { toLocaleString(locales?: string): string }, idioma: Idioma = "pt"): string {
  return valor.toLocaleString(locales[idioma]);
}

export function fmtNumber(value: number, decimals = 0, idioma: Idioma = "pt"): string {
  return value.toLocaleString(locales[idioma], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCurrency(value: number, currency = "BRL", decimals = 0, idioma: Idioma = "pt"): string {
  return formatadorNumero(idioma, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/** O valor já está em pontos percentuais: 1 representa 1%, não 100%. */
export function fmtPercent(value: number, decimals = 1, idioma: Idioma = "pt"): string {
  return `${value.toLocaleString(locales[idioma], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Data no fuso do ambiente, preservando o contrato das chamadas portuguesas. */
export function fmtDate(iso: string | Date, idioma: Idioma = "pt"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locales[idioma], {
    day: idioma === "en" ? "numeric" : "2-digit",
    month: idioma === "en" ? "short" : "2-digit",
    year: "numeric",
  });
}

/** Instante apresentado no fuso de Brasília em ambos os idiomas. */
export function fmtDateTime(iso: string | Date, idioma: Idioma = "pt"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleString(locales[idioma], {
    timeZone: "America/Sao_Paulo",
    day: idioma === "en" ? "numeric" : "2-digit",
    month: idioma === "en" ? "short" : "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtMonthYear(iso: string | Date, idioma: Idioma = "pt"): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locales[idioma], { month: "short", year: "numeric" });
}

/** Paleta das séries de gráficos. Bronze é destaque, não série padrão. */
export const CHART_SERIES = [
  "var(--serie-1)",
  "var(--serie-2)",
  "var(--serie-4)",
  "var(--serie-5)",
  "var(--serie-6)",
] as const;

export const CHART_HIGHLIGHT = "var(--serie-3)";
