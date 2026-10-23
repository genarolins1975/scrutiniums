import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "parse5";
import { describe, expect, it } from "vitest";
import { PADROES_DE_IDIOMA, PARES_DE_IDIOMA, parDeIdioma } from "@/lib/i18n-rotas";
import { attr, elementos, links, meta, tag, texto, type No } from "./suporte/i18n-dom";
import {
  destinos,
  destinosEsperadosEmIngles,
  diferencaMulticonjunto,
  estruturaDeTitulos,
  numerosNormalizados,
  tituloPrincipalVisivel,
  vazamentosEnergia,
} from "./suporte/i18n-energia";

/**
 * Prova do Setor Elétrico bilíngue no HTML gerado: toda página portuguesa do observatório tem a
 * irmã inglesa com documento inglês, head próprio e indexável, nenhum português sem marca, os
 * mesmos destinos de link (irmãs traduzidas em /en), os mesmos números e a mesma estrutura de
 * títulos; a portuguesa continua sem inglês. Páginas com parâmetro entram por instância gerada.
 * Sem build local o teste é pulado; com EXIGIR_BUILD_HTML=1 (CI) ele é obrigatório.
 */

const BUILD = join(process.cwd(), ".next");
const APP = join(BUILD, "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
const temBuild = existsSync(join(BUILD, "prerender-manifest.json"));
const BASE = "https://scrutiniums.com";

function caminhosDoSetor(): string[] {
  const literais = PARES_DE_IDIOMA.filter((p) => p.pt.startsWith("/setor-eletrico")).map((p) => p.pt);
  if (!temBuild) return literais;
  const rotas = Object.keys(JSON.parse(readFileSync(join(BUILD, "prerender-manifest.json"), "utf8")).routes ?? {});
  const instancias = rotas.filter((r) => r.startsWith("/setor-eletrico/") && !literais.includes(r) && parDeIdioma(r)
    && PADROES_DE_IDIOMA.some((p) => p.pt.startsWith("/setor-eletrico")));
  return [...literais, ...instancias].sort();
}

function documento(caminho: string): No {
  const arquivo = join(APP, `${caminho}.html`);
  expect(existsSync(arquivo), `HTML ausente: ${caminho}`).toBe(true);
  return parse(readFileSync(arquivo, "utf8"));
}

const corpo = (doc: No) => tag(doc, "body");
/** Título do documento (o do head; os gráficos SVG também têm <title>). */
const tituloDoc = (doc: No) => texto(elementos(tag(doc, "head")).find((e) => e.tagName === "title") ?? tag(doc, "head"));

describe.skipIf(!temBuild && !EXIGIR)("Setor Elétrico em inglês: HTML gerado", () => {
  const caminhos = caminhosDoSetor();
  /**
   * Os três testes de cada página leem os mesmos dois documentos, sem alterá-los (os auxiliares de ./suporte só
   * percorrem a árvore). Até 22/10/2026 cada teste relia e reanalisava os dois HTML: seis análises por página, e o
   * arquivo levava 141 s, o segundo mais lento da suíte. Guarda-se só a página corrente, porque os testes de uma
   * página rodam em sequência e cada árvore pesa dezenas de MB.
   */
  let ultimo: { caminho: string; docs: { pt: No; en: No } } | undefined;

  it("cobre todas as páginas do observatório, com e sem parâmetro", () => {
    expect(temBuild, "EXIGIR_BUILD_HTML=1 requer um build completo").toBe(true);
    expect(caminhos.length).toBeGreaterThan(79);
    for (const c of caminhos) expect(parDeIdioma(c)?.conteudo, c).toBe("traduzido");
  });

  describe.each(caminhos)("%s", (caminhoPt) => {
    const par = parDeIdioma(caminhoPt)!;
    const carregar = () => {
      if (ultimo?.caminho !== caminhoPt) ultimo = { caminho: caminhoPt, docs: { pt: documento(par.pt), en: documento(par.en) } };
      return ultimo.docs;
    };

    it("head inglês próprio, indexável e com alternates recíprocos", () => {
      const { pt, en } = carregar();
      expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
      expect(attr(tag(en, "html"), "lang")).toBe("en");
      expect(links(en, "canonical").map((e) => attr(e, "href"))).toEqual([BASE + par.en]);
      expect(links(pt, "canonical").map((e) => attr(e, "href"))).toEqual([BASE + par.pt]);
      const alternates = [["en", BASE + par.en], ["pt-BR", BASE + par.pt], ["x-default", BASE + par.pt]];
      for (const doc of [pt, en]) {
        expect(links(doc, "alternate").filter((e) => attr(e, "hreflang") !== undefined).map((e) => [attr(e, "hreflang"), attr(e, "href")]).sort()).toEqual(alternates);
      }
      expect(meta(en, "og:locale")).toEqual(["en_US"]);
      expect(meta(en, "robots").some((v) => /\bnoindex\b/.test(v)), "irmã inglesa não pode ser noindex").toBe(false);
      expect(tituloDoc(en), "título inglês igual ao português").not.toBe(tituloDoc(pt));
      const dPt = meta(pt, "description");
      const dEn = meta(en, "description");
      if (dPt.length) expect(dEn, "descrição inglesa igual à portuguesa").not.toEqual(dPt);
    });

    it("nenhum português sem marca no inglês e nenhum inglês no português", () => {
      const { pt, en } = carregar();
      const v = vazamentosEnergia(pt, en);
      expect(v.pt, `${par.pt}: inglês na página portuguesa`).toEqual([]);
      expect([...new Set(v.en)], `${par.en}: português sem marca`).toEqual([]);
    });

    it("mesmos destinos, mesmos números e mesma estrutura de títulos", () => {
      const { pt, en } = carregar();
      expect(destinos(corpo(en)), `${par.en}: destinos de link`).toEqual(destinosEsperadosEmIngles(corpo(pt)));
      expect(diferencaMulticonjunto(numerosNormalizados(corpo(pt)), numerosNormalizados(corpo(en))), `${par.en}: números`).toEqual({ soEmA: [], soEmB: [] });
      expect(estruturaDeTitulos(corpo(en)), `${par.en}: títulos`).toEqual(estruturaDeTitulos(corpo(pt)));
      const h1Pt = tituloPrincipalVisivel(corpo(pt));
      // título de uma palavra (nome de modelo ou termo técnico: NEWAVE, DESSEM, Constrained-off) é igual nos dois idiomas
      if (h1Pt && /\s/.test(h1Pt)) expect(tituloPrincipalVisivel(corpo(en)), `${par.en}: h1 não traduzido`).not.toBe(h1Pt);
      expect(elementos(corpo(pt)).some((e) => attr(e, "data-i18n-estado") !== undefined || attr(e, "data-i18n-nome") !== undefined), `${par.pt}: marca de idioma na página portuguesa`).toBe(false);
    });
  });
});
