import type { Idioma } from "./idioma";

export type UrlPagina = Readonly<{
  idioma: Idioma;
  caminhoPt: string;
  sufixo: string;
}>;

const RECURSOS = [
  "/api", "/_next", "/obs", "/home", "/energia", "/eficiencia",
  "/estado", "/gas", "/contas-estaduais", "/saneamento/gold", "/i18n",
];
const CARACTERES_INVALIDOS = /[\s\u0000-\u001f\u007f-\u009f\\]/;
const prefixoIngles = (caminho: string) => caminho === "/en" || caminho.startsWith("/en/");

function ehRecurso(caminho: string): boolean {
  const segmentos = caminho.replace(/\/$/, "").split("/");
  return RECURSOS.some((recurso) => caminho === recurso || caminho.startsWith(recurso + "/"))
    || segmentos[segmentos.length - 1].includes(".")
    || segmentos.some((segmento) => /^(opengraph-image|twitter-image)\d*(?:[.-]|$)/.test(segmento));
}

/** Lê a grafia de uma página interna; não comprova existência ou autoriza redirecionamentos. */
export function analisarUrlPagina(href: string): UrlPagina | null {
  if (!href.startsWith("/") || href.startsWith("//") || CARACTERES_INVALIDOS.test(href)) return null;
  const inicioSufixo = href.search(/[?#]/);
  const caminho = inicioSufixo === -1 ? href : href.slice(0, inicioSufixo);
  const sufixo = inicioSufixo === -1 ? "" : href.slice(inicioSufixo);
  if (caminho.includes("//") || /%(2f|5c)/i.test(caminho)) return null;

  // A visão decodificada serve só à validação. Nunca reconstrói o href nem sua query.
  let validado: string;
  try {
    validado = decodeURIComponent(caminho);
    encodeURI(validado); // Também rejeita sequências Unicode com surrogate isolado.
  } catch {
    return null;
  }
  if (CARACTERES_INVALIDOS.test(validado)
    || validado.split("/").some((segmento) => segmento === "." || segmento === "..")) return null;

  const ingles = prefixoIngles(caminho);
  // O prefixo tem uma única grafia; /%65n não é outro nome para /en.
  if (prefixoIngles(validado) !== ingles) return null;
  const caminhoPt = ingles ? caminho.slice(3) || "/" : caminho;
  const validadoPt = ingles ? validado.slice(3) || "/" : validado;
  if (prefixoIngles(validadoPt) || ehRecurso(validado) || ehRecurso(validadoPt)) return null;

  return { idioma: ingles ? "en" : "pt", caminhoPt, sufixo };
}

/** Troca somente o prefixo do pathname; preserva query, fragmento e barras finais. */
export function urlDaPagina(href: string, idioma: Idioma): string | null {
  const pagina = analisarUrlPagina(href);
  if (!pagina) return null;
  const caminho = idioma === "pt" ? pagina.caminhoPt
    : pagina.caminhoPt === "/" ? "/en" : "/en" + pagina.caminhoPt;
  return caminho + pagina.sufixo;
}
