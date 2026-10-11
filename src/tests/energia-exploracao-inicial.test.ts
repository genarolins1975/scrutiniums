import { describe, expect, it } from "vitest";
import { energiaConsumida } from "@/lib/energia/energia-consumida";

describe("laboratório dimensional da inicial de Energia", () => {
  it("converte W em kW antes de multiplicar por horas e dias", () => {
    expect(energiaConsumida(1500, 3, 30)).toBe(135);
    expect(energiaConsumida(1000, 1, 1)).toBe(1);
    expect(energiaConsumida(6000, 24, 31)).toBe(4464);
  });
  it("mantém proporcionalidade e zero físico", () => {
    expect(energiaConsumida(1500, 1.5, 30)).toBe(67.5);
    expect(energiaConsumida(1500, 0, 30)).toBe(0);
    expect(energiaConsumida(0, 24, 30)).toBe(0);
    expect(energiaConsumida(1500, 3, 0)).toBe(0);
  });
  it("não transforma entradas inválidas em consumo", () => {
    for (const entrada of [[NaN, 1, 1], [1000, Infinity, 1], [-1, 1, 1], [1000, 25, 1], [1000, -1, 1], [1000, 1, -1]]) {
      expect(energiaConsumida(...entrada as [number, number, number])).toBeNull();
    }
  });
});
