import type { Idioma } from "./idioma";
import { parDeIdioma, traducaoPublicada } from "./i18n-rotas";

/**
 * Destino de um link interno no idioma da página. Em inglês, aponta para a irmã
 * /en só quando ela tem tradução publicada; o resto continua no endereço
 * português. Query e fragmento são preservados.
 */
export function hrefNoIdioma(href: string, idioma: Idioma): string {
  if (idioma === "pt" || !href.startsWith("/")) return href;
  const corte = href.search(/[?#]/);
  const caminho = corte < 0 ? href : href.slice(0, corte);
  const resto = corte < 0 ? "" : href.slice(corte);
  const par = parDeIdioma(caminho || "/");
  return par && traducaoPublicada(par.pt) ? par.en + resto : href;
}
