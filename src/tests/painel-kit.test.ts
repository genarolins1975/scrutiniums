import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoPontos } from "@/components/painel/GraficoPontos";
import { textoDoNo } from "@/components/painel/TabelaDados";

/**
 * Adaptadores do kit de painel (Iniciativa 1 do parecer de UX de 23/10/2026) que convertem a forma comum para a forma de cada peça:
 * nenhuma conversão pode sumir com uma entidade nem transformar dado em ausência (achados da revisão automática do PR 364).
 */

describe("GraficoPontos no contrato único", () => {
  const html = renderToStaticMarkup(
    createElement(GraficoPontos, {
      titulo: "Teste",
      series: [
        { id: "valor", nome: "Valor", pontos: [{ x: "a", y: 1, rotulo: "Entidade A" }] },
        { id: "ref", nome: "Referência", pontos: [{ x: "a", y: 2 }, { x: "b", y: 3, rotulo: "Entidade B" }] },
      ],
      eixoY: { unidade: "h", casas: 1 },
    }),
  );

  it("a entidade que só está na referência aparece, sem valor, e não some", () => {
    expect(html).toContain("Entidade B");
  });

  it("o nome exibido é o rótulo do ponto, não o x técnico", () => {
    expect(html).toContain("Entidade A");
  });
});

describe("TabelaDados ordenável: célula em nó React", () => {
  it("vira o texto que mostra, nunca ausência", () => {
    expect(textoDoNo(createElement("span", null, "CEMIG", createElement("abbr", null, "-D")))).toBe("CEMIG-D");
    expect(textoDoNo(["R$ ", 12])).toBe("R$ 12");
    expect(textoDoNo(null)).toBe("");
  });
});

describe("TabelaDados: link por célula", () => {
  it("a célula com endereço aponta para a página da linha, inclusive quando a tabela mostra só as últimas linhas", async () => {
    const { TabelaDados } = await import("@/components/painel/TabelaDados");
    const html = renderToStaticMarkup(
      createElement(TabelaDados, {
        titulo: "Teste",
        colunas: ["Município", "Valor"],
        linhas: [["Arapiraca", 1], ["Maceió", 2], ["Penedo", null]],
        links: { Município: ["/a", "/m", null] },
        limite: 2,
        recolhida: false,
      }),
    );
    expect(html).toMatch(/<a [^>]*href="\/m"[^>]*>Maceió<\/a>/);
    expect(html).not.toContain('href="/a"');
    expect(html).toContain("Penedo");
    expect(html).not.toMatch(/<a [^>]*>Penedo/);
  });
});
