import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DIMENSOES, GRUPOS, filtraDimensoes } from "@/lib/eficiencia/dimensoes";
import { PAGINAS_MOBILIDADE, ROTA_MOBILIDADE } from "@/lib/eficiencia/mobilidade/modelo";
import { estadoRotaMobilidade } from "@/lib/eficiencia/mobilidade/roteamento";

describe("descoberta de serviços públicos", () => {
  it("busca necessidades com acentos ou palavras presentes no escopo", () => {
    expect(filtraDimensoes("agua", "Todas").map(d => d.id)).toContain("saneamento");
    expect(filtraDimensoes("aposentadoria", "Todas").map(d => d.id)).toEqual(["previdencia"]);
    expect(filtraDimensoes("  atenção  primária  ", "Todas").map(d => d.id)).toEqual(["saude"]);
    expect(filtraDimensoes("termo inexistente", "Todas")).toEqual([]);
  });
  it("combina busca, grupo e disponibilidade, sem sugerir dados para as áreas sem publicação", () => {
    expect(filtraDimensoes("", "Todas", true).map(d => d.id)).toEqual(["educacao", "saude", "trabalho", "alimentacao", "assistencia", "mobilidade"]);
    expect(filtraDimensoes("", GRUPOS[2], true).map(d => d.id)).toEqual(["mobilidade"]);
    expect(filtraDimensoes("", GRUPOS[3], true)).toEqual([]);
    expect(filtraDimensoes("agua", "Todas", true)).toEqual([]);
    expect(filtraDimensoes("", GRUPOS[1]).every(d => d.grupo === GRUPOS[1])).toBe(true);
    expect(filtraDimensoes("", "Todas")).toEqual(DIMENSOES);
  });
  it("cada painel publicado aponta para uma rota existente e as demais áreas não têm link fictício", () => {
    for (const d of DIMENSOES.filter(d => d.href)) {
      // Somente Mobilidade usa a rota opcional; conferir seu contrato finito.
      const arquivo = d.href === ROTA_MOBILIDADE ? "[[...painel]]/page.tsx" : "page.tsx";
      expect(existsSync(join(process.cwd(), "src/app", d.href!, arquivo)), d.href).toBe(true);
      if (d.href === ROTA_MOBILIDADE) expect(estadoRotaMobilidade(d.href)).toBe("valida");
    }
    expect(new Set(DIMENSOES.map(d => d.id)).size).toBe(DIMENSOES.length);
    expect(DIMENSOES.filter(d => !d.href).map(d => d.id)).toEqual(["previdencia", "seguranca", "justica", "habitacao", "saneamento", "energia", "ambiente", "cultura", "esporte", "servicos"]);
  });
  it("a rota dinâmica não aceita subpáginas fictícias", () => {
    expect(PAGINAS_MOBILIDADE.map(p => p.slug)).toEqual(["", "tempo", "transporte", "acesso", "oportunidades", "seguranca", "recursos", "comparar", "metodos"]);
    for (const p of PAGINAS_MOBILIDADE) expect(estadoRotaMobilidade(ROTA_MOBILIDADE + (p.slug ? "/" + p.slug : ""))).toBe("valida");
    for (const p of ["inexistente", "tempo/inexistente", "metodos/inexistente"]) expect(estadoRotaMobilidade(ROTA_MOBILIDADE + "/" + p)).toBe("inexistente");
    expect(estadoRotaMobilidade("/app/admin")).toBe("fora");
  });
  it("Mobilidade reutiliza tokens neutros do OBEE", () => {
    const css = readFileSync("src/components/eficiencia/mobilidade/mobilidade.module.css", "utf8");
    expect(css).toContain("var(--cor-obee)");
    expect(css).toContain("var(--cor-linha)");
    expect(css).not.toMatch(/#[0-9a-fA-F]{6}|--mob-accent|--mob-rule|--cor-(sucesso|erro)/);
  });
});
