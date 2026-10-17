import { attr, elementos, filhos, oculto, texto, vazamentos, type Elemento, type No } from "./i18n-dom";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * Prova das páginas do Setor Elétrico em inglês, mais exigente que a genérica das páginas
 * institucionais: além do detector comum (vazamentos), procura palavras funcionais e sufixos do
 * português em todo texto visível fora de nome próprio marcado (<Nome>, lang="pt-BR" e
 * data-i18n-nome) e de trecho só em português com aviso (TrechoPortugues). Números são comparados
 * como multiconjunto, com o nome do mês convertido no número do mês nos dois idiomas, para que
 * "17/10/2026" e "Oct 17, 2026" contem igual.
 */

// texto de SVG (rótulos de eixo, <title> de marca) é visível e entra na prova
const tecnicos = new Set(["script", "style", "template", "noscript"]);
const ATRIBUTOS = ["aria-label", "aria-description", "title", "alt", "placeholder"];

/** Nomes próprios que aparecem em prosa inglesa com a grafia original (sem marca). */
const NOMES_LIVRES = ["Brasília", "São Paulo", "Paraná", "Maranhão", "Pará", "Amapá", "Goiás", "Piauí", "Ceará", "Rondônia", "Espírito Santo"];

const PT_FORTE = new RegExp("(?:^|[^\\p{L}])(?:de|da|das|dos|em|na|nas|nos|para|pelo|pela|pelos|pelas|com|que|uma|não|são|à|às|ao|aos|também|está|entre|quando|cada|até|desde|após|sem|mais|ou|é)(?=$|[^\\p{L}])|\\p{L}(?:ção|ções|ões)(?=$|[^\\p{L}])", "iu");
const PT_ATRIBUTO = new RegExp("(?:^|[^\\p{L}])(?:não|para|com|que|uma|também|está|abrir|baixar|ver|fechar|mostrar|página|painel)(?=$|[^\\p{L}])|\\p{L}(?:ção|ções)(?=$|[^\\p{L}])", "iu");
const ACENTO = /[ãõçáéíóúâêôàÃÕÇÁÉÍÓÚÂÊÔÀ]/;

function semNomesLivres(t: string): string {
  return NOMES_LIVRES.reduce((r, n) => r.split(n).join(" "), t);
}

const ehElemento = (no: No): no is Elemento => "tagName" in no;

function isento(e: Elemento): boolean {
  return attr(e, "lang") === "pt-BR" && (attr(e, "data-i18n-nome") !== undefined || attr(e, "data-i18n-estado") === "portugues_marcado");
}

/** Português visível sem marca numa página inglesa (texto e atributos humanos). */
export function portuguesSemMarca(doc: No): string[] {
  const erros: string[] = [];
  const corpo = elementos(doc).find((e) => e.tagName === "body");
  if (!corpo) return ["sem body"];
  const visita = (no: No) => {
    if ("value" in no) {
      const t = semNomesLivres(no.value).replace(/\s+/g, " ").trim();
      if (t && (PT_FORTE.test(t) || ACENTO.test(t))) erros.push(t.slice(0, 120));
      return;
    }
    if (!ehElemento(no)) return;
    if (tecnicos.has(no.tagName) || isento(no)) return;
    for (const a of ATRIBUTOS) {
      const v = attr(no, a);
      if (v && PT_ATRIBUTO.test(semNomesLivres(v))) erros.push(`[${a}] ${v.slice(0, 120)}`);
    }
    for (const f of filhos(no)) visita(f);
  };
  visita(corpo);
  return erros;
}

/** Detector comum da plataforma (ilhas com aviso, inglês na página portuguesa) mais o forte acima. */
export function vazamentosEnergia(pt: No, en: No): { pt: string[]; en: string[] } {
  return { pt: vazamentos(pt, "pt"), en: [...vazamentos(en, "en"), ...portuguesSemMarca(en)] };
}

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  janeiro: 1, fevereiro: 2, "março": 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  feb: 2, apr: 4, may: 5, aug: 8, sep: 9, oct: 10, dec: 12,
  january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function textoVisivel(no: No): string {
  if ("value" in no) return no.value;
  if (ehElemento(no) && tecnicos.has(no.tagName)) return "";
  return filhos(no).map(textoVisivel).join(" ");
}

/**
 * Números do corpo como multiconjunto de valores: "1.552" e "1,552" dão 1 e 552 nos dois; o mês por
 * nome vira o número do mês; "16h" vira 16 e 0, como "16:00"; zeros à esquerda não contam.
 */
export function numerosNormalizados(corpo: No): string[] {
  const t = textoVisivel(corpo)
    .replace(/\b(\d{1,2})h\b/g, "$1:00")
    .replace(new RegExp("\\p{L}+", "gu"), (p) => {
      const n = MESES[p.toLowerCase()];
      return n ? ` ${n} ` : p;
    });
  return (t.match(/\d+/g) ?? []).map((d) => String(Number(d))).sort();
}

export function diferencaMulticonjunto(a: string[], b: string[]): { soEmA: string[]; soEmB: string[] } {
  const conta = new Map<string, number>();
  for (const x of a) conta.set(x, (conta.get(x) ?? 0) + 1);
  for (const x of b) conta.set(x, (conta.get(x) ?? 0) - 1);
  const soEmA: string[] = [];
  const soEmB: string[] = [];
  for (const [k, v] of conta) {
    for (let i = 0; i < v; i++) soEmA.push(k);
    for (let i = 0; i < -v; i++) soEmB.push(k);
  }
  return { soEmA, soEmB };
}

/** Destinos dos links de conteúdo (o seletor de idioma aponta, por definição, para o outro idioma). */
export function destinos(corpo: No): string[] {
  return elementos(corpo)
    .filter((e) => e.tagName === "a" && attr(e, "hreflang") === undefined && attr(e, "href") !== undefined)
    .map((e) => attr(e, "href")!);
}

export function destinosEsperadosEmIngles(corpoPt: No): string[] {
  return destinos(corpoPt).map((href) => hrefNoIdioma(href, "en"));
}

export function estruturaDeTitulos(corpo: No): string[] {
  return elementos(corpo).filter((e) => /^h[1-6]$/.test(e.tagName)).map((e) => e.tagName);
}

export function tituloPrincipalVisivel(corpo: No): string {
  const h1 = elementos(corpo).filter((e) => e.tagName === "h1" && !oculto(e));
  return h1.length ? texto(h1[0]).replace(/\s+/g, " ").trim() : "";
}
