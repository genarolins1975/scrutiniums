import { describe, expect, it } from "vitest";
import { legendaDeSiglas, siglasNoTexto, SIGLAS } from "@/lib/energia/siglas";

/**
 * Legenda de siglas no cabeçalho de cada página (rodada r5): o nome por extenso das siglas que o leitor encontra sem
 * explicação. Só entram siglas da lista conferida; o texto que já traz o nome por extenso não repete a legenda.
 */
describe("legendaDeSiglas", () => {
  it("junta DEC e FEC, e TE e TUSD, em uma entrada", () => {
    expect(legendaDeSiglas(["DEC", "FEC", "PLD"])).toBe(
      "DEC e FEC, Duração e Frequência Equivalentes de Interrupção por Unidade Consumidora; PLD, Preço de Liquidação das Diferenças",
    );
    expect(legendaDeSiglas(["TE", "TUSD"])).toBe("TE e TUSD, Tarifa de Energia e Tarifa de Uso do Sistema de Distribuição");
  });

  it("sigla sozinha de um par mantém a própria entrada; desconhecida sai", () => {
    expect(legendaDeSiglas(["DEC"])).toBe(`DEC, ${SIGLAS.DEC}`);
    expect(legendaDeSiglas(["XYZ"])).toBe("");
    expect(legendaDeSiglas([])).toBe("");
  });
});

describe("siglasNoTexto", () => {
  it("acha a sigla como palavra inteira, na ordem da primeira aparição", () => {
    expect(siglasNoTexto("O PLD sobe quando a ENA cai; veja o CMO.")).toEqual(["PLD", "ENA", "CMO"]);
  });

  it("não confunde sigla com trecho de outra palavra", () => {
    expect(siglasNoTexto("A TERMOELÉTRICA e o TESTE não são TE.")).toEqual(["TE"]);
  });

  it("não repete a sigla que o texto já expande", () => {
    expect(siglasNoTexto("Preço de Liquidação das Diferenças (PLD) e ENA.")).toEqual(["ENA"]);
  });
});
