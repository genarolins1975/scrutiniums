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

const PT_FORTE = new RegExp("(?:^|[^\\p{L}])(?:de|da|das|dos|em|na|nas|nos|para|pelo|pela|pelos|pelas|com|que|uma|não|são|à|às|ao|aos|também|está|entre|quando|cada|até|desde|após|sem|mais|ou|é|energia|armazenada|usina|usinas|preço|preços|consumo|fonte|fontes|dados|valor|valores|ano|anos|mês|meses|dia|dias|hora|horas|média|leilão|leilões|tarifa|tarifas|conta|distribuidora|distribuidoras|geração|carga|rede|perdas|qualidade|mercado|regra|regras|ver|abrir|baixar|mostrar|fechar|todos|todas|nenhum|nenhuma|outros|outras|sobre|período|janela|observado|calculado|estimado|previsto|cenário|página|painel|semana|semanas|abaixo|acima|maior|menor|últimos|últimas|hoje|ontem)(?=$|[^\\p{L}])|\\p{L}(?:ção|ções|ões)(?=$|[^\\p{L}])", "iu");
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

const ABREV_PT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LONGO_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ABREV_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONGO_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const alternativa = (lista: string[]) => lista.join("|");
/**
 * O nome do mês só conta como mês colado a um número, como os formatadores o escrevem: "out/2026",
 * "7 de outubro de 2026", "outubro de 2026", "Oct 17, 2026", "Oct 2026", "May ’23", "October 7".
 * Assim "dez períodos", "set of" e "may" verbal não viram mês.
 */
const MES_DATA: [RegExp, string[]][] = [
  [new RegExp(`(?<![\\p{L}])(${alternativa(ABREV_PT)})(?=/\\d)`, "giu"), ABREV_PT],
  [new RegExp(`(?<![\\p{L}])(${alternativa(LONGO_PT)})(?= de \\d)`, "giu"), LONGO_PT],
  [new RegExp(`(?<![\\p{L}])(${alternativa(LONGO_EN)})(?= \\d)`, "gu"), LONGO_EN],
  [new RegExp(`(?<![\\p{L}])(${alternativa(ABREV_EN)})(?= (?:\\d|\u2019\\d))`, "gu"), ABREV_EN],
];

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
    .replace(/\b(\d{1,2})h\b/g, "$1:00");
  const comMeses = MES_DATA.reduce((acc, [re, lista]) => acc.replace(re, (m) => ` ${lista.findIndex((x) => x.toLowerCase() === m.toLowerCase()) + 1} `), t);
  return (comMeses.match(/\d+/g) ?? []).map((d) => String(Number(d))).sort();
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
