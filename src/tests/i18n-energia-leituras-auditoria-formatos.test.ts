import { describe, expect, it } from "vitest";
import { participacaoTexto } from "@/lib/energia/transicao";
import { resumoChaves } from "@/lib/energia/evidencia";

describe("participação já expressa em pontos percentuais", () => {
  it.each([
    [0.00097, "0,00097%", "0.00097%"],
    [-0.005, "-0,005%", "-0.005%"],
    [0.01, "0,01%", "0.01%"],
    [-0.01, "−0,01%", "−0.01%"],
    [0, "0,00%", "0.00%"],
    [80.03, "80,03%", "80.03%"],
    [1234.56, "1.234,56%", "1,234.56%"],
    // O teto de 12 casas é preexistente; não promete precisão arbitrária.
    [1e-13, "0%", "0%"],
  ] as const)("preserva precisão, escala e sinal de %s", (valor, pt, en) => {
    expect(participacaoTexto(valor)).toBe(pt);
    expect(participacaoTexto(valor, "pt")).toBe(pt);
    expect(participacaoTexto(valor, "en")).toBe(en);
  });

  it("mantém ausência e não finitos sem transformá-los em zero", () => {
    for (const valor of [null, undefined, NaN, Infinity, -Infinity]) {
      expect(participacaoTexto(valor)).toBe("sem dado");
      expect(participacaoTexto(valor, "pt")).toBe("sem dado");
      expect(participacaoTexto(valor, "en")).toBe("sem dado");
    }
  });
});

type Resumo = Parameters<typeof resumoChaves>[0];
function congelar<T extends object>(valor: T): T {
  for (const filho of Object.values(valor)) if (filho !== null && typeof filho === "object") congelar(filho);
  return Object.freeze(valor);
}

describe("resumo das chaves: prosa preservada e três contagens localizadas", () => {
  it.each([
    { nome: "consulta sem lista", entrada: { chaves_origem: [], chaves_total: 12345, consulta: "SELECT valor FROM fonte" },
      texto: "Observações selecionadas pela consulta abaixo; a lista não é publicada na interface." },
    { nome: "ausência sem consulta", entrada: { chaves_origem: [], chaves_total: 12345 }, texto: "Nenhuma chave de origem registrada." },
    { nome: "singular", entrada: { chaves_origem: ["a"] }, texto: "1 chave de origem." },
    { nome: "lista presente prevalece sobre consulta", entrada: { chaves_origem: ["a", "b"], consulta: "SELECT valor FROM fonte" }, texto: "2 chaves de origem." },
  ] satisfies { nome: string; entrada: Resumo; texto: string }[])("preserva $nome", ({ entrada, texto }) => {
    const antes = structuredClone(entrada);
    congelar(entrada);
    expect(resumoChaves(entrada)).toBe(texto);
    expect(resumoChaves(entrada, "pt")).toBe(texto);
    expect(resumoChaves(entrada, "en")).toBe(texto);
    expect(entrada).toEqual(antes);
  });

  it.each([true, false])("agrupa numerador e denominador sem mutação, manifesto %s", (manifesto) => {
    const entrada: Resumo = congelar({ chaves_origem: Array.from({ length: 1001 }, (_, i) => `chave-${i}`), chaves_total: 12345,
      ...(manifesto ? { manifesto: { rotulo: "Manifesto", url: "/fixture.csv" } } : {}) });
    const antes = structuredClone(entrada);
    const fim = manifesto ? " A lista completa está no manifesto para baixar." : " A lista completa não foi publicada.";
    expect(resumoChaves(entrada)).toBe("Primeiras 1.001 de 12.345 chaves de origem." + fim);
    expect(resumoChaves(entrada, "pt")).toBe("Primeiras 1.001 de 12.345 chaves de origem." + fim);
    expect(resumoChaves(entrada, "en")).toBe("Primeiras 1,001 de 12,345 chaves de origem." + fim);
    expect(entrada).toEqual(antes);
  });

  it("agrupa também o plural completo, sem chaves_total informado", () => {
    const entrada: Resumo = congelar({ chaves_origem: Array.from({ length: 1001 }, (_, i) => `chave-${i}`) });
    const antes = structuredClone(entrada);
    expect(resumoChaves(entrada)).toBe("1.001 chaves de origem.");
    expect(resumoChaves(entrada, "pt")).toBe("1.001 chaves de origem.");
    expect(resumoChaves(entrada, "en")).toBe("1,001 chaves de origem.");
    expect(entrada).toEqual(antes);
  });

  it("mantém as opções nativas do total, sem impor um preset inteiro", () => {
    // Fixture só de apresentação: não representa uma contagem publicada.
    const entrada: Resumo = congelar({ chaves_origem: ["a"], chaves_total: 1234.5678 });
    expect(resumoChaves(entrada)).toBe("Primeiras 1 de 1.234,568 chaves de origem. A lista completa não foi publicada.");
    expect(resumoChaves(entrada, "en")).toBe("Primeiras 1 de 1,234.568 chaves de origem. A lista completa não foi publicada.");
    expect(entrada.chaves_total).toBe(1234.5678);
  });
});
