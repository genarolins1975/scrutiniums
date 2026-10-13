/**
 * Frescor da publicação do crédito: quantos dias se passaram desde o `gerado_em`
 * do meta.json publicado. Fonte única do limite e da promessa de atualização,
 * usada pelo selo das páginas públicas. O limite é o mesmo da vigília
 * (scripts/vigilancia.py, LIMITE_DIAS): a partir de 2 dias o leitor vê o aviso
 * de atraso e o repositório recebe a issue.
 *
 * O cálculo roda no navegador do leitor. As páginas são force-static: um cálculo
 * feito no build congelaria "em dia" para sempre, que foi exatamente o que
 * aconteceu de 24/09 a 13/10/2026, quando a publicação ficou retida e as páginas
 * seguiram dizendo "atualizado diariamente".
 */

export const LIMITE_ATRASO_DIAS = 2;

/** O que o sistema garante, em uma frase. Usada no selo e nas páginas que prometem atualização. */
export const PROMESSA_ATUALIZACAO =
  "Coleta diária. Cada publicação só vai ao ar depois de aprovada nos testes de conteúdo; " +
  `com mais de ${LIMITE_ATRASO_DIAS} dias sem publicação, esta página avisa o atraso.`;

const DIA_MS = 86_400_000;

export type SituacaoFrescor = {
  /** Dias inteiros desde a publicação (piso), nunca negativo. */
  dias: number;
  atrasado: boolean;
  /** Data e hora da publicação no horário de Brasília: "24/09/2026 às 12h25". */
  publicadoEm: string;
  /** "hoje", "ontem" ou "há N dias". */
  idade: string;
};

function instante(iso: string): Date | null {
  const temFuso = /(Z|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(temFuso ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function publicadoEmBrasilia(iso: string): string {
  const d = instante(iso);
  if (!d) return iso;
  const p = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${v("day")}/${v("month")}/${v("year")} às ${v("hour")}h${v("minute")}`;
}

export function situacaoFrescor(geradoEm: string, agora: Date, limiteDias = LIMITE_ATRASO_DIAS): SituacaoFrescor | null {
  const d = instante(geradoEm);
  if (!d) return null;
  const dias = Math.max(0, Math.floor((agora.getTime() - d.getTime()) / DIA_MS));
  const idade = dias === 0 ? "hoje" : dias === 1 ? "ontem" : `há ${dias} dias`;
  return { dias, atrasado: dias >= limiteDias, publicadoEm: publicadoEmBrasilia(geradoEm), idade };
}
