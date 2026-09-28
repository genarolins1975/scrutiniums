/**
 * Formatação do domínio Energia. Ausência (null/undefined) vira "–" e nunca 0.
 * Datas de referência chegam como texto local ("AAAA-MM-DD" ou
 * "AAAA-MM-DDTHH:MM", horário de Brasília) e são formatadas sem conversão de
 * fuso; carimbos de captura chegam em UTC ("...Z") e são exibidos em Brasília.
 */
const L = "pt-BR";
export const AUSENTE = "–";

export function num(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return v.toLocaleString(L, { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export function reais(v: number | null | undefined, casas = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `R$ ${num(v, casas)}`;
}

export function pct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return `${num(v, casas)}%`;
}

/** Fração 0..1 como percentual. */
export function fracPct(v: number | null | undefined, casas = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  return pct(v * 100, casas);
}

export function sinal(v: number | null | undefined, casas = 1, sufixo = ""): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return AUSENTE;
  const s = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${s}${num(Math.abs(v), casas)}${sufixo}`;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

export function dataExtenso(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} de ${MESES_LONGOS[Number(m) - 1]} de ${a}`;
}

export function dataCurta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}`;
}

export function mesAno(anomes: string): string {
  return `${MESES[Number(anomes.slice(5, 7)) - 1]}/${anomes.slice(0, 4)}`;
}

/** "AAAA-MM-DDTHH:MM" local → "27/09/2026 às 16h". */
export function horaLocal(ref: string): string {
  return `${dataBR(ref)} às ${ref.slice(11, 13)}h`;
}

/** Carimbo UTC ("...Z") exibido no horário de Brasília. */
export function carimbo(iso: string | null | undefined): string {
  if (!iso) return AUSENTE;
  const d = new Date(iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(L, {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) + " (Brasília)";
}

export function plural(n: number, um: string, varios: string): string {
  return `${n.toLocaleString(L)} ${n === 1 ? um : varios}`;
}

export const NOME_SM: Record<string, string> = {
  SE: "Sudeste/Centro-Oeste",
  S: "Sul",
  NE: "Nordeste",
  N: "Norte",
  SIN: "Sistema Interligado Nacional",
};

export const CURTO_SM: Record<string, string> = { SE: "SE/CO", S: "Sul", NE: "Nordeste", N: "Norte", SIN: "SIN" };
