/**
 * Pacote para citar uma página (recurso da conta, Onda 2): referência ABNT
 * (NBR 6023), a fonte dos dados com a data de referência de cada domínio, o
 * identificador da publicação quando o manifesto do domínio o declara e o DOI
 * do depósito mensal só quando ele existe. Também os arquivos .bib (BibTeX) e
 * .ris. Código puro, igual no servidor e no navegador; a data de acesso é a do
 * clique, no relógio de quem cita.
 */
import type { Idioma } from "@/lib/idioma";
import { dataPublicacao, rotuloReferencia, textosDominio, type DominioFrescorId } from "@/lib/frescor";

export type FonteCitacao = {
  id: DominioFrescorId;
  /** Referência mais recente dos números do domínio ("AAAA", "AAAA-MM" ou "AAAA-MM-DD"); nula quando não informada. */
  referencia: string | null;
  /** Data da publicação na plataforma (a mais antiga entre as partes do domínio). */
  publicadoEm: string | null;
  /** Identificador da publicação no manifesto do domínio (sha256 da lista de arquivos), quando existe. */
  idPublicacao: string | null;
};

export type DadosCitacaoPagina = {
  titulo: string;
  observatorio: string;
  url: string;
  acesso: Date;
  fontes: FonteCitacao[];
  /** DOI do depósito mensal no Zenodo; nulo enquanto não houver DOI publicado. */
  doi: string | null;
};

const MESES_ABNT = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES_EN = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "June", "July", "Aug.", "Sept.", "Oct.", "Nov.", "Dec."];
const p2 = (n: number) => String(n).padStart(2, "0");

/** Data de acesso no formato da ABNT: "19 out. 2026" (na página em inglês, "19 Oct. 2026"). */
export function dataAbnt(d: Date, idioma: Idioma = "pt"): string {
  return `${d.getDate()} ${(idioma === "en" ? MESES_EN : MESES_ABNT)[d.getMonth()]} ${d.getFullYear()}`;
}

const umaLinha = (s: string) => s.replace(/\s+/g, " ").trim();

/** Título da página sem o sufixo do modelo de título ("Preço · Setor Elétrico · Scrutiniums" vira "Preço"). */
export function tituloDaPagina(tituloDocumento: string): string {
  const partes = umaLinha(tituloDocumento).split(" · ");
  while (partes.length > 1 && /^Scrutiniums$/i.test(partes[partes.length - 1])) partes.pop();
  return partes[0] || "Scrutiniums";
}

/**
 * Referência ABNT de documento online, parte de um todo, com autor entidade:
 * SCRUTINIUMS. Título. In: SCRUTINIUMS. Observatório. [S. l.], [ano]. Disponível em: URL. Acesso em: dia mês. ano.
 * O local não é declarado ([S. l.]) e o ano vai entre colchetes por ser o provável (o do acesso): a página é atualizada
 * continuamente e não tem data de edição única.
 */
export function referenciaAbnt(d: Pick<DadosCitacaoPagina, "titulo" | "observatorio" | "url" | "acesso">, idioma: Idioma = "pt"): string {
  const [disponivel, acesso] = idioma === "en" ? ["Available at", "Accessed"] : ["Disponível em", "Acesso em"];
  return (
    `SCRUTINIUMS. ${umaLinha(d.titulo)}. In: SCRUTINIUMS. ${umaLinha(d.observatorio)}. [S. l.], [${d.acesso.getFullYear()}]. ` +
    `${disponivel}: ${d.url}. ${acesso}: ${dataAbnt(d.acesso, idioma)}.`
  );
}

/** Linha da fonte de um domínio: nome, fontes, referência mais recente e publicação. */
export function linhaFonte(f: FonteCitacao, idioma: Idioma = "pt"): string {
  const t = textosDominio(f.id, idioma);
  const ref = rotuloReferencia(f.referencia, idioma);
  const pub = dataPublicacao(f.publicadoEm, idioma);
  if (idioma === "en") {
    return (
      `${t.nome}. ${t.rotulo}. Latest reference (${t.referencia}): ${ref ?? "not reported"}. ` +
      `Published on the platform on ${pub ?? "date not reported"}.`
    );
  }
  return (
    `${t.nome}. ${t.rotulo}. Referência mais recente (${t.referencia}): ${ref ?? "não informada"}. ` +
    `Publicado na plataforma em ${pub ?? "data não informada"}.`
  );
}

/** Linha do DOI: o identificador quando existe; sem ele, a frase que diz que ainda não há DOI. */
export function linhaDoi(doi: string | null, idioma: Idioma = "pt"): string {
  if (doi) return idioma === "en" ? `DOI of the monthly deposit of the series: https://doi.org/${doi}` : `DOI do depósito mensal das séries: https://doi.org/${doi}`;
  return idioma === "en"
    ? "The monthly deposit on Zenodo does not have a published DOI yet."
    : "O depósito mensal no Zenodo ainda não tem DOI publicado.";
}

/** O pacote em texto, como vai para a área de transferência. */
export function pacoteTexto(d: DadosCitacaoPagina, idioma: Idioma = "pt"): string {
  const en = idioma === "en";
  const ids = d.fontes.filter((f) => f.idPublicacao);
  return [
    en ? "Reference (ABNT NBR 6023)" : "Referência (ABNT NBR 6023)",
    referenciaAbnt(d, idioma),
    "",
    en ? "Data source" : "Fonte dos dados",
    ...d.fontes.map((f) => linhaFonte(f, idioma)),
    ...(ids.length
      ? ["", en ? "Publication identifier" : "Identificador da publicação", ...ids.map((f) => `${textosDominio(f.id, idioma).nome}: sha256 ${f.idPublicacao}`)]
      : []),
    "",
    "DOI",
    linhaDoi(d.doi, idioma),
  ].join("\n");
}

/** Trecho do título para nome de arquivo e chave BibTeX: sem acento, minúsculo, só letras, números e sublinhado. */
export function slugCitacao(titulo: string): string {
  const s = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40)
    .replace(/_+$/g, "");
  return s || "pagina";
}

const iso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

/** Escapa os caracteres especiais do LaTeX num campo BibTeX (o campo url fica literal, como o biblatex o lê). */
export function escaparBibtex(s: string): string {
  return umaLinha(s).replace(/[\\{}&%$#_~^]/g, (c) =>
    c === "\\" ? "\\textbackslash{}" : c === "~" ? "\\textasciitilde{}" : c === "^" ? "\\textasciicircum{}" : `\\${c}`,
  );
}

function nota(d: DadosCitacaoPagina): string {
  const fontes = d.fontes.map((f) => linhaFonte(f, "pt")).join(" ");
  const ids = d.fontes.filter((f) => f.idPublicacao).map((f) => `Identificador da publicação (${textosDominio(f.id).nome}): sha256 ${f.idPublicacao}.`);
  return [fontes, ...ids].join(" ");
}

export function bibtex(d: DadosCitacaoPagina): string {
  const chave = `scrutiniums_${iso(d.acesso).replace(/-/g, "")}_${slugCitacao(d.titulo)}`;
  const campos: [string, string][] = [
    ["author", "{Scrutiniums}"],
    ["title", escaparBibtex(d.titulo)],
    ["howpublished", escaparBibtex(d.observatorio)],
    ["publisher", "Scrutiniums"],
    ["year", String(d.acesso.getFullYear())],
    ["url", d.url.replace(/[{}]/g, encodeURIComponent)],
    ["urldate", iso(d.acesso)],
    ["note", escaparBibtex(`${nota(d)} Acesso em ${dataAbnt(d.acesso)}.`)],
  ];
  if (d.doi) campos.push(["doi", d.doi]);
  return `@misc{${chave},\n${campos.map(([k, v]) => `  ${k} = {${v}}`).join(",\n")}\n}\n`;
}

export function ris(d: DadosCitacaoPagina): string {
  const linhas: [string, string][] = [
    ["TY", "ELEC"],
    ["AU", "Scrutiniums"],
    ["TI", umaLinha(d.titulo)],
    ["T2", umaLinha(d.observatorio)],
    ["PB", "Scrutiniums"],
    ["PY", String(d.acesso.getFullYear())],
    ["UR", d.url],
    ["Y2", iso(d.acesso).replace(/-/g, "/")],
    ["N1", umaLinha(nota(d))],
  ];
  if (d.doi) linhas.push(["DO", d.doi]);
  linhas.push(["ER", ""]);
  return linhas.map(([k, v]) => `${k}  - ${v}`).join("\r\n") + "\r\n";
}
