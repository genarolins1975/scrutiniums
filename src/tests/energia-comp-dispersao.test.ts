import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  afastaRotulos,
  limitaDestaques,
  maisProximo,
  ordenaParaTabela,
  segmentoReta,
  separaPontos,
  type PontoDispersao,
} from "@/lib/energia/dispersao";
import { GraficoDispersao, type GraficoDispersaoProps } from "@/components/energia/GraficoDispersao";

/**
 * Dispersão: ponto sem X ou Y nunca é desenhado (nem em zero), a ordem do
 * teclado e da tabela é X crescente com ausências ao fim, a reta do pipeline
 * não é extrapolada e o rodapé obrigatório (n, período, aviso) chega ao HTML.
 */

const PONTOS: PontoDispersao[] = [
  { id: "c", rotulo: "Coelba", x: 12.5, y: 700 },
  { id: "a", rotulo: "Amazonas", x: 30, y: 820 },
  { id: "l", rotulo: "Light", x: 12.5, y: 650 },
  { id: "z", rotulo: "Zero Energia", x: 0, y: 0 },
  { id: "s", rotulo: "Sem X", x: null, y: 500 },
  { id: "n", rotulo: "NaN Y", x: 5, y: Number.NaN },
  { id: "u", rotulo: "Undefined", x: undefined, y: undefined },
];

describe("separação e ordem", () => {
  it("pontos sem X ou Y (null, undefined, NaN) vão para sem dado; zero é ponto válido", () => {
    const { validos, semDado } = separaPontos(PONTOS);
    expect(validos.map((p) => p.id)).toEqual(["z", "l", "c", "a"]);
    expect(semDado.map((p) => p.id).sort()).toEqual(["n", "s", "u"]);
  });

  it("empate em X desempata por Y e depois por nome", () => {
    const { validos } = separaPontos(PONTOS);
    expect(validos.slice(1, 3).map((p) => p.rotulo)).toEqual(["Light", "Coelba"]);
  });

  it("tabela: X crescente e ausências sempre ao fim, mesmo com Y presente", () => {
    const t = ordenaParaTabela(PONTOS);
    expect(t.slice(0, 4).map((p) => p.id)).toEqual(["z", "l", "c", "a"]);
    // "NaN Y" tem X e fica antes dos que não têm X; "Sem X" (Y presente) antes de "Undefined"
    expect(t.slice(4).map((p) => p.id)).toEqual(["n", "s", "u"]);
  });

  it("destaques: sem repetição e no máximo quatro", () => {
    expect(limitaDestaques(["a", "b", "a", "c", "d", "e"])).toEqual(["a", "b", "c", "d"]);
    expect(limitaDestaques(undefined)).toEqual([]);
  });
});

describe("reta do pipeline", () => {
  const reta = { inclinacao: 2, intercepto: 10 };

  it("fica no intervalo de X observado (não extrapola)", () => {
    expect(segmentoReta(reta, [0, 10], [0, 100])).toEqual({ x0: 0, y0: 10, x1: 10, y1: 30 });
  });

  it("é recortada ao domínio de Y do gráfico", () => {
    const s = segmentoReta(reta, [0, 100], [0, 50]);
    expect(s).toEqual({ x0: 0, y0: 10, x1: 20, y1: 50 });
    const neg = segmentoReta({ inclinacao: -1, intercepto: 100 }, [0, 100], [20, 80]);
    expect(neg).toEqual({ x0: 20, y0: 80, x1: 80, y1: 20 });
  });

  it("some quando não cruza a área ou os coeficientes não são finitos", () => {
    expect(segmentoReta(reta, [0, 10], [100, 200])).toBeNull();
    expect(segmentoReta({ inclinacao: 0, intercepto: 300 }, [0, 10], [0, 100])).toBeNull();
    expect(segmentoReta({ inclinacao: 0, intercepto: 30 }, [0, 10], [0, 100])).toEqual({ x0: 0, y0: 30, x1: 10, y1: 30 });
    expect(segmentoReta({ inclinacao: Number.NaN, intercepto: 1 }, [0, 10], [0, 100])).toBeNull();
  });
});

describe("leitura por ponteiro e rótulos", () => {
  it("mais próximo dentro do raio; fora do raio, nenhum", () => {
    const alvos = [
      { x: 100, y: 100 },
      { x: 110, y: 100 },
    ];
    expect(maisProximo(alvos, 108, 101, 22)).toBe(1);
    expect(maisProximo(alvos, 200, 200, 22)).toBeNull();
  });

  it("afasta rótulos, preserva a ordem vertical e respeita topo e base", () => {
    const ys = afastaRotulos([50, 52, 48, 290], 13, 20, 300);
    const ordenados = [...ys].sort((a, b) => a - b);
    for (let k = 1; k < ordenados.length; k++) expect(ordenados[k] - ordenados[k - 1]).toBeGreaterThanOrEqual(13);
    // 48 continua acima de 50, que continua acima de 52
    expect(ys[2]).toBeLessThan(ys[0]);
    expect(ys[0]).toBeLessThan(ys[1]);
    const noFundo = afastaRotulos([299, 299, 299], 13, 20, 300);
    expect(Math.max(...noFundo)).toBeLessThanOrEqual(300);
  });
});

describe("renderização no servidor", () => {
  const base: GraficoDispersaoProps = {
    titulo: "Perdas e tarifa por distribuidora",
    pontos: PONTOS,
    eixoX: { rotulo: "Perdas não técnicas", unidade: "% do mercado BT", casas: 1 },
    eixoY: { rotulo: "Tarifa média", unidade: "R$/MWh", casas: 0 },
    rodape: { periodo: "2024", avisoCausalidade: "Associação não é causalidade: a relação pode refletir outros fatores." },
    entidade: { singular: "distribuidora", plural: "distribuidoras" },
    destacados: ["a", "s", "c", "l", "z", "extra"],
  };
  const html = renderToStaticMarkup(createElement(GraficoDispersao, base));

  it("svg focável com nome acessível, descrição no rodapé e região de leitura", () => {
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*tabindex="0"/);
    const tituloId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(tituloId && html.includes(`<title id="${tituloId}">`)).toBe(true);
    const rodapeId = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(rodapeId).toBeTruthy();
    const rodape = html.slice(html.indexOf(`id="${rodapeId}"`));
    expect(rodape).toContain("Associação não é causalidade");
    expect(rodape).toContain("2024");
    expect(html).toContain('aria-live="polite"');
  });

  it("só pontos com X e Y são desenhados; os três sem dado vão ao rodapé e à tabela", () => {
    expect(html.match(/data-ponto=/g)).toHaveLength(4);
    expect(html).not.toContain('data-ponto="s"');
    expect(html).toContain('data-sem-dado="3"');
    expect(html).toContain("n = 4");
    const tabela = html.slice(html.indexOf("<table"));
    expect(tabela).toContain("<caption");
    expect(tabela.match(/scope="col"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(tabela.match(/scope="row"/g)).toHaveLength(7);
    expect(tabela.match(/sem dado/g)?.length).toBeGreaterThanOrEqual(4);
    // zero é valor, não ausência
    expect(tabela).toMatch(/Zero Energia<\/th><td[^>]*>0,0<\/td><td[^>]*>0<\/td>/);
  });

  it("destaque limitado a quatro, com rótulo direto, e destaque sem dado declarado no rodapé", () => {
    expect(html.match(/data-destaque="true"/g)).toHaveLength(3);
    expect(html).toContain("Destaque sem dado (não desenhado): Sem X.");
    expect(html).not.toContain('data-ponto="extra"');
    expect(html).toMatch(/<text[^>]*>Amazonas<\/text>/);
  });

  it("sem reta por padrão; com reta do pipeline, linha e rótulo aparecem", () => {
    expect(html).not.toContain("mínimos quadrados");
    const comReta = renderToStaticMarkup(
      createElement(GraficoDispersao, { ...base, reta: { inclinacao: 5, intercepto: 600, rotulo: "Reta de mínimos quadrados", detalhe: "R² = 0,40" } }),
    );
    expect(comReta).toMatch(/<text[^>]*>Reta de mínimos quadrados<\/text>/);
    expect(comReta).toContain("R² = 0,40");
  });

  it("controle da tabela tem alvo de 44 px", () => {
    expect(html).toMatch(/<summary[^>]*min-h-\[44px\]/);
  });
});
