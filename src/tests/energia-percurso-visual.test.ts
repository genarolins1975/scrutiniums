import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { ETAPAS_ENERGIA } from "@/lib/energia/percurso-visual";
import { PercursoVisualEnergia } from "@/components/energia/PercursoVisualEnergia";

describe("percurso visual da energia", () => {
  it("as quatro etapas têm destinos publicados e âncoras únicas", () => {
    expect(new Set(ETAPAS_ENERGIA.map(e => e.id)).size).toBe(4);
    for (const e of ETAPAS_ENERGIA) {
      for (const href of [e.href, e.detalhe]) expect(existsSync(join(process.cwd(), "src/app", href, "page.tsx")), href).toBe(true);
    }
  });
  it("o HTML inicial oferece controles nativos e explicita a simplificação física", () => {
    const html = renderToStaticMarkup(createElement(PercursoVisualEnergia));
    for (const e of ETAPAS_ENERGIA) expect(html).toContain(`id="etapa-${e.id}"`);
    // nenhuma etapa vem escolhida: o detalhe abre quando o leitor escolhe uma ("Escolha uma etapa e descubra o que acontece nela"),
    // e o da primeira etapa já está no HTML, recolhido (orçamento de comprimento da entrada, Iniciativa 4)
    expect(html).not.toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(4);
    expect(html).toMatch(/<div id="percurso-detalhe"[^>]*hidden=""/);
    expect(html.match(/aria-controls="percurso-detalhe"/g)).toHaveLength(4);
    expect(html).toContain("não representa a topologia ou o despacho do SIN");
    expect(html).toContain("Geração distribuída e sistemas isolados");
    expect(html).toContain("geradas por IA");
    expect(html).toContain("Potência instalada é capacidade");
  });
  it("os ativos da página cabem no orçamento de 700 KB", () => {
    const peso = ["sistema-gravura-v1", "etapas-gravura-v1", "conta-gravura-v1"].reduce((s, n) => s + statSync(join(process.cwd(), `public/energia/arte/${n}.webp`)).size, 0);
    expect(peso).toBeLessThan(700 * 1024);
  });
});
