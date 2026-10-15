/**
 * Formatação numérica do OBEE, com português como padrão.
 * Os rótulos e as unidades existentes são preservados.
 */
import { formatadorNumero } from "../format";
import type { Idioma } from "../idioma";

const nf = (idioma: Idioma, min: number, max: number) =>
  formatadorNumero(idioma, { minimumFractionDigits: min, maximumFractionDigits: max });

const criarFormatos = (idioma: Idioma) => Object.freeze({
  INT: nf(idioma, 0, 0),
  D1: nf(idioma, 1, 1),
  D2: nf(idioma, 2, 2),
  CURTO: nf(idioma, 0, 1),
});
const formatos = Object.freeze({ pt: criarFormatos("pt"), en: criarFormatos("en") });

export function inteiro(v: number, idioma: Idioma = "pt"): string {
  return formatos[idioma].INT.format(v);
}

export function decimal(v: number, casas = 1, idioma: Idioma = "pt"): string {
  const { INT, D1, D2 } = formatos[idioma];
  return casas === 2 ? D2.format(v) : casas === 0 ? INT.format(v) : D1.format(v);
}

/** Reais com escala por extenso: R$ 566,4 milhões; R$ 1,03 bilhão (singular abaixo de 2); R$ 23,58 bilhões. */
export function reaisExtenso(v: number, idioma: Idioma = "pt"): string {
  const { D1, D2 } = formatos[idioma];
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${D2.format(v / 1e9)} ${a < 2e9 ? "bilhão" : "bilhões"}`;
  if (a >= 1e6) return `R$ ${D1.format(v / 1e6)} ${a < 2e6 ? "milhão" : "milhões"}`;
  if (a >= 1e3) return `R$ ${D1.format(v / 1e3)} mil`;
  return `R$ ${D2.format(v)}`;
}

/** Reais curtos para eixo e rótulo de gráfico: R$ 1,2 bi; R$ 566 mi. */
export function reaisCurto(v: number, idioma: Idioma = "pt"): string {
  const { INT, CURTO } = formatos[idioma];
  const a = Math.abs(v);
  if (a >= 1e9) return `R$ ${CURTO.format(v / 1e9)} bi`;
  if (a >= 1e6) return `R$ ${INT.format(v / 1e6)} mi`;
  if (a >= 1e3) return `R$ ${INT.format(v / 1e3)} mil`;
  return `R$ ${INT.format(v)}`;
}

export function reaisCompleto(v: number, idioma: Idioma = "pt"): string {
  return `R$ ${formatos[idioma].D2.format(v)}`;
}

/** Reais inteiros, para valores por habitante e por matrícula: R$ 1.160; R$ 23.747. */
export function reaisInteiro(v: number, idioma: Idioma = "pt"): string {
  return `R$ ${formatos[idioma].INT.format(v)}`;
}

/** Diferença assinada com sinal tipográfico: +R$ 203; −R$ 1.050. */
export function sinal(v: number, texto: string): string {
  return `${v >= 0 ? "+" : "−"}${texto}`;
}

export function percentual(v: number, casas = 1, idioma: Idioma = "pt"): string {
  return `${decimal(v, casas, idioma)}%`;
}

/** Contagem com rótulo no singular ou plural. */
export function contagem(v: number, singular: string, plural: string, idioma: Idioma = "pt"): string {
  return `${formatos[idioma].INT.format(v)} ${v === 1 ? singular : plural}`;
}

/** Data ISO (com ou sem hora) para dd/mm/aaaa. */
export function dataBr(iso: string | null | undefined): string {
  if (!iso) return "não informada";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d ? `${d}/${m}/${a}` : iso;
}

/** Identificador do catálogo ("AAAA-MM-DD.N") em texto para o leitor: "08/10/2026, revisão 2". O identificador original fica na gold. */
export function rotuloVersaoCatalogo(id: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:\.(\d+))?$/.exec(id);
  if (!m) return id;
  return `${m[3]}/${m[2]}/${m[1]}${m[4] ? `, revisão ${m[4]}` : ""}`;
}
