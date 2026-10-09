import { describe, expect, it } from "vitest";
import { encontraDatas, segmentosComDatas, textoComDatas } from "@/lib/texto-datas";

/**
 * Datas ISO embutidas em texto do pipeline: formatação sem mudar dia nem fuso, sem completar
 * partes que a fonte não trouxe e sem corrigir em silêncio o que o calendário não admite.
 */
describe("formatação em prosa", () => {
  it("competência mensal, data civil e instante, sem dia nem horário inventado", () => {
    expect(textoComDatas("competência 2026-06 e dia 2025-12-31 e instante 2026-09-30T00:00Z.")).toBe(
      "competência junho de 2026 e dia 31/12/2025 e instante 30/09/2026 às 00h00 UTC.",
    );
  });

  it("competência abreviada em espaço curto", () => {
    expect(textoComDatas("última: 2005-10 (encerrada)", { competencia: "curta" })).toBe("última: out/2005 (encerrada)");
  });

  it("frase que começa pela data fica com inicial maiúscula", () => {
    expect(textoComDatas("2026-06 foi revisto")).toBe("Junho de 2026 foi revisto");
  });

  it("UTC à meia-noite não desloca o dia; offset mantém o deslocamento", () => {
    expect(textoComDatas("2026-09-30T00:00Z")).toBe("30/09/2026 às 00h00 UTC");
    expect(textoComDatas("2026-09-29T21:00-03:00")).toBe("29/09/2026 às 21h00 (UTC−03:00)");
    expect(textoComDatas("2026-09-30T03:00+0530")).toBe("30/09/2026 às 03h00 (UTC+05:30)");
  });

  it("mantém a precisão do instante, segundos incluídos", () => {
    expect(textoComDatas("busca de 2026-10-01T06:40:21Z, 0 PDFs")).toBe("busca de 01/10/2026 às 06h40min21s UTC, 0 PDFs");
    expect(textoComDatas("captura 2026-10-08T13:09:45.572Z.")).toBe("captura 08/10/2026 às 13h09min45s UTC.");
  });

  it("horário sem fuso: declara a ausência, ou usa só a convenção informada pelo chamador", () => {
    expect(textoComDatas("S em 2018-11-04 00:00, texto da fonte")).toBe("S em 04/11/2018 às 00h00 (fuso não informado), texto da fonte");
    expect(textoComDatas("até 2026-09-28T23:00;", { fusoSemOffset: "Brasília" })).toBe("até 28/09/2026 às 23h00 (Brasília);");
  });

  it("intervalo de meses e data junto de pontuação mantêm os limites da frase", () => {
    expect(textoComDatas("de 2015-09 a 2016-01; depois (2024-09-27), em 2026-06.")).toBe(
      "de setembro de 2015 a janeiro de 2016; depois (27/09/2024), em junho de 2026.",
    );
    expect(textoComDatas("período: 2000-01-01 a 2026-09-29 ; última captura")).toBe("período: 01/01/2000 a 29/09/2026 ; última captura");
  });

  it("segmentos preservam o valor original para o atributo datetime", () => {
    const seg = segmentosComDatas("emitida em 2026-09-30T00:00Z (modelo)");
    expect(seg).toHaveLength(3);
    expect(seg[0]).toBe("emitida em ");
    expect(seg[1]).toMatchObject({ tipo: "data", iso: "2026-09-30T00:00Z", texto: "30/09/2026 às 00h00 UTC" });
    expect(seg[2]).toBe(" (modelo)");
  });
});

describe("precedência e contagem", () => {
  it("cada expressão é contada uma única vez, pela forma completa", () => {
    const o = encontraDatas("a 2026-09-30T00:00Z b 2026-09-30 c 2026-09 d");
    expect(o.map((x) => [x.tipo, x.bruto])).toEqual([
      ["instante", "2026-09-30T00:00Z"],
      ["data", "2026-09-30"],
      ["competencia", "2026-09"],
    ]);
  });

  it("instante não é contado de novo como data nem como competência", () => {
    expect(encontraDatas("2026-09-30T00:00Z")).toHaveLength(1);
    expect(encontraDatas("2026-09-30")).toHaveLength(1);
  });
});

describe("calendário e relógio validados", () => {
  it("data inexistente e horário inválido não são corrigidos em silêncio", () => {
    for (const t of ["2021-02-29", "2025-02-30", "2026-04-31", "2026-13-01", "2026-13", "2026-09-30T25:00Z", "2026-09-30T10:61Z", "2026-09-30T10:00:75Z"]) {
      expect(textoComDatas(t), t).toBe(t);
      const seg = segmentosComDatas(t);
      expect(seg, t).toHaveLength(1);
      expect(seg[0], t).toMatchObject({ tipo: "invalida", bruto: t });
    }
  });

  it("ano bissexto: 29/02 existe em 2024 e não em 2021", () => {
    expect(textoComDatas("2024-02-29")).toBe("29/02/2024");
    expect(encontraDatas("2021-02-29")[0]).toMatchObject({ valida: false, motivo: "dia 29 inexistente em 02/2021" });
  });

  it("data distante válida no calendário continua formatável; julgar a cronologia é papel da página", () => {
    expect(encontraDatas("3036-03-13")[0]).toMatchObject({ valida: true, tipo: "data" });
    expect(textoComDatas("fim (3036-03-13) posterior")).toBe("fim (13/03/3036) posterior");
  });
});

describe("conteúdo técnico intacto", () => {
  it("URL, nome de arquivo, identificador e e-mail não são tocados", () => {
    for (const t of [
      "https://dadosabertos.aneel.gov.br/x/2024-04-01.csv",
      "arquivo dados_2026-09-30.csv",
      "Despacho_2025-02-29.xlsx",
      "ref@2026-09-30",
      "/series/2026-09-30/x",
      "id-2026-09-30",
      "v1.2026-09",
      "2026-09-30.json",
    ]) {
      expect(textoComDatas(t), t).toBe(t);
      expect(encontraDatas(t), t).toHaveLength(0);
    }
  });

  it("texto sem data fica igual", () => {
    expect(segmentosComDatas("sem datas aqui")).toEqual(["sem datas aqui"]);
    expect(textoComDatas("")).toBe("");
  });
});
