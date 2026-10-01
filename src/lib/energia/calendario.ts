/**
 * Aritmética de datas de calendário do Setor Elétrico (lógica pura, testável
 * em node), usada pelo zoom de séries, pelo cronograma de expansão e pela
 * linha do tempo regulatória.
 *
 * As datas chegam como texto local ("AAAA-MM-DD", "AAAA-MM" ou
 * "AAAA-MM-DDTHH:MM", horário de Brasília), como em formato.ts. Toda a conta é
 * feita em UTC sobre o calendário civil, sem conversão de fuso: somar um dia a
 * "2026-10-31" dá "2026-11-01" em qualquer servidor, sem o salto de horário
 * de verão ou de fuso da máquina que roda o build.
 *
 * Precisão é informação: data só com mês ("2027-03", típica de cronograma
 * de obra) não vira dia 1 na diferença entre datas. Quando uma das pontas tem
 * só o mês, a diferença sai em meses; dizer "atraso de 45 dias" entre "março"
 * e "15 de abril" inventaria uma precisão que a fonte não deu.
 */

export type Precisao = "dia" | "mes";

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/;
const RE_MES = /^(\d{4})-(\d{2})$/;
const RE_HORA = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;
const DIA_MS = 86_400_000;

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const dois = (v: number) => String(v).padStart(2, "0");

/** Dia civil válido (rejeita 2026-02-30 e mês 13, que o Date aceitaria silenciosamente). */
function diaValido(a: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const t = new Date(Date.UTC(a, m - 1, d));
  return t.getUTCFullYear() === a && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Precisão da data ("dia" ou "mes"); null quando o texto não é data reconhecível. */
export function precisaoData(iso: string | null | undefined): Precisao | null {
  if (!iso) return null;
  const d = RE_DIA.exec(iso);
  if (d) return diaValido(Number(d[1]), Number(d[2]), Number(d[3])) ? "dia" : null;
  const m = RE_MES.exec(iso);
  if (m) return Number(m[2]) >= 1 && Number(m[2]) <= 12 ? "mes" : null;
  return null;
}

/**
 * Número de dias desde 1970-01-01 (serial) de uma data civil. Data só com mês
 * cai no dia 1 (posição no eixo, não diferença: ver diferencaDatas). Hora é
 * ignorada. Null quando a data não é válida.
 */
export function diaSerial(iso: string | null | undefined): number | null {
  const p = precisaoData(iso);
  if (!p || !iso) return null;
  const [a, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), p === "dia" ? Number(iso.slice(8, 10)) : 1];
  return Math.round(Date.UTC(a, m - 1, d) / DIA_MS);
}

/** Data "AAAA-MM-DD" de um serial de dias. */
export function isoDoDia(serial: number): string {
  const t = new Date(serial * DIA_MS);
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}`;
}

/** Índice de mês (ano × 12 + mês − 1); null quando a data não é válida. */
export function mesSerial(iso: string | null | undefined): number | null {
  if (!precisaoData(iso) || !iso) return null;
  return Number(iso.slice(0, 4)) * 12 + Number(iso.slice(5, 7)) - 1;
}

/** Soma dias a "AAAA-MM-DD" (negativo subtrai). */
export function somarDias(iso: string, n: number): string | null {
  if (precisaoData(iso) !== "dia") return null;
  const s = diaSerial(iso);
  return s === null ? null : isoDoDia(s + n);
}

/**
 * Soma meses mantendo a precisão da entrada: "AAAA-MM" continua mês;
 * "AAAA-MM-DD" preserva o dia, limitado ao fim do mês (31/03 − 1 mês = 28/02
 * ou 29/02), sem transbordar para o mês seguinte como o Date faria.
 */
export function somarMeses(iso: string, n: number): string | null {
  const p = precisaoData(iso);
  const ms = mesSerial(iso);
  if (!p || ms === null) return null;
  const alvo = ms + n;
  const a = Math.floor(alvo / 12);
  const m = alvo - a * 12 + 1;
  if (p === "mes") return `${a}-${dois(m)}`;
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${a}-${dois(m)}-${dois(Math.min(Number(iso.slice(8, 10)), ultimo))}`;
}

/** Soma horas a "AAAA-MM-DDTHH:MM" (horário local tratado como civil, sem fuso). */
export function somarHoras(iso: string, n: number): string | null {
  const h = RE_HORA.exec(iso);
  if (!h || !diaValido(Number(h[1]), Number(h[2]), Number(h[3]))) return null;
  const t = new Date(Date.UTC(Number(h[1]), Number(h[2]) - 1, Number(h[3]), Number(h[4]) + n, Number(h[5])));
  return `${t.getUTCFullYear()}-${dois(t.getUTCMonth() + 1)}-${dois(t.getUTCDate())}T${dois(t.getUTCHours())}:${dois(t.getUTCMinutes())}`;
}

export type Diferenca = { valor: number; unidade: "dias" | "meses" };

/**
 * Diferença "ate − de": positiva quando `ate` é posterior. Em dias quando as
 * duas datas têm dia; em meses quando qualquer uma tem só o mês (a precisão
 * da resposta é a da ponta menos precisa). Null quando falta uma das datas.
 */
export function diferencaDatas(de: string | null | undefined, ate: string | null | undefined): Diferenca | null {
  const pa = precisaoData(de);
  const pb = precisaoData(ate);
  if (!pa || !pb) return null;
  if (pa === "dia" && pb === "dia") return { valor: (diaSerial(ate) as number) - (diaSerial(de) as number), unidade: "dias" };
  return { valor: (mesSerial(ate) as number) - (mesSerial(de) as number), unidade: "meses" };
}

/** Duração em português com singular e plural ("1 dia", "120 dias", "1 mês", "3 meses"); sem sinal. */
export function textoDuracao(d: Diferenca): string {
  const v = Math.abs(d.valor);
  const n = v.toLocaleString("pt-BR");
  if (d.unidade === "dias") return `${n} ${v === 1 ? "dia" : "dias"}`;
  return `${n} ${v === 1 ? "mês" : "meses"}`;
}

/** Diferença com sinal tipográfico ("+120 dias", "−3 meses", "0 dias"). */
export function textoDiferencaComSinal(d: Diferenca): string {
  const s = d.valor > 0 ? "+" : d.valor < 0 ? "\u2212" : "";
  return `${s}${textoDuracao(d)}`;
}

export type TickTempo = { serial: number; iso: string; rotulo: string };

/**
 * Marcas de eixo de tempo no primeiro dia de meses alinhados a um passo de
 * 1, 3, 6, 12, 24, 60 ou 120 meses: o menor passo que cabe em `maximo`
 * marcas. Com passo anual ou maior o rótulo é o ano ("2027"); abaixo disso,
 * mês abreviado ("abr/27"). Trimestres caem em jan, abr, jul e out.
 */
export function ticksTempo(minSerial: number, maxSerial: number, maximo = 6): TickTempo[] {
  if (!Number.isFinite(minSerial) || !Number.isFinite(maxSerial)) return [];
  const [lo, hi] = minSerial <= maxSerial ? [minSerial, maxSerial] : [maxSerial, minSerial];
  const mLo = mesSerial(isoDoDia(lo)) as number;
  const mHi = mesSerial(isoDoDia(hi)) as number;
  const passos = [1, 3, 6, 12, 24, 60, 120];
  const gerar = (passo: number): TickTempo[] => {
    const out: TickTempo[] = [];
    let m = Math.ceil(mLo / passo) * passo;
    for (; m <= mHi + 1 && out.length <= maximo + 1; m += passo) {
      const a = Math.floor(m / 12);
      const mes = m - a * 12;
      const iso = `${a}-${dois(mes + 1)}-01`;
      const s = diaSerial(iso) as number;
      if (s < lo || s > hi) continue;
      out.push({ serial: s, iso, rotulo: passo >= 12 ? String(a) : `${MESES[mes]}/${String(a).slice(2)}` });
    }
    return out;
  };
  for (const p of passos) {
    const t = gerar(p);
    if (t.length <= maximo) return t;
  }
  return gerar(passos[passos.length - 1]);
}
