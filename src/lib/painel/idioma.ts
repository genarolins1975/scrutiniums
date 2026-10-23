import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import type { Idioma } from "@/lib/idioma";

/**
 * Idioma das páginas do Setor Elétrico. A URL decide: /en e /en/... são inglês, o resto é
 * português, sem cookie nem cabeçalho (a geração estática continua valendo).
 *
 * No servidor, o endereço vem do armazenamento da renderização do Next (urlPathname), o mesmo
 * que o Next usa nos metadados; vale para componente de servidor, componente de cliente
 * renderizado no servidor, generateMetadata e funções de lib chamadas por eles. Cada render tem o
 * seu: duas páginas em idiomas diferentes geradas ao mesmo tempo não se misturam. No navegador,
 * vale o endereço da janela. Fora de render (teste, script), português.
 *
 * Componente de cliente deve preferir useIdioma() (src/lib/energia/useIdioma.ts), que segue o
 * roteador também durante uma navegação, e passar o idioma aos formatadores (formatos(idioma)).
 *
 * O armazenamento é um módulo interno do Next 14 (fixado em 14.2.35 no package.json); o teste
 * energia-idioma.test.ts falha se ele mudar de lugar.
 */
export function idiomaDoCaminho(caminho: string | null | undefined): Idioma {
  return caminho === "/en" || caminho?.startsWith("/en/") || caminho?.startsWith("/en?") ? "en" : "pt";
}

/**
 * Idioma automático só dentro do Setor Elétrico (/en/setor-eletrico). Fora dele (a home inglesa, as páginas
 * institucionais), as peças do Setor Elétrico que aparecem (vitrines, formatadores) ficam em português: essas
 * páginas passam o idioma explicitamente onde há tradução e marcam o resto como português.
 */
export function idiomaDoCaminhoEnergia(caminho: string | null | undefined): Idioma {
  const c = caminho?.split(/[?#]/)[0] ?? "";
  return c === "/en/setor-eletrico" || c.startsWith("/en/setor-eletrico/") || APERITIVOS_ENERGIA_EN.has(c.replace(/\/+$/, "")) ? "en" : "pt";
}

/**
 * Versões aperitivo inglesas do Setor Elétrico (princípio do aperitivo, 20/10/2026). O middleware as serve por rewrite no endereço
 * público (/en/setor-eletrico/...): no HTML estático o caminho é o interno, no navegador é o público, e os dois têm de dar inglês.
 */
const APERITIVOS_ENERGIA_EN = new Set(["/en/aperitivo/conta-de-luz"]);

export function idiomaEnergia(): Idioma {
  const store = staticGenerationAsyncStorage.getStore();
  if (store?.urlPathname) return idiomaDoCaminhoEnergia(store.urlPathname);
  if (typeof window !== "undefined") return idiomaDoCaminhoEnergia(window.location.pathname);
  return "pt";
}

/**
 * Texto nos dois idiomas, lado a lado no código, escolhido pelo idioma da página. O português
 * sai idêntico ao que era: a versão portuguesa da página não muda. Aceita qualquer nó React
 * (frase com link ou destaque), desde que as duas formas tenham o mesmo papel.
 */
export function tx<T>(pt: T, en: T, idioma: Idioma = idiomaEnergia()): T {
  return idioma === "en" ? en : pt;
}

/** Escolhe entre duas formas por idioma explícito (útil em lib chamada por cliente e servidor). */
export function porIdioma<T>(idioma: Idioma, formas: { pt: T; en: T }): T {
  return formas[idioma];
}

/** Prefixo de endereço do idioma: "" em português, "/en" em inglês. */
export function prefixoIdioma(idioma: Idioma = idiomaEnergia()): "" | "/en" {
  return idioma === "en" ? "/en" : "";
}

/**
 * Idioma da página em renderização, para as peças do kit de painel (src/components/painel). Hoje só o Setor Elétrico tem irmã inglesa
 * (/en/setor-eletrico); nas demais coleções é sempre português. Mesmo critério de idiomaEnergia, com o nome do kit.
 */
export const idiomaDaPagina = idiomaEnergia;
