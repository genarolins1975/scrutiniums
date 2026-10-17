/**
 * Datas, competências e instantes ISO embutidos em texto vindo de pipeline, tornados legíveis
 * para o leitor (Energia e Eficiência). Política em docs/obee/APRESENTACAO_DATAS_ENERGIA.md.
 *
 * Regras:
 *  - uma ocorrência é a expressão completa, contada uma vez; precedência instante > data >
 *    competência (nunca formata o prefixo de uma expressão e deixa o resto);
 *  - o calendário e o relógio são validados antes de formatar: "2021-02-29", mês 13 ou hora 25
 *    não viram outra data. Ficam como estão (a página decide se é literal da fonte);
 *  - competência mensal não ganha dia, data civil não ganha horário, e o horário mantém a
 *    precisão que veio (segundos incluídos);
 *  - instante com Z fica em UTC, com deslocamento mantém o deslocamento, sem fuso só recebe
 *    um fuso quando o chamador informa uma convenção documentada (`fusoSemOffset`); sem isso
 *    o texto diz que o fuso não foi informado;
 *  - identificadores, URLs e nomes de arquivo ficam intactos: a ocorrência não pode estar
 *    colada a letras, dígitos, "_", "@", "/", ".", "%", "#", "=", "&", "?", "~", "+" nem "-".
 *
 * Idioma: `idioma` nas opções escolhe a forma ("June 2026", "Jun 3, 2026, 14:05 UTC" em inglês); sem ele vale o idioma da página
 * (idiomaEnergia(), português fora do /en). O português não muda. Texto da fonte que fica em português dentro de uma página inglesa
 * (TrechoPortugues) passa idioma "pt", para a data seguir a língua da frase.
 */
import type { Idioma } from "@/lib/idioma";
import { idiomaEnergia } from "@/lib/energia/idioma";

export type TipoData = "competencia" | "data" | "instante";
export type FusoData = "utc" | "offset" | "ausente";

export type OcorrenciaData = {
  inicio: number;
  fim: number;
  bruto: string;
  tipo: TipoData;
  valida: boolean;
  /** Motivo da invalidez (calendário ou relógio), ou null quando a ocorrência é válida. */
  motivo: string | null;
  ano: number;
  mes: number;
  dia: number | null;
  hora: number | null;
  minuto: number | null;
  segundo: number | null;
  fuso: FusoData | null;
  /** Deslocamento como veio ("+03:00", "-0300"), quando há. */
  offset: string | null;
};

export type OpcoesData = {
  /** Competência mensal: "junho de 2026" (padrão) ou "jun/2026" em espaços curtos. */
  competencia?: "longa" | "curta";
  /** Convenção documentada para horário sem fuso (ex.: "Brasília"). Sem ela, o texto declara o fuso como não informado. */
  fusoSemOffset?: string;
  /** Idioma da forma legível; sem ele, o da página. */
  idioma?: Idioma;
};

export type Segmento =
  | string
  | { tipo: "data"; iso: string; texto: string; ocorrencia: OcorrenciaData }
  | { tipo: "invalida"; bruto: string; motivo: string; ocorrencia: OcorrenciaData };

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]; // i18n: dado (ramo português; o inglês é MONTHS_LONG)
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// AAAA-MM[-DD[(T| )HH:MM[:SS[.fff]][Z|±HH[:]MM]]]; os limites impedem casar dentro de identificador, URL ou arquivo
const PADRAO =
  "(?<![\\w@./:%#=&?~+-])(\\d{4})-(\\d{2})(?:-(\\d{2})(?:[T ](\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.\\d+)?)?(Z|[+-]\\d{2}:?\\d{2})?)?)?(?![\\w@/%#=&?~+-]|:\\d|\\.\\w)";

const dois = (n: number) => String(n).padStart(2, "0");

function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** Todas as ocorrências ISO do texto, sem sobreposição, em ordem, válidas ou não. */
export function encontraDatas(texto: string): OcorrenciaData[] {
  const out: OcorrenciaData[] = [];
  const re = new RegExp(PADRAO, "g");
  for (let m = re.exec(texto); m !== null; m = re.exec(texto)) {
    const [bruto, a, me, d, hh, mm, ss, z] = m;
    const ano = Number(a);
    const mes = Number(me);
    const dia = d === undefined ? null : Number(d);
    const hora = hh === undefined ? null : Number(hh);
    const minuto = mm === undefined ? null : Number(mm);
    const segundo = ss === undefined ? null : Number(ss);
    const tipo: TipoData = hora !== null ? "instante" : dia !== null ? "data" : "competencia";
    let motivo: string | null = null;
    // motivo técnico da invalidez, lido pela verificação do HTML; não chega à tela
    if (mes < 1 || mes > 12) motivo = `mês ${me} fora de 01 a 12`; // i18n: dado
    else if (dia !== null && (dia < 1 || dia > diasNoMes(ano, mes))) motivo = `dia ${d} inexistente em ${me}/${a}`; // i18n: dado
    else if (hora !== null && (hora > 23 || (minuto ?? 0) > 59 || (segundo ?? 0) > 59)) motivo = "horário inválido"; // i18n: dado
    let fuso: FusoData | null = null;
    let offset: string | null = null;
    if (hora !== null) {
      if (z === "Z") fuso = "utc";
      else if (z) {
        fuso = "offset";
        offset = z;
        const oh = Number(z.slice(1, 3));
        const om = Number(z.replace(":", "").slice(3, 5));
        if (oh > 23 || om > 59) motivo = motivo ?? "deslocamento de fuso inválido"; // i18n: dado
      } else fuso = "ausente";
    }
    out.push({ inicio: m.index, fim: m.index + bruto.length, bruto, tipo, valida: motivo === null, motivo, ano, mes, dia, hora, minuto, segundo, fuso, offset });
  }
  return out;
}

/** Texto legível de uma ocorrência válida. */
export function formataOcorrencia(o: OcorrenciaData, op: OpcoesData = {}): string {
  if ((op.idioma ?? idiomaEnergia()) === "en") return formataOcorrenciaEn(o, op);
  if (o.tipo === "competencia") return op.competencia === "curta" ? `${MESES_CURTOS[o.mes - 1]}/${o.ano}` : `${MESES_LONGOS[o.mes - 1]} de ${o.ano}`; // i18n: dado (ramo português; o inglês está em formataOcorrenciaEn)
  const dia = `${dois(o.dia as number)}/${dois(o.mes)}/${o.ano}`;
  if (o.tipo === "data") return dia;
  const hora = `${dois(o.hora as number)}h${dois(o.minuto as number)}${o.segundo === null ? "" : `min${dois(o.segundo)}s`}`;
  if (o.fuso === "utc") return `${dia} às ${hora} UTC`; // i18n: dado (ramo português)
  if (o.fuso === "offset") {
    const off = (o.offset as string).replace(/^([+-])(\d{2}):?(\d{2})$/, (_, s, h, m) => `UTC${s === "-" ? "−" : "+"}${h}:${m}`);
    return `${dia} às ${hora} (${off})`; // i18n: dado (ramo português)
  }
  return `${dia} às ${hora} (${op.fusoSemOffset ?? "fuso não informado"})`; // i18n: dado (ramo português)
}

/** Forma inglesa: "June 2026" ("Jun 2026" curta), "Jun 3, 2026", "Jun 3, 2026, 14:05 UTC"; o valor e a precisão são os mesmos. */
function formataOcorrenciaEn(o: OcorrenciaData, op: OpcoesData): string {
  if (o.tipo === "competencia") return `${(op.competencia === "curta" ? MONTHS : MONTHS_LONG)[o.mes - 1]} ${o.ano}`;
  const dia = `${MONTHS[o.mes - 1]} ${o.dia as number}, ${o.ano}`;
  if (o.tipo === "data") return dia;
  const hora = `${dois(o.hora as number)}:${dois(o.minuto as number)}${o.segundo === null ? "" : `:${dois(o.segundo)}`}`;
  if (o.fuso === "utc") return `${dia}, ${hora} UTC`;
  if (o.fuso === "offset") {
    const off = (o.offset as string).replace(/^([+-])(\d{2}):?(\d{2})$/, (_, s, h, m) => `UTC${s === "-" ? "−" : "+"}${h}:${m}`);
    return `${dia}, ${hora} (${off})`;
  }
  const fuso = op.fusoSemOffset === undefined ? "time zone not reported" : op.fusoSemOffset === "Brasília" ? "Brasília time" : op.fusoSemOffset; // i18n: dado (convenção do domínio, nome próprio)
  return `${dia}, ${hora} (${fuso})`;
}

/** Texto dividido em trechos simples, datas formatadas e ocorrências inválidas preservadas. */
export function segmentosComDatas(texto: string, op: OpcoesData = {}): Segmento[] {
  const out: Segmento[] = [];
  let ultimo = 0;
  for (const o of encontraDatas(texto)) {
    if (o.inicio > ultimo) out.push(texto.slice(ultimo, o.inicio));
    if (o.valida) {
      let t = formataOcorrencia(o, op);
      if (o.inicio === 0) t = t.charAt(0).toUpperCase() + t.slice(1);
      out.push({ tipo: "data", iso: o.bruto, texto: t, ocorrencia: o });
    } else out.push({ tipo: "invalida", bruto: o.bruto, motivo: o.motivo as string, ocorrencia: o });
    ultimo = o.fim;
  }
  if (ultimo < texto.length) out.push(texto.slice(ultimo));
  return out;
}

/** Mesma conversão, como texto simples; ocorrências inválidas ficam como vieram. */
export function textoComDatas(texto: string, op: OpcoesData = {}): string {
  return segmentosComDatas(texto, op)
    .map((x) => (typeof x === "string" ? x : x.tipo === "data" ? x.texto : x.bruto))
    .join("");
}
