import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DefaultTreeAdapterMap } from "parse5";
import { expect } from "vitest";
import { lerNomesPreservados } from "../../../scripts/i18n/glossario.mjs";
import { criarContextoProdutos } from "../../../scripts/i18n/produtos.mjs";

export type No = DefaultTreeAdapterMap["node"];
export type Elemento = DefaultTreeAdapterMap["element"];
export type Forma = string | { tag: string; atributos: [string, string][]; filhos: Forma[] };
export const attr = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
export const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const tecnicos = new Set(["script", "style", "template"]);
const atributosHumanos = ["aria-label", "aria-description", "title", "alt", "placeholder"];
export function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
export function texto(no: No): string {
  if ("tagName" in no && tecnicos.has(no.tagName)) return "";
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
export function unico(no: No, predicado: (e: Elemento) => boolean, descricao: string): Elemento {
  const encontrados = elementos(no).filter(predicado);
  expect(encontrados, descricao).toHaveLength(1);
  return encontrados[0];
}
export const tag = (no: No, nome: string) => unico(no, (e) => e.tagName === nome, nome);
export function meta(no: No, nome: string): string[] {
  return elementos(no).filter((e) => e.tagName === "meta"
    && (attr(e, "name") === nome || attr(e, "property") === nome)).map((e) => attr(e, "content") ?? "");
}
export function links(no: No, rel: string): Elemento[] {
  return elementos(no).filter((e) => e.tagName === "link" && attr(e, "rel") === rel);
}

/** Preserva texto, espaços, números, atributos e destinos; ignora só transporte React. */
export function conteudo(no: No): Forma[] {
  const saida: Forma[] = [];
  for (const filho of filhos(no)) {
    if ("value" in filho) {
      if (typeof saida[saida.length - 1] === "string") {
        saida[saida.length - 1] = String(saida[saida.length - 1]) + filho.value;
      } else saida.push(filho.value);
    } else if ("tagName" in filho && !tecnicos.has(filho.tagName)) {
      saida.push({
        tag: filho.tagName,
        atributos: filho.attrs.map((a): [string, string] => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        filhos: conteudo(filho),
      });
    }
  }
  return saida;
}

const nomesProprios = lerNomesPreservados(
  readFileSync(new URL("../../../config/glossario-en.json", import.meta.url), "utf8"),
  criarContextoProdutos(fileURLToPath(new URL("../../../", import.meta.url))),
);
const escapar = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function semNomes(textoOriginal: string, nomes: readonly string[]): string {
  return [...nomes].sort((a, b) => b.length - a.length).reduce((restante, nome) =>
    restante.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])${escapar(nome)}(?=$|[^\\p{L}\\p{N}_])`, "giu"), "$1"), textoOriginal);
}
export function oculto(no: Elemento): boolean {
  return attr(no, "hidden") !== undefined || attr(no, "aria-hidden") === "true"
    || /(?:^|\s)(?:hidden|sr-only|invisible|opacity-0)(?:\s|$)/.test(attr(no, "class") ?? "")
    || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)/.test(attr(no, "style") ?? "")
    || (no.parentNode !== null && "tagName" in no.parentNode && oculto(no.parentNode));
}

/** Detector incremental: ilhas válidas não dispensam o head nem atributos fora delas. */
export function vazamentos(doc: No, idioma: "pt" | "en", nomes: readonly string[] = nomesProprios): string[] {
  const erros: string[] = [];
  const todos = elementos(doc);
  const ilhasValidas = new Set<Elemento>();
  const avisosVinculados = new Set<Elemento>();
  for (const ilha of todos.filter((e) => attr(e, "data-i18n-estado") !== undefined)) {
    const irmaos = ilha.parentNode ? filhos(ilha.parentNode).filter((e): e is Elemento => "tagName" in e) : [];
    const aviso = irmaos[irmaos.indexOf(ilha) - 1];
    const valido = attr(ilha, "data-i18n-estado") === "portugues_marcado" && attr(ilha, "lang") === "pt-BR"
      && aviso && attr(aviso, "data-i18n-aviso") !== undefined && attr(aviso, "lang") === "en"
      && texto(aviso).trim() === "Portuguese only" && !oculto(aviso) && !oculto(ilha);
    if (!valido) erros.push("ilha-sem-aviso-visivel-ou-idioma");
    else {
      ilhasValidas.add(ilha);
      avisosVinculados.add(aviso);
    }
    if (idioma === "pt") erros.push("marcador-ingles-em-pagina-portuguesa");
  }
  for (const aviso of todos.filter((e) => attr(e, "data-i18n-aviso") !== undefined)) {
    if (!avisosVinculados.has(aviso)) erros.push("aviso-sem-ilha");
  }
  const verifica = (valor: string, dentro: boolean, lang: string) => {
    if (!valor.trim() || (idioma === "en" && dentro && lang === "pt-BR")) return;
    const restante = semNomes(valor, nomes);
    if (new RegExp("\\b(?:idioma|traducao)\\.[a-z_]+\\b", "u").test(restante)) erros.push(`chave-na-interface: ${valor}`);
    const portugues = new RegExp("(?:^|[^\\p{L}])(?:não|são|dados)(?=$|[^\\p{L}])|[\\p{L}]+(?:ção|ções)\\b", "iu");
    const ingles = new RegExp("\\b(?:the|are|with|only|your|Portuguese|English|Language)\\b", "iu");
    if (idioma === "en" && portugues.test(restante)) erros.push(`portugues-sem-marca: ${valor}`);
    if (idioma === "pt" && ingles.test(restante)) erros.push(`ingles-na-pagina-portuguesa: ${valor}`);
  };
  const visita = (no: No, dentro: boolean, lang: string) => {
    if ("value" in no) { verifica(no.value, dentro, lang); return; }
    if ("tagName" in no) {
      if (tecnicos.has(no.tagName)) return;
      dentro = dentro || ilhasValidas.has(no);
      lang = attr(no, "lang") ?? lang;
      for (const nome of atributosHumanos) verifica(attr(no, nome) ?? "", dentro, lang);
      if (no.tagName === "meta" && /^(?:description|og:(?:title|description|image:alt)|twitter:(?:title|description|image:alt))$/.test(attr(no, "name") ?? attr(no, "property") ?? "")) {
        verifica(attr(no, "content") ?? "", false, idioma === "pt" ? "pt-BR" : "en");
      }
    }
    for (const filho of filhos(no)) visita(filho, dentro, lang);
  };
  visita(doc, false, idioma === "pt" ? "pt-BR" : "en");
  return erros;
}
