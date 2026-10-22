import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { linhasGraficoRodadas } from "@/lib/energia/previsoes";

/**
 * O gráfico de rodadas do PLD (Previsões, arquivo) tem de mostrar os mesmos números nos dois idiomas com qualquer quantidade de
 * rodadas que o arquivo guarda (até 14). Com a data inteira no eixo, de 9 a 11 rodadas o rótulo inglês ("Oct 10, 20…") era cortado
 * em outro lugar que o português ("10/10/2026"), e a prova bilíngue do HTML (energia-i18n-html) acusava números diferentes.
 */
const MESES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const rodadas = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    origem: new Date(Date.UTC(2026, 9, 8 + i)).toISOString().slice(0, 10),
    com_numero: 10 + i,
    sem_numero: 2,
    atraso_min: 0,
  }));

/** Textos do SVG (eixo e valores), com o mês inglês trocado pelo número dele, como a prova bilíngue faz. */
function numeros(html: string): string {
  const t = Array.from(html.matchAll(/<text[^>]*>([^<]*)<\/text>/g), (m) => m[1]).join(" ");
  const comMeses = MESES.reduce((acc, m, i) => acc.replace(new RegExp(`\\b${m}\\b`, "g"), ` ${i + 1} `), t);
  return (comMeses.match(/\d+/g) ?? []).map(Number).sort((a, b) => a - b).join(",");
}

function grafico(n: number, idioma: "pt" | "en"): string {
  return renderToStaticMarkup(
    createElement(GraficoBarras as never, {
      titulo: "Células por rodada",
      dados: linhasGraficoRodadas(rodadas(n) as never, idioma),
      chaveCategoria: "id",
      chaveRotulo: "rotulo",
      series: [
        { id: "com_numero", rotulo: "com número", cor: "red" },
        { id: "sem_numero", rotulo: "sem número", cor: "blue" },
      ],
      unidade: "células",
      casas: 0,
      empilhado: true,
      rotulosValor: true,
    } as never),
  );
}

describe("gráfico de rodadas: rótulos do eixo nos dois idiomas", () => {
  it.each([1, 2, 6, 9, 10, 11, 12, 14])("%i rodadas: os mesmos números, sem rótulo cortado", (n) => {
    const pt = grafico(n, "pt");
    const en = grafico(n, "en");
    expect(numeros(en)).toBe(numeros(pt));
    expect(pt).not.toContain("…");
    expect(en).not.toContain("…");
  });

  it("o rótulo é o dia e o mês da rodada", () => {
    expect(linhasGraficoRodadas(rodadas(1) as never, "pt")[0].rotulo).toBe("08/10");
    expect(linhasGraficoRodadas(rodadas(1) as never, "en")[0].rotulo).toBe("Oct 8");
  });
});
