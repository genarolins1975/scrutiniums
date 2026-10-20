/** Formatação em português do painel Conectividade: ausência vira "Sem dado", nunca zero. */

export const SEM_DADO = "Sem dado";

const ok = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

export function num(v: number | null | undefined, casas = 0): string {
  if (!ok(v)) return SEM_DADO;
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

export const pct = (v: number | null | undefined, casas = 1) => (ok(v) ? `${num(v, casas)}%` : SEM_DADO);

export const milhoes = (v: number | null | undefined, casas = 1) => (ok(v) ? `${num(v / 1e6, casas)} milhões` : SEM_DADO);

/** Contagem com a palavra no número certo. */
export const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** "2026-08" vira "agosto de 2026". */
export function mesExtenso(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return SEM_DADO;
  return `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
}

/**
 * Mês dos acessos fixos e das linhas móveis: um só quando coincidem, os dois quando a atualização por grupo reteve
 * uma base e publicou a outra. Com `longo`, a frase começa por "Acessos ...".
 */
export function mesAcessos(r: { fixa: string; movel: string }, longo = false): string {
  if (r.fixa === r.movel) return longo ? `Acessos e linhas de ${mesExtenso(r.fixa)}` : `acessos e linhas de ${mesExtenso(r.fixa)}`;
  return longo ? `Acessos fixos de ${mesExtenso(r.fixa)} e linhas móveis de ${mesExtenso(r.movel)}` : `acessos fixos de ${mesExtenso(r.fixa)} · linhas móveis de ${mesExtenso(r.movel)}`;
}

type Carimbos = { fixa: { capturado_em: string }; movel: { capturado_em: string }; cobertura: { capturado_em: string } };
const NOME_FONTE = { fixa: "banda larga fixa", movel: "telefonia móvel", cobertura: "cobertura" } as const;

/**
 * Data de captura das fontes citadas numa frase: uma data só quando as capturas caem no mesmo dia; uma por fonte
 * quando a atualização por grupo publicou uma base e reteve outra (capturado_em da gold é o máximo das três e
 * esconderia a retenção).
 */
export function dataCaptura(fontes: Carimbos, quais: ("fixa" | "movel" | "cobertura")[]): string {
  const datas = quais.map((q) => dataBr(fontes[q].capturado_em));
  if (new Set(datas).size === 1) return datas[0];
  const partes = quais.map((q, i) => `${datas[i]} (${NOME_FONTE[q]})`);
  return partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0];
}

/** "2026-08" vira "ago/2026". */
export function mesCurto(m: string | null | undefined): string {
  if (!m || !/^\d{4}-\d{2}$/.test(m)) return SEM_DADO;
  return `${MESES[Number(m.slice(5, 7)) - 1].slice(0, 3)}/${m.slice(0, 4)}`;
}

/** "2026-10-20T17:29:00Z" vira "20/10/2026". */
export function dataBr(d: string | null | undefined): string {
  if (!d || !/^\d{4}-\d{2}-\d{2}/.test(d)) return SEM_DADO;
  return `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
}

/** Posição legível: "12ª de 645". */
export const posicao = (p: number | null | undefined, de: number | null | undefined) => (ok(p) && ok(de) ? `${num(p)}ª de ${num(de)}` : SEM_DADO);
