import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FaixaDistribuicao, type PontoFaixa } from "@/components/eficiencia/FaixaDistribuicao";
import { fraseAmplitude, listaRotulos } from "@/lib/eficiencia/frases";

/**
 * Rótulos dos extremos da faixa de distribuição do panorama: quando há empate no menor ou no maior valor, o gráfico
 * nomeia todas as capitais empatadas (até o limite da frase) e cita as mesmas que a frase factual.
 */
const fmt = (v: number) => v.toFixed(1).replace(".", ",");
const pontos = (v: [string, string, number][]): PontoFaixa[] => v.map(([nome, uf, valor]) => ({ chave: nome, rotulo: `${nome} (${uf})`, valor, destacada: false }));
const html = (p: PontoFaixa[]) =>
  renderToStaticMarkup(createElement(FaixaDistribuicao, { pontos: p, mediana: 6.1, media: 6.0, faixa: null, formata: fmt, formataEixo: fmt, titulo: "Ideb" }));
/** Texto dos dois rótulos de extremo (os únicos <text> com tspan em negrito). */
const extremos = (h: string) => Array.from(h.matchAll(/<text[^>]*>(<tspan[^>]*>[^<]*<\/tspan>[^<]*)<\/text>/g)).map((m) => m[1].replace(/<[^>]+>/g, ""));

describe("faixa de distribuição: rótulos dos extremos com empate", () => {
  it("nomeia as duas capitais empatadas no maior valor", () => {
    const h = html(pontos([["Natal", "RN", 4.8], ["Recife", "PE", 6.1], ["Teresina", "PI", 6.9], ["Curitiba", "PR", 6.9]]));
    expect(extremos(h)).toContain("6,9 Curitiba (PR) e Teresina (PI)");
    expect(extremos(h)).toContain("4,8 Natal (RN)");
  });

  it("empate no menor valor e acima do limite: dois nomes e 'e mais N'", () => {
    const h = html(pontos([["Cuiabá", "MT", 1], ["Belém", "PA", 1], ["Aracaju", "SE", 1], ["Vitória", "ES", 5]]));
    expect(extremos(h)).toContain("1,0 Aracaju (SE), Belém (PA) e mais 1");
  });

  it("sem empate, mantém um nome por extremo", () => {
    const h = html(pontos([["Natal", "RN", 4.8], ["Recife", "PE", 6.1], ["Curitiba", "PR", 6.9]]));
    expect(extremos(h)).toEqual(["4,8 Natal (RN)", "6,9 Curitiba (PR)"]);
  });

  it("frase e gráfico citam as mesmas capitais, na mesma ordem, mesmo com empate acima do limite", () => {
    const base: [string, string, number][] = [["Cuiabá", "MT", 9], ["Belém", "PA", 9], ["Aracaju", "SE", 9], ["Vitória", "ES", 2]];
    const frase = fraseAmplitude(base.map(([nome, uf, valor]) => ({ nome, uf, valor })), { medida: "ideb", ano: 2025 });
    const grafico = extremos(html(pontos(base))).find((t) => t.startsWith("9,0"))!;
    const nomes = grafico.replace("9,0 ", "");
    expect(nomes).toBe("Aracaju (SE), Belém (PA) e mais 1");
    expect(frase).toContain(nomes);
  });

  it("todas as capitais empatadas: um rótulo só, com os nomes", () => {
    const h = html(pontos([["A", "AA", 3], ["B", "BB", 3]]));
    expect(extremos(h)).toEqual(["3,0 A (AA) e B (BB)"]);
  });

  it("lista de rótulos segue a regra da lista de nomes", () => {
    expect(listaRotulos(["A (AA)"])).toBe("A (AA)");
    expect(listaRotulos(["A (AA)", "B (BB)"])).toBe("A (AA) e B (BB)");
    expect(listaRotulos(["A (AA)", "B (BB)", "C (CC)"])).toBe("A (AA), B (BB) e mais 1");
  });

  it("lista vazia não gera figura", () => {
    expect(html([])).toBe("");
  });
});
