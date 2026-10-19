import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { describe, expect, it } from "vitest";
import { vitrines } from "@/lib/vitrine";
import { portas } from "@/lib/perguntas/portas";
import { rotaPorta } from "@/lib/perguntas/rotas";
import { DOMINIOS } from "@/lib/dominios";
import { HeroPerguntas } from "@/components/home/HeroPerguntas";
import { Hero } from "@/components/home/Hero";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import { SecaoPlataforma } from "@/components/home/SecaoPlataforma";
import { SecaoRecursos } from "@/components/home/SecaoRecursos";
import { attr, elementos, type Elemento } from "./suporte/i18n-dom";

/**
 * Home do celular enxuta (achado A9 da banca de 19/10/2026). Até então a home
 * empilhava duas taxonomias à vista, as seis perguntas e o índice das coleções
 * com os oito capítulos, e media 26.988 px a 390 px. Agora só as perguntas
 * ficam à vista; índice, capítulos das coleções, método e recursos ficam em
 * <details> fechados, que continuam no HTML (auditabilidade) e a um clique.
 */

const html = (no: Parameters<typeof renderToStaticMarkup>[0]) => parse(renderToStaticMarkup(no));
const dentroDeDetails = (e: Elemento): boolean => {
  for (let p = e.parentNode; p && "tagName" in p; p = p.parentNode) if (p.tagName === "details") return true;
  return false;
};

describe("home com uma só taxonomia à vista", () => {
  const v = vitrines();

  it("as seis perguntas ficam à vista, cada uma com a sua página aberta", () => {
    const doc = html(createElement(HeroPerguntas, { portas: portas() }));
    const links = elementos(doc).filter((e) => e.tagName === "a");
    for (const p of portas()) {
      const a = links.find((l) => attr(l, "href") === rotaPorta(p.id));
      expect(a, p.id).toBeDefined();
      expect(dentroDeDetails(a as Elemento), `${p.id} não pode ficar recolhida`).toBe(false);
    }
  });

  it("o índice das coleções, os capítulos, o método e os recursos começam recolhidos e continuam no HTML", () => {
    const blocos = [
      createElement(Hero, { vitrines: v }),
      createElement(SecaoObservatorios, { vitrines: v }),
      createElement(SecaoPlataforma),
      createElement(SecaoRecursos),
    ];
    for (const bloco of blocos) {
      const doc = html(bloco);
      const detalhes = elementos(doc).filter((e) => e.tagName === "details");
      expect(detalhes.length, "um bloco recolhido").toBeGreaterThanOrEqual(1);
      const recolhido = detalhes.find((d) => attr(d, "class")?.includes("group/recolhido"));
      expect(recolhido, "bloco recolhido da home").toBeDefined();
      expect(attr(recolhido as Elemento, "open"), "começa fechado").toBeUndefined();
      const resumo = elementos(recolhido as Elemento).find((e) => e.tagName === "summary");
      expect(resumo, "resumo acessível").toBeDefined();
    }
  });

  it("todo destino do índice segue a um clique: lâminas, capítulos e painéis de cada coleção", () => {
    const hero = elementos(html(createElement(Hero, { vitrines: v })));
    const secao = elementos(html(createElement(SecaoObservatorios, { vitrines: v })));
    for (const d of DOMINIOS) {
      const lamina = hero.find((e) => e.tagName === "a" && attr(e, "href") === `#obs-${d.id}`);
      expect(lamina, d.id).toBeDefined();
      expect(dentroDeDetails(lamina as Elemento)).toBe(true);
      const capitulo = secao.find((e) => attr(e, "id") === `obs-${d.id}`);
      expect(capitulo?.tagName, d.id).toBe("article");
      const hrefs = new Set(secao.filter((e) => e.tagName === "a").map((e) => attr(e, "href")));
      for (const p of v[d.id].paineis) expect(hrefs.has(p.href), `${d.id}: ${p.href}`).toBe(true);
      expect(hrefs.has(d.rotaRaiz), d.rotaRaiz).toBe(true);
    }
  });

  it("os cabeçalhos das seções recolhidas ficam à vista, no resumo", () => {
    for (const [bloco, id] of [
      [createElement(SecaoObservatorios, { vitrines: v }), "observatorios-titulo"],
      [createElement(SecaoPlataforma), "plataforma-titulo"],
      [createElement(SecaoRecursos), "recursos-titulo"],
    ] as const) {
      const h2 = elementos(html(bloco)).find((e) => attr(e, "id") === id);
      expect(h2?.tagName, id).toBe("h2");
      let resumo = false;
      for (let p = h2?.parentNode; p && "tagName" in p; p = p.parentNode) if (p.tagName === "summary") resumo = true;
      expect(resumo, `${id} no resumo`).toBe(true);
    }
  });
});
