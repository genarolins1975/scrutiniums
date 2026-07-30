/**
 * Formatação numérica padronizada da plataforma.
 * Um mesmo conceito tem sempre a mesma formatação em todas as páginas.
 */
const locale = "pt-BR";

export function fmtNumber(value: number, decimals = 0): string {
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtCurrency(value: number, currency = "BRL", decimals = 0): string {
  return value.toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function fmtPercent(value: number, decimals = 1): string {
  return `${value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function fmtMonthYear(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleDateString(locale, { month: "short", year: "numeric" });
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
