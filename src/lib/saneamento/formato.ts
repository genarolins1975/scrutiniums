/** Formatação em padrão brasileiro. Ausência vira "sem dado", nunca zero. */
export const SEM_DADO = "sem dado";

export function numero(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return SEM_DADO;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function inteiro(v: number | null | undefined): string {
  return numero(v == null ? v : Math.round(v), 0);
}

export function pct(v: number | null | undefined, casas = 1): string {
  return v == null || !Number.isFinite(v) ? SEM_DADO : `${numero(v, casas)}%`;
}

export function sinal(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return SEM_DADO;
  const t = numero(Math.abs(v), casas);
  return v > 0 ? `+${t}` : v < 0 ? `−${t}` : t;
}

/** Reais com escala por extenso (mil, mi, bi) para leitura; o valor exato vai à tabela e ao CSV. */
export function reaisCompacto(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return SEM_DADO;
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${numero(v / 1e9, 2)} bi`;
  if (a >= 1e6) return `R$ ${numero(v / 1e6, 1)} mi`;
  if (a >= 1e3) return `R$ ${numero(v / 1e3, 1)} mil`;
  return `R$ ${numero(v, 2)}`;
}

export function reais(v: number | null | undefined, casas = 2): string {
  return v == null || !Number.isFinite(v) ? SEM_DADO : `R$ ${numero(v, casas)}`;
}

/** "dd/mm/aaaa" ou "aaaa-mm-dd" → "dd/mm/aaaa"; texto livre passa como veio. */
export function data(v: string | null | undefined): string {
  if (!v) return SEM_DADO;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : v;
}
