import { expect } from "vitest";
import type { ParDeIdioma } from "@/lib/i18n-rotas";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { attr, elementos, filhos, meta, oculto, tag, texto, vazamentos, type Elemento, type No } from "./i18n-dom";

/**
 * Prova genérica de uma irmã com tradução publicada (conteudo "traduzido").
 * Em vez de um oráculo escrito à mão por página, confere as garantias que importam:
 * 1. nenhum português sem marca na página inglesa, nem inglês na portuguesa;
 * 2. os mesmos destinos de link, na ordem, com irmãs traduzidas trocadas por /en;
 * 3. os mesmos números (multiconjunto de sequências de dígitos) no corpo;
 * 4. a mesma estrutura de títulos e de regiões marcadas;
 * 5. head inglês próprio, indexável e com alternates recíprocos.
 */

const ehElemento = (no: No): no is Elemento => "tagName" in no;

/** Links de conteúdo: o seletor de idioma (hreflang) aponta, por definição, para o outro idioma. */
function destinos(corpo: Elemento): string[] {
  return elementos(corpo)
    .filter((e) => e.tagName === "a" && attr(e, "hreflang") === undefined && attr(e, "href") !== undefined)
    .map((e) => attr(e, "href")!);
}

/** Texto visível do corpo, fora de script, style e do seletor de idioma. */
function textoCorpo(no: No): string {
  if ("value" in no) return no.value;
  if (ehElemento(no)) {
    if (["script", "style", "template", "noscript"].includes(no.tagName)) return "";
    if (attr(no, "role") === "group" && elementos(no).some((e) => attr(e, "hreflang") !== undefined)) return "";
  }
  return filhos(no).map(textoCorpo).join(" ");
}

export function numerosDoCorpo(corpo: Elemento): string[] {
  return (textoCorpo(corpo).match(/\d+/g) ?? []).sort();
}

function titulos(corpo: Elemento): string[] {
  return elementos(corpo).filter((e) => /^h[1-6]$/.test(e.tagName)).map((e) => e.tagName);
}

function regioesMarcadas(corpo: Elemento): string[] {
  return elementos(corpo).filter((e) => attr(e, "data-i18n-estado") !== undefined).map((e) => attr(e, "data-i18n-regiao") ?? "");
}

export function verificarHeadTraduzido(pt: No, en: No, par: ParDeIdioma, titulosEsperados: { pt: string; en: string }): void {
  expect(par.conteudo).toBe("traduzido");
  expect(texto(tag(pt, "title"))).toBe(`${titulosEsperados.pt} · Scrutiniums`);
  expect(texto(tag(en, "title"))).toBe(`${titulosEsperados.en} · Scrutiniums`);
  const descricaoEn = meta(en, "description");
  expect(descricaoEn).toHaveLength(1);
  expect(descricaoEn[0].length).toBeGreaterThan(40);
  expect(descricaoEn).not.toEqual(meta(pt, "description"));
  expect(meta(en, "robots").some((valor) => /\bnoindex\b/.test(valor)), `${par.en} indexável`).toBe(false);
  for (const prefixo of ["og", "twitter"]) {
    expect(meta(en, `${prefixo}:title`)).toEqual([`${titulosEsperados.en} · Scrutiniums`]);
    expect(meta(en, `${prefixo}:description`)).toEqual(descricaoEn);
  }
}

export function verificarCorpoTraduzido(pt: No, en: No, par: ParDeIdioma): void {
  const corpoPt = tag(pt, "body");
  const corpoEn = tag(en, "body");
  expect(vazamentos(en, "en"), par.en).toEqual([]);
  expect(vazamentos(pt, "pt"), par.pt).toEqual([]);
  expect(elementos(corpoPt).some((e) => attr(e, "data-i18n-estado") !== undefined), `${par.pt} sem marcadores`).toBe(false);
  expect(destinos(corpoEn), `${par.en}: destinos de link`).toEqual(destinos(corpoPt).map((href) => hrefNoIdioma(href, "en")));
  expect(numerosDoCorpo(corpoEn), `${par.en}: números`).toEqual(numerosDoCorpo(corpoPt));
  expect(titulos(corpoEn), `${par.en}: títulos`).toEqual(titulos(corpoPt));
  for (const e of elementos(corpoEn).filter((e) => /^h[12]$/.test(e.tagName))) expect(oculto(e)).toBe(false);
  // regiões em português dentro da página traduzida são exceção declarada, nunca a página inteira
  for (const regiao of regioesMarcadas(corpoEn)) expect(regiao, `${par.en}: região marcada sem nome`).not.toBe("");
  expect(attr(tag(en, "html"), "lang")).toBe("en");
  expect(texto(tag(corpoEn, "h1")).trim()).not.toBe(texto(tag(corpoPt, "h1")).trim());
}
