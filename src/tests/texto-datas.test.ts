import { describe, expect, it } from "vitest";
import { segmentosComDatas, textoComDatas } from "@/lib/texto-datas";

/**
 * Datas ISO que chegam embutidas em texto do pipeline (limitações da proveniência) não podem
 * aparecer cruas ao leitor, nem mudar de dia por conversão de fuso.
 */
describe("datas embutidas em texto do pipeline", () => {
  it("instante UTC mantém dia e fuso de referência", () => {
    expect(textoComDatas("PREVISÃO emitida em 2026-09-30T00:00Z (inicialização do modelo): não é observação.")).toBe(
      "PREVISÃO emitida em 30/09/2026 às 00h00 UTC (inicialização do modelo): não é observação.",
    );
  });

  it("instante UTC com segundos e fração", () => {
    expect(textoComDatas("captura 2026-10-08T13:09:45.572Z.")).toBe("captura 08/10/2026 às 13h09 UTC.");
  });

  it("instante sem fuso segue a convenção do domínio (Brasília)", () => {
    expect(textoComDatas("referência 2026-10-08T07:30 fechada")).toBe("referência 08/10/2026 às 07h30 (Brasília) fechada");
  });

  it("data civil não ganha horário nem fuso", () => {
    expect(textoComDatas("dia de referência 2026-09-30.")).toBe("dia de referência 30/09/2026.");
  });

  it("preserva o valor original para o atributo datetime", () => {
    const seg = segmentosComDatas("emitida em 2026-09-30T00:00Z (modelo)");
    expect(seg).toEqual(["emitida em ", { iso: "2026-09-30T00:00Z", texto: "30/09/2026 às 00h00 UTC" }, " (modelo)"]);
  });

  it("não toca identificadores, caminhos nem datas inválidas", () => {
    for (const t of ["arquivo dados_2026-09-30.csv", "ref@2026-09-30", "/series/2026-09-30/x", "mês 2026-13-45", "versão 2026-09-30T25:00Z"]) {
      expect(textoComDatas(t)).toBe(t);
    }
  });

  it("texto sem data fica igual", () => {
    expect(segmentosComDatas("sem datas aqui")).toEqual(["sem datas aqui"]);
    expect(textoComDatas("")).toBe("");
  });
});
