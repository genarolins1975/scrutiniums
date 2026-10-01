import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { montaHistograma, percentilDe } from "@/lib/energia/distribuicao";
import { Histograma, type HistogramaProps } from "@/components/energia/Histograma";

/**
 * Histograma no servidor: estrutura acessível, barra própria para a massa no
 * piso (explicada e na tabela), corte da barra que achataria as demais,
 * ausência declarada e classe com zero observações distinta de ausência.
 */

// 40 horas no piso, 12 espalhadas e 3 sem dado: a massa no piso é mais que o dobro de qualquer classe
const HORAS = [...Array(40).fill(58.6), 61, 64, 70, 88, 95, 120, 121, 150, 160, 160, 250, 251, null, null, undefined];

function props(extra: Partial<HistogramaProps> = {}): HistogramaProps {
  const dados = montaHistograma(HORAS, {
    largura: 50,
    massas: [{ valor: 58.6, rotulo: "piso regulatório", explicacao: "O PLD não pode ficar abaixo do piso definido pela ANEEL para o ano." }],
  });
  return {
    titulo: "Distribuição do PLD horário, SE/CO",
    dados,
    rotuloX: "PLD horário",
    unidade: "R$/MWh",
    casas: 2,
    contagem: { singular: "hora", plural: "horas" },
    periodo: "out/2025 a set/2026",
    valorAtual: { valor: 250, rotulo: "Hoje", percentil: percentilDe(250, HORAS) },
    ...extra,
  };
}

describe("histograma renderizado no servidor", () => {
  const html = renderToStaticMarkup(createElement(Histograma, props()));

  it("svg focável com título, descrição no rodapé, leitura em região viva e tabela equivalente", () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*tabindex="0"/);
    const tituloId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(html).toContain(`<title id="${tituloId}">`);
    expect(html).toContain('aria-live="polite"');
    const tabela = html.slice(html.indexOf("<table"));
    expect(tabela).toContain("<caption");
    expect(tabela).toMatch(/<th scope="col"[^>]*>Faixa \(R\$\/MWh\)<\/th>/);
  });

  it("massa no piso: barra própria hachurada, fora das classes, explicada e listada na tabela", () => {
    expect(html).toContain('data-massa="58.6"');
    expect(html).toMatch(/data-massa="58.6"><rect[^>]*fill="url\(#[^)]+-hachura\)"/);
    expect(html).toContain('data-explica-massa="58.6"');
    expect(html).toContain("O PLD não pode ficar abaixo do piso definido pela ANEEL para o ano.");
    expect(html).toContain("Exatamente 58,60 (piso regulatório; barra própria)");
    // 40 de 52 horas com valor: a primeira classe não recebe as horas do piso
    expect(html).toMatch(/50,00 a menos de 100,00<\/th><td[^>]*>5<\/td>/);
  });

  it("barra que achataria as demais é cortada e o corte é dito em texto", () => {
    expect(html).toContain("(barra cortada)");
    expect(html).toContain("A barra foi cortada no topo");
  });

  it("ausência declarada no rodapé; n conta só quem tem valor", () => {
    expect(html).toContain('data-sem-dado="3"');
    expect(html).toContain("n = 52");
    expect(html).toContain("sem dado, fora da distribuição");
  });

  it("classe sem observação é zero na tabela e não desenha barra", () => {
    // 150 a 200 tem 3 horas; 200 a 250 tem zero; 250 a 300 fecha à direita com 2
    expect(html).toMatch(/200,00 a menos de 250,00<\/th><td[^>]*>0<\/td>/);
    const desenhadas = html.match(/data-classe="(\d+)"/g) ?? [];
    const zeradas = props().dados.classes.filter((c) => c.contagem === 0).length;
    expect(desenhadas).toHaveLength(props().dados.classes.length - zeradas);
  });

  it("valor atual com percentil; sem valor atual vira 'sem dado' e não ganha marcador", () => {
    expect(html).toMatch(/Hoje: 250,00 R\$\/MWh<\/text>/);
    expect(html).toContain("percentil");
    const semAtual = renderToStaticMarkup(createElement(Histograma, props({ valorAtual: { valor: null, rotulo: "Hoje" } })));
    expect(semAtual).not.toMatch(/Hoje: /);
    expect(semAtual).toContain("sem dado (sem marcador no gráfico)");
  });

  it("quantis iguais (P10 a P75 no piso) viram uma única linha com rótulo conjunto", () => {
    expect(html).toMatch(/<text[^>]*>P10, P25, Mediana, P75<\/text>/);
    expect(html).not.toMatch(/<text[^>]*>P25<\/text>/);
  });

  it("controle da tabela tem alvo de 44 px", () => {
    expect(html).toMatch(/<summary[^>]*min-h-\[44px\]/);
  });
});
