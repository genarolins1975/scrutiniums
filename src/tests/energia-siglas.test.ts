import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NATUREZAS, SeloNatureza } from "@/components/evidencia/SeloNatureza";
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

/**
 * Natureza do dado em texto (rodada 2): a dica do selo (`title`) não aparece no toque nem para leitor de tela. O selo carrega a natureza
 * em `data-natureza` e a legenda do cabeçalho, depois da hidratação, escreve a definição de cada natureza que está à vista.
 */
describe("legenda das naturezas do dado", () => {
  it("o selo, completo ou em texto, leva a natureza em data-natureza", () => {
    for (const n of Object.keys(NATUREZAS) as (keyof typeof NATUREZAS)[]) {
      expect(renderToStaticMarkup(createElement(SeloNatureza, { natureza: n }))).toContain(`data-natureza="${n}"`);
      expect(renderToStaticMarkup(createElement(SeloNatureza, { natureza: n, texto: true }))).toContain(`data-natureza="${n}"`);
    }
  });

  it("toda natureza tem definição em uma frase, sem hífen nem travessão", () => {
    for (const n of Object.values(NATUREZAS)) {
      expect(n.definicao.length).toBeGreaterThan(20);
      expect(n.definicao).not.toMatch(/[-–—]/);
    }
  });

  it("a legenda só lista o selo que está à vista: ignora elemento escondido e bloco fechado", () => {
    const fonte = readFileSync("src/components/energia/LegendaSiglas.tsx", "utf8");
    expect(fonte).toContain('querySelectorAll<HTMLElement>("[data-natureza]")');
    expect(fonte).toContain("estaVisivel(el, raiz)");
    expect(fonte).toContain('n.tagName === "DETAILS" && !n.hasAttribute("open")');
    expect(fonte).toContain('data-legenda-naturezas="true"');
  });
});
