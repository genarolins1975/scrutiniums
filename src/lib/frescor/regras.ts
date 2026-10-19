/**
 * Frescor por domínio: a regra que decide se a publicação de cada observatório
 * está em dia, atrasada ou retida em parte, a partir das datas que o próprio
 * domínio publica. Cadências, limiares e campos ficam em limiares.json, a fonte
 * única lida também pela vigília (scripts/vigilancia_frescor.py), que abre uma
 * issue por domínio fora do limiar. Os casos de src/lib/frescor/casos.json são
 * conferidos pelos testes das duas linguagens, para que a regra seja a mesma.
 *
 * Regra:
 * - cada domínio tem uma cadência (diária, quinzenal, mensal, anual) com um
 *   intervalo esperado entre publicações e um limiar, em dias inteiros;
 * - a data da publicação é a MAIS ANTIGA entre as que o domínio declara (limite
 *   conservador, como o carimbo do Crédito); sem nenhuma data válida, a situação
 *   é "sem data" e a página diz "data não informada", nunca uma data inventada;
 * - em dia: a publicação tem menos dias que o limiar;
 * - retida em parte: a publicação passou do limiar, mas a parte mais recente
 *   (grupo ou gold do mesmo domínio) está dentro dele: o pipeline publica, e
 *   alguma parte ficou para trás (reprovada nos testes ou com build regredido);
 * - atrasada: nem a parte mais recente está dentro do limiar;
 * - o atraso conta os dias além do intervalo esperado (diária publicada há 19
 *   dias está atrasada há 18).
 *
 * O cálculo depende do relógio de quem lê: as páginas são estáticas e chamam
 * `situacaoDominio` no navegador, na hora da leitura, como o selo do Crédito.
 */
import limiares from "./limiares.json";
import type { Idioma } from "@/lib/idioma";

export type CadenciaId = keyof typeof limiares.cadencias;
export type DominioFrescorId = keyof typeof limiares.dominios;
export type EstadoFrescor = "em-dia" | "atrasado" | "retida" | "sem-data";

type Origem = { arquivo: string; campo: string };
type DefinicaoDominio = {
  nome: string;
  nomeEn?: string;
  rotulo: string;
  rotuloEn?: string;
  cadencia: string;
  nota: string;
  notaEn?: string;
  publicacao: Origem[];
  partes?: Origem[];
  referencia: Origem[];
  referenciaRotulo: string;
  referenciaRotuloEn?: string;
};
type DefinicaoCadencia = { intervalo: number; limite: number; rotulo: string; rotuloEn: string };

const DOMINIOS = limiares.dominios as Record<DominioFrescorId, DefinicaoDominio>;
const CADENCIAS = limiares.cadencias as Record<CadenciaId, DefinicaoCadencia>;

export const IDS_DOMINIOS = Object.keys(DOMINIOS) as DominioFrescorId[];

/** Datas de um domínio, como o build as leu dos arquivos publicados. Serializável. */
export type DadosFrescor = {
  id: DominioFrescorId;
  /** Data mais antiga entre as declaradas; nula quando nenhuma é válida. */
  publicadoEm: string | null;
  /** Data mais recente entre as partes (grupos ou golds); nula quando o domínio não declara partes. */
  parteMaisRecente: string | null;
  /** Referência mais recente dos números principais: "AAAA", "AAAA-MM" ou "AAAA-MM-DD". */
  referencia: string | null;
};

export type SituacaoDominio = {
  estado: EstadoFrescor;
  /** Dias inteiros desde a publicação mais antiga; nulo sem data. */
  dias: number | null;
  /** Dias além do intervalo esperado; 0 em dia, nulo sem data. */
  atrasoDias: number | null;
  intervalo: number;
  limite: number;
};

const DIA_MS = 86_400_000;

export function definicao(id: DominioFrescorId): DefinicaoDominio {
  return DOMINIOS[id];
}

export function cadenciaDe(id: DominioFrescorId): DefinicaoCadencia & { id: CadenciaId } {
  const c = DOMINIOS[id].cadencia as CadenciaId;
  return { ...CADENCIAS[c], id: c };
}

export function cadencias(): (DefinicaoCadencia & { id: CadenciaId })[] {
  return (Object.keys(CADENCIAS) as CadenciaId[]).map((id) => ({ ...CADENCIAS[id], id }));
}

/**
 * Valores no caminho de um objeto: "a.b.c", com "*" para todos os itens de um
 * objeto ou lista. Campo ausente devolve lista vazia; nulos são descartados.
 */
export function valoresNoCampo(obj: unknown, campo: string): unknown[] {
  let atuais: unknown[] = [obj];
  for (const parte of campo.split(".")) {
    const proximos: unknown[] = [];
    for (const v of atuais) {
      if (v === null || typeof v !== "object") continue;
      if (parte === "*") proximos.push(...(Array.isArray(v) ? v : Object.values(v as Record<string, unknown>)));
      else if (Object.prototype.hasOwnProperty.call(v, parte)) proximos.push((v as Record<string, unknown>)[parte]);
    }
    atuais = proximos;
  }
  return atuais.filter((v) => v !== null && v !== undefined);
}

/**
 * Instante de uma data publicada. Data sem hora ("2026-10-17") é a meia-noite de
 * Brasília; data com hora e sem fuso é UTC, como o pipeline grava. Qualquer outra
 * coisa (número, texto, data impossível) não é data: devolve nulo.
 */
export function instante(valor: unknown): Date | null {
  if (typeof valor !== "string") return null;
  const s = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T03:00:00Z`);
    return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(s)) return null;
  // frações com mais de três casas (Python grava microssegundos) ficam com três
  const normal = s.replace(/(\.\d{3})\d+/, "$1");
  const d = new Date(/(Z|[+-]\d{2}:?\d{2})$/.test(normal) ? normal : `${normal}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Referência normalizada: ano (número ou texto), "AAAA-MM" ou "AAAA-MM-DD"; o resto não é referência. */
export function referenciaNormal(valor: unknown): string | null {
  if (typeof valor === "number" && Number.isInteger(valor) && valor >= 1900 && valor <= 2999) return String(valor);
  if (typeof valor !== "string") return null;
  const m = valor.trim().match(/^(\d{4})(-(0[1-9]|1[0-2]))?(-(0[1-9]|[12]\d|3[01]))?(?!\d)/);
  if (!m) return null;
  if (m[4] && !m[2]) return null;
  return m[0];
}

/**
 * Extrai as datas de um domínio com um leitor de arquivos (no build, o disco;
 * nos testes, arquivos sintéticos). Arquivo ausente ou ilegível conta como
 * ausência de data, não como erro.
 */
export function extrairFrescor(id: DominioFrescorId, ler: (arquivo: string) => unknown): DadosFrescor {
  const d = DOMINIOS[id];
  const cache = new Map<string, unknown>();
  const conteudo = (arquivo: string) => {
    if (!cache.has(arquivo)) {
      let v: unknown = null;
      try {
        v = ler(arquivo);
      } catch {
        v = null;
      }
      cache.set(arquivo, v);
    }
    return cache.get(arquivo);
  };
  const datas = (origens: Origem[] | undefined) =>
    (origens ?? [])
      .flatMap((o) => valoresNoCampo(conteudo(o.arquivo), o.campo))
      .flatMap((v) => {
        const t = instante(v);
        return t ? [{ texto: v as string, t: t.getTime() }] : [];
      })
      .sort((a, b) => a.t - b.t);
  const pub = datas(d.publicacao);
  const partes = datas(d.partes);
  const refs = d.referencia
    .flatMap((o) => valoresNoCampo(conteudo(o.arquivo), o.campo))
    .map(referenciaNormal)
    .filter((r): r is string => r !== null)
    .sort();
  return {
    id,
    publicadoEm: pub.length ? pub[0].texto : null,
    parteMaisRecente: partes.length ? partes[partes.length - 1].texto : null,
    referencia: refs.length ? refs[refs.length - 1] : null,
  };
}

function diasDesde(iso: string | null, agora: Date): number | null {
  const t = instante(iso);
  if (!t) return null;
  return Math.max(0, Math.floor((agora.getTime() - t.getTime()) / DIA_MS));
}

/** A regra, aplicada na hora da leitura. */
export function situacaoDominio(d: DadosFrescor, agora: Date): SituacaoDominio {
  const { intervalo, limite } = cadenciaDe(d.id);
  const dias = diasDesde(d.publicadoEm, agora);
  if (dias === null) return { estado: "sem-data", dias: null, atrasoDias: null, intervalo, limite };
  if (dias < limite) return { estado: "em-dia", dias, atrasoDias: 0, intervalo, limite };
  const diasParte = diasDesde(d.parteMaisRecente, agora);
  if (diasParte !== null && diasParte < limite) {
    return { estado: "retida", dias, atrasoDias: Math.max(0, dias - intervalo), intervalo, limite };
  }
  const base = diasParte !== null ? Math.min(diasParte, dias) : dias;
  return { estado: "atrasado", dias, atrasoDias: Math.max(0, base - intervalo), intervalo, limite };
}

/* ---------- apresentação: datas e textos nos dois idiomas ---------- */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dataPartes(a: string, m: string, d: string, idioma: Idioma): string {
  return idioma === "en" ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${a}` : `${d}/${m}/${a}`;
}

/** Data de uma publicação no calendário de Brasília: "29/09/2026" ou "Sep 29, 2026". */
export function dataPublicacao(iso: string | null, idioma: Idioma = "pt"): string | null {
  const t = instante(iso);
  if (!t) return null;
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(t);
  const [a, m, d] = p.split("-");
  return dataPartes(a, m, d, idioma);
}

/** Referência legível: "30/09/2026", "set/2026" ou "2024" (em inglês, "Sep 30, 2026", "Sep 2026"). */
export function rotuloReferencia(ref: string | null, idioma: Idioma = "pt"): string | null {
  if (!ref) return null;
  const [a, m, d] = ref.split("-");
  if (d) return dataPartes(a, m, d, idioma);
  if (m) return idioma === "en" ? `${MONTHS[Number(m) - 1]} ${a}` : `${MESES[Number(m) - 1]}/${a}`;
  return a;
}

export function textosDominio(id: DominioFrescorId, idioma: Idioma = "pt") {
  const d = DOMINIOS[id];
  const c = cadenciaDe(id);
  const en = idioma === "en";
  return {
    nome: en ? d.nomeEn ?? d.nome : d.nome,
    rotulo: en ? d.rotuloEn ?? d.rotulo : d.rotulo,
    nota: en ? d.notaEn ?? d.nota : d.nota,
    referencia: en ? d.referenciaRotuloEn ?? d.referenciaRotulo : d.referenciaRotulo,
    cadencia: en ? c.rotuloEn : c.rotulo,
  };
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Situação em palavras, sem cor: "Em dia", "Atualização atrasada há 18 dias"... */
export function textoSituacao(s: SituacaoDominio, idioma: Idioma = "pt"): string {
  const en = idioma === "en";
  const n = s.atrasoDias ?? 0;
  switch (s.estado) {
    case "em-dia":
      return en ? "Up to date" : "Em dia";
    case "atrasado":
      return en ? `Update late by ${plural(n, "day", "days")}` : `Atualização atrasada há ${plural(n, "dia", "dias")}`;
    case "retida":
      return en ? `Publication partly held back for ${plural(n, "day", "days")}` : `Publicação retida em parte há ${plural(n, "dia", "dias")}`;
    case "sem-data":
      return en ? "Status not assessed" : "Situação não avaliada";
  }
}

/** A regra em uma frase para o leitor, com os limiares do arquivo de limiares. */
export function textoRegra(idioma: Idioma = "pt"): string {
  const cs = cadencias();
  if (idioma === "en") {
    return (
      `Each source has an expected update frequency. An update is late when the latest one is as many days old as the threshold for its frequency, or more: ${cs.map((c) => `${c.rotuloEn}, ${c.limite}`).join("; ")}. ` +
      "The delay counts the days beyond the expected interval. When part of a publication is up to date and another part has not been updated within the threshold, the publication is partly held back. " +
      "Dates follow the Brasília calendar. Without a published date, the status is not assessed. The calculation runs in your browser, at the time of reading."
    );
  }
  return (
    `Cada fonte tem uma cadência esperada. A atualização fica atrasada quando a última tem, em dias, o limiar da sua cadência ou mais: ${cs.map((c) => `${c.rotulo}, ${c.limite}`).join("; ")}. ` +
    "O atraso conta os dias além do intervalo esperado. Quando parte da publicação segue em dia e outra parte não é atualizada dentro do limiar, a publicação está retida em parte. " +
    "Datas no calendário de Brasília. Sem data publicada, a situação não é avaliada. O cálculo é feito no seu navegador, na hora da leitura."
  );
}
