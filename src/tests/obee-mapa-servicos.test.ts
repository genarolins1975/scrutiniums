import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DIMENSOES, GRUPOS, filtraDimensoes } from "@/lib/eficiencia/dimensoes";

describe("descoberta de serviços públicos", () => {
  it("busca necessidades com acentos ou palavras presentes no escopo", () => {
    expect(filtraDimensoes("agua", "Todas").map(d => d.id)).toContain("saneamento");
    expect(filtraDimensoes("aposentadoria", "Todas").map(d => d.id)).toEqual(["previdencia"]);
    expect(filtraDimensoes("  atenção  primária  ", "Todas").map(d => d.id)).toEqual(["saude"]);
    expect(filtraDimensoes("termo inexistente", "Todas")).toEqual([]);
  });
  it("combina busca, grupo e disponibilidade, sem sugerir dados para as áreas sem publicação", () => {
    expect(filtraDimensoes("", "Todas", true).map(d => d.id)).toEqual(["educacao", "saude"]);
    expect(filtraDimensoes("", GRUPOS[2], true)).toEqual([]);
    expect(filtraDimensoes("", GRUPOS[1]).every(d => d.grupo === GRUPOS[1])).toBe(true);
    expect(filtraDimensoes("", "Todas")).toEqual(DIMENSOES);
  });
  it("cada painel publicado aponta para uma rota existente e as demais áreas não têm link fictício", () => {
    for (const d of DIMENSOES.filter(d => d.href)) {
      expect(existsSync(join(process.cwd(), "src/app", d.href!, "page.tsx"))).toBe(true);
    }
    expect(new Set(DIMENSOES.map(d => d.id)).size).toBe(DIMENSOES.length);
  });
});
