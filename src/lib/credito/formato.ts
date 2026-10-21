/** Formatos das consultas de juros do Crédito, no padrão brasileiro. Código puro (servidor e navegador). */

export function num(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Taxa em % com a unidade por extenso curta: "22,48% ao ano". */
export function taxa(v: number, unidade: "aa" | "am", casas = 2): string {
  return `${num(v, casas)}% ${unidade === "aa" ? "ao ano" : "ao mês"}`;
}

/** Valor em reais com centavos: "R$ 1.234,56". */
export function reais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Data ISO (aaaa-mm-dd) como dd/mm/aaaa, sem passar por fuso horário. */
export function dataBr(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** Instante ISO como data no fuso de Brasília: "19/10/2026". */
export function diaBrasilia(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Janela de referência: "28/09/2026 a 02/10/2026". */
export function janela(j: { inicio: string; fim: string }): string {
  return `${dataBr(j.inicio)} a ${dataBr(j.fim)}`;
}

/** Dias entre o fim da janela e a data de processamento da publicação. */
export function diasDesde(fimIso: string, geradoEmIso: string): number | null {
  const a = Date.parse(`${fimIso.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${geradoEmIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** Número inteiro por extenso curto, para contagens: "1 instituição", "3 instituições". */
export function contagem(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("pt-BR")} ${n === 1 ? singular : plural}`;
}
