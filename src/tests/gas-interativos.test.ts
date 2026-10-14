import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolverSelecaoGas } from "@/lib/gas/selecao";
import { ExploradorBalanco } from "@/components/gas/ExploradorBalanco";
import { SeriePorUf } from "@/components/gas/SeriePorUf";
import { goldGas } from "@/lib/gas/gold";

describe("exploradores do gás", () => {
  it("distingue seleção ausente, válida e inválida", () => {
    expect(resolverSelecaoGas(null, ["RJ", "SP"], "RJ")).toEqual({ valor: "RJ", invalida: false });
    expect(resolverSelecaoGas("SP", ["RJ", "SP"], "RJ").valor).toBe("SP");
    expect(resolverSelecaoGas("XX", ["RJ", "SP"], "RJ")).toEqual({ valor: "RJ", invalida: true });
  });
  it("não desenha composição no mês reprovado", () => {
    const ponto = goldGas.aproveitamento().serie.find((x) => x.situacao === "inconsistente")!;
    const html = renderToStaticMarkup(createElement(ExploradorBalanco, { serie: [ponto] }));
    expect(html).toContain("Balanço inconsistente");
    expect(html).toContain("sem dado");
    expect(html).not.toContain("<svg");
    expect(html).toContain("<table");
  });
  it("distingue ausência de reprovação e preserva zero publicado", () => {
    const ponto = { mes: "2026-01", situacao: "incompleto" as const, producao: 0, diferenca_pct: null };
    const html = renderToStaticMarkup(createElement(ExploradorBalanco, { serie: [ponto] }));
    expect(html).toContain("Sem dado: falta uma parcela");
    expect(html).toContain("0,00 milhões de m³/dia");
    expect(html).not.toContain("Balanço inconsistente");
  });
  it("informa ausência de série sem lançar exceção", () => {
    const html = renderToStaticMarkup(createElement(ExploradorBalanco, { serie: [] }));
    expect(html).toContain("Sem dados para explorar");
  });
  it("não fabrica retrato de UF sem preço", () => {
    const html = renderToStaticMarkup(createElement(SeriePorUf, {
      titulo: "Preço", serieUf: [{ mes: "2026-01", SP: null }], serieBrasil: [{ mes: "2026-01", medio: null }],
      ufs: [{ uf: "SP", nome: "São Paulo" }], inicial: "SP", unidade: "R$/m³", corUf: "#35598A", corBrasil: "#555555",
      retrato: { periodo: "2026-01", ufs: [] },
    }));
    expect(html).toContain("sem dado");
    expect(html).not.toContain("0,00 R$/m³");
    expect(html).toContain("intervalo de confiança");
  });
});
