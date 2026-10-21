import { expect } from "vitest";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { attr, elementos, tag, vazamentos, type Elemento, type No } from "./i18n-dom";
import { portuguesSemMarca } from "./i18n-energia";
import { numerosDoCorpo } from "./i18n-traduzido";

/**
 * Prova de paridade das telas de entrada traduzidas (/entrar, /entrar/sms, /entrar/sms/verificar).
 * Os textos de cada idioma são conferidos literalmente por verificarPaginaAuth e verificarPaginaSms;
 * aqui se exige que a tradução não mude o formulário: mesmos elementos, na mesma ordem, com os
 * mesmos atributos (exceto os IDs gerados pelo React e as referências a eles), os mesmos destinos
 * com as irmãs traduzidas trocadas por /en, os mesmos números e nenhum português sem marca.
 */
const RELACOES = new Set(["id", "for", "aria-describedby", "href"]);

function assinatura(form: Elemento): [string, [string, string][]][] {
  return elementos(form).map((e) => [e.tagName, e.attrs
    .filter((a) => !RELACOES.has(a.name))
    .map((a): [string, string] => [a.name, a.value])
    .sort(([a], [b]) => a.localeCompare(b))]);
}

function destinos(no: Elemento): string[] {
  return elementos(no).filter((e) => e.tagName === "a" && attr(e, "hreflang") === undefined).map((e) => attr(e, "href") ?? "");
}

export function verificarEntradaTraduzida(pt: No, en: No): void {
  expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
  expect(attr(tag(en, "html"), "lang")).toBe("en");
  expect(vazamentos(pt, "pt")).toEqual([]);
  expect(vazamentos(en, "en")).toEqual([]);
  expect(portuguesSemMarca(en)).toEqual([]);
  for (const doc of [pt, en]) {
    expect(elementos(doc).filter((e) => attr(e, "data-i18n-estado") !== undefined || attr(e, "data-i18n-aviso") !== undefined)).toEqual([]);
  }
  const corpoPt = tag(pt, "body"), corpoEn = tag(en, "body");
  expect(assinatura(tag(en, "form")), "formulário com a mesma estrutura e os mesmos atributos").toEqual(assinatura(tag(pt, "form")));
  expect(destinos(corpoEn)).toEqual(destinos(corpoPt).map((href) => hrefNoIdioma(href, "en")));
  expect(numerosDoCorpo(corpoEn)).toEqual(numerosDoCorpo(corpoPt));
  expect(elementos(corpoEn).filter((e) => /^h[1-6]$/.test(e.tagName)).map((e) => e.tagName))
    .toEqual(elementos(corpoPt).filter((e) => /^h[1-6]$/.test(e.tagName)).map((e) => e.tagName));
}
