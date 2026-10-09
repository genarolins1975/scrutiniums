import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoBarras, type GraficoBarrasProps } from "@/components/energia/GraficoBarras";

/**
 * GraficoBarras renderizado no servidor (o HTML que chega antes do
 * JavaScript): estrutura acessível (grupo rotulado, um alvo de foco por
 * categoria com tabindex itinerante, seleção com aria-pressed, região
 * aria-live, tabela equivalente) e as regras de honestidade: ausência é marca
 * "sem dado" e não barra zero, zero é traço na base, pilha incompleta não
 * exibe total, referência entra no domínio.
 */
const html = (p: GraficoBarrasProps) => renderToStaticMarkup(createElement(GraficoBarras, p));

/** Conteúdo do <g> de uma categoria (os <g> de categoria não têm <g> aninhado). */
function categoria(markup: string, id: string): { abertura: string; corpo: string } {
  const m = markup.match(new RegExp(`(<g[^>]*data-id="${id}"[^>]*>)([\\s\\S]*?)</g>`));
  if (!m) throw new Error(`categoria ${id} não encontrada`);
  return { abertura: m[1], corpo: m[2] };
}

const base: GraficoBarrasProps = {
  titulo: "Perdas por distribuidora",
  dados: [
    { id: "A", nome: "Alfa Energia", v: 10 },
    { id: "B", nome: "Beta Luz", v: null },
    { id: "C", nome: "Gama", v: 0 },
    { id: "D", nome: "Delta", v: -4 },
  ],
  chaveCategoria: "id",
  chaveRotulo: "nome",
  series: [{ id: "v", rotulo: "Perda", cor: "var(--serie-1)" }],
  unidade: "GWh",
};

describe("GraficoBarras no servidor", () => {
  const selecionavel = html({ ...base, selecionado: "A", onSelecionar: () => {} });

  it("é um grupo rotulado pelo título e descrito pelas instruções de teclado", () => {
    const svg = selecionavel.match(/<svg[^>]*role="group"[^>]*>/)?.[0] ?? "";
    const rot = svg.match(/aria-labelledby="([^"]+)"/)?.[1];
    const desc = svg.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(rot && desc).toBeTruthy();
    expect(selecionavel).toContain(`<title id="${rot}">Perdas por distribuidora</title>`);
    expect(selecionavel).toMatch(new RegExp(`id="${desc}"[^>]*>[^<]*setas[^<]*Enter ou Espaço para selecionar`));
  });

  it("um alvo por categoria, com tabindex itinerante começando na selecionada", () => {
    const alvos = Array.from(selecionavel.matchAll(/<g[^>]*role="button"[^>]*>/g)).map((m) => m[0]);
    expect(alvos).toHaveLength(4);
    const zeros = alvos.filter((a) => a.includes('tabindex="0"'));
    expect(zeros).toHaveLength(1);
    expect(zeros[0]).toContain('data-id="A"');
    expect(alvos.filter((a) => a.includes('tabindex="-1"'))).toHaveLength(3);
    expect(alvos.filter((a) => a.includes('aria-pressed="true"'))).toHaveLength(1);
    expect(categoria(selecionavel, "A").abertura).toContain('aria-pressed="true"');
    expect(selecionavel).toContain('data-selecionada="A"');
  });

  it("sem onSelecionar não há botão nem aria-pressed", () => {
    const leitura = html(base);
    expect(leitura).not.toContain('role="button"');
    expect(leitura).not.toContain("aria-pressed");
    expect(Array.from(leitura.matchAll(/<g[^>]*role="img"[^>]*data-id=/g))).toHaveLength(4);
  });

  it("ausência vira marca 'sem dado', nunca barra de zero", () => {
    const b = categoria(selecionavel, "B");
    expect(b.abertura).toContain('aria-label="Beta Luz: sem dado"');
    expect(b.corpo).toContain('data-estado="sem-dado"');
    expect(b.corpo).not.toContain('data-serie="v"');
    // a legenda explica a hachura
    expect(selecionavel).toContain('data-legenda="sem-dado"');
  });

  it("zero é dado: traço na base, distinto da ausência", () => {
    const c = categoria(selecionavel, "C");
    expect(c.corpo).toContain('data-estado="zero"');
    expect(c.corpo).not.toContain("sem-dado");
    expect(c.abertura).toContain("Gama: 0,0 GWh");
  });

  it("negativo tem barra e o eixo desce abaixo de zero com sinal tipográfico", () => {
    expect(categoria(selecionavel, "D").corpo).toMatch(/<path[^>]*data-serie="v"/);
    expect(selecionavel).toContain(">−5</text>");
    expect(selecionavel).toContain(">0</text>");
  });

  it("tabela equivalente já no HTML, com os mesmos números e 'sem dado'", () => {
    expect(selecionavel).toContain("<caption");
    expect(selecionavel).toContain("Perdas por distribuidora, em GWh");
    expect(Array.from(selecionavel.matchAll(/<th scope="row"/g))).toHaveLength(4);
    const linhaB = selecionavel.match(/<tr[^>]*data-id="B"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(linhaB).toContain(">sem dado</td>");
    const linhaD = selecionavel.match(/<tr[^>]*data-id="D"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(linhaD).toContain(">−4,0</td>");
    expect(selecionavel).toContain("(selecionada)");
    expect(selecionavel).toMatch(/<summary[^>]*min-h-\[44px\]/);
  });

  it("tem região aria-live e nenhum hexadecimal solto no HTML", () => {
    expect(selecionavel).toContain('aria-live="polite"');
    expect(selecionavel).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });

  it("linha de referência entra no domínio e aparece na legenda com valor", () => {
    const r = html({ ...base, dados: [{ id: "A", v: 3 }, { id: "B", v: 5 }], referencias: [{ valor: 12, rotulo: "Limite regulatório" }] });
    expect(r).toContain('data-referencia="Limite regulatório"');
    expect(r).toContain("Limite regulatório: 12,0 GWh");
    // sem a referência o eixo pararia em 5; com ela, precisa passar de 12
    expect(r).toContain(">15</text>");
  });
});

describe("GraficoBarras empilhado e horizontal", () => {
  const empilhado: GraficoBarrasProps = {
    titulo: "Composição das perdas",
    dados: [
      { id: "X", tecnica: 3, naoTecnica: 2 },
      { id: "Y", tecnica: 4, naoTecnica: null },
    ],
    chaveCategoria: "id",
    series: [
      { id: "tecnica", rotulo: "Técnica", cor: "var(--serie-1)" },
      { id: "naoTecnica", rotulo: "Não técnica", cor: "var(--serie-3)" },
    ],
    unidade: "GWh",
    empilhado: true,
    orientacao: "horizontal",
    rotulosValor: true,
  };
  const m = html(empilhado);

  it("pilha completa mostra o total; incompleta marca a ausência e não inventa total", () => {
    const x = categoria(m, "X");
    expect(x.abertura).toContain("total 5,0 GWh");
    expect(x.corpo).toContain(">5,0</text>");
    const y = categoria(m, "Y");
    expect(y.corpo).toContain('data-estado="sem-dado"');
    expect(y.corpo).toContain('data-partes="1"');
    expect(y.corpo).toMatch(/<path[^>]*data-serie="tecnica"/);
    expect(y.corpo).not.toMatch(/data-serie="naoTecnica"/);
    expect(y.abertura).toContain("total incompleto");
    const linhaY = m.match(/<tr[^>]*data-id="Y"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(linhaY).toContain(">incompleto</td>");
    expect(linhaY).toContain(">sem dado</td>");
  });

  it("legenda lista as partes da composição", () => {
    const legenda = m.match(/<ul[^>]*aria-label="Legenda"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? "";
    expect(legenda).toContain("Técnica");
    expect(legenda).toContain("Não técnica");
  });

  it("muitas categorias: altura por categoria fixa e rolagem vertical com altura máxima", () => {
    const dados = Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, tecnica: i + 1, naoTecnica: 1 }));
    const muitas = html({ ...empilhado, dados, alturaCategoria: 44, alturaMaxima: 480 });
    expect(muitas).toContain('data-rolagem="sim"');
    expect(muitas).toContain("max-height:480px");
    expect(muitas).toMatch(/<svg[^>]*height="1320"[^>]*role="group"/);
    expect(Array.from(muitas.matchAll(/<g[^>]*role="img"[^>]*data-id=/g))).toHaveLength(30);
  });

  it("poucas categorias no horizontal não criam rolagem", () => {
    expect(m).toContain('data-rolagem="nao"');
  });
});

describe("GraficoBarras: limite inicial, série opcional e linhas ao largo dos textos", () => {
  const ranking = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `d${i}`, nome: `Distribuidora ${i + 1}`, v: (i + 1) * 10 }));
  const horizontal: GraficoBarrasProps = {
    titulo: "Ranking",
    dados: ranking(30),
    chaveCategoria: "id",
    chaveRotulo: "nome",
    series: [{ id: "v", rotulo: "Custo", cor: "var(--serie-1)" }],
    unidade: "R$",
    orientacao: "horizontal",
    rotulosValor: true,
  };

  it("com limiteInicial desenha só as primeiras, mantém a escala do conjunto e a tabela inteira, e oferece 'Mostrar todas'", () => {
    const m = html({ ...horizontal, limiteInicial: 12 });
    expect(m).toContain('data-parcial="sim"');
    expect(Array.from(m.matchAll(/<g[^>]*role="img"[^>]*data-id=/g))).toHaveLength(12);
    expect(m).toContain("O gráfico mostra as 12 primeiras das 30 categorias, na ordem escolhida.");
    expect(m).toContain("Mostrar todas as 30");
    // a tabela do gráfico traz as 30 linhas, e a escala vai até o maior valor do conjunto (300), não do que está desenhado (120)
    expect(Array.from(m.matchAll(/<th scope="row"/g))).toHaveLength(30);
    expect(m).toContain("Dados do gráfico em tabela (30 linhas)");
    expect(m).toMatch(/>300<\/text>|>350<\/text>/);
    expect(m).toContain("as primeiras 12 desenhadas");
  });

  it("categoria selecionada depois do limite: o gráfico desenha todas, diz por quê e não oferece botão que não faria nada", () => {
    const m = html({ ...horizontal, limiteInicial: 12, selecionado: "d20", onSelecionar: () => {} });
    expect(Array.from(m.matchAll(/<g[^>]*role="button"[^>]*data-id=/g))).toHaveLength(30);
    expect(m).toContain("Todas as 30 categorias, porque a escolhida está depois das primeiras 12.");
    expect(m).not.toContain("Mostrar todas as 30");
    expect(m).not.toContain("Mostrar só o início");
  });

  it("sem limiteInicial ou com menos categorias que o limite, nada muda", () => {
    expect(html({ ...horizontal, dados: ranking(8), limiteInicial: 12 })).not.toContain("data-parcial");
    expect(html({ ...horizontal, limiteInicial: undefined, alturaMaxima: 5000 })).not.toContain("data-parcial");
  });

  it("série opcional: o nulo é 'não se aplica', sem hachura, sem 'incompleto' e sem linha na dica", () => {
    const m = html({
      titulo: "Cortes por ano",
      dados: [
        { id: "2024", completo: 5, parcial: null },
        { id: "2025", completo: null, parcial: 2 },
      ],
      chaveCategoria: "id",
      series: [
        { id: "completo", rotulo: "Ano completo", cor: "var(--serie-1)" },
        { id: "parcial", rotulo: "Ano parcial", cor: "var(--serie-3)", opcional: true },
      ],
      unidade: "GWh",
      empilhado: true,
      orientacao: "horizontal",
    });
    // 2024: a parte opcional ausente não torna a pilha incompleta e não entra no texto lido
    const a = categoria(m, "2024");
    expect(a.abertura).toContain("total 5,0\u00a0GWh");
    expect(a.abertura).not.toContain("Ano parcial");
    expect(a.corpo).not.toContain('data-estado="sem-dado"');
    // 2025: a parte obrigatória ausente continua sendo lacuna
    const b = categoria(m, "2025");
    expect(b.corpo).toContain('data-estado="sem-dado"');
    expect(b.abertura).toContain("total incompleto");
    const linha24 = m.match(/<tr[^>]*data-id="2024"[^>]*>([\s\S]*?)<\/tr>/)?.[1] ?? "";
    expect(linha24).toContain(">não se aplica</td>");
    expect(linha24).not.toContain(">sem dado</td>");
  });

  it("a linha de referência passa ao largo do rótulo de valor que cruzaria (o caminho tem uma quebra)", () => {
    const m = html({
      titulo: "Contra o limite",
      dados: [{ id: "A", v: 10 }],
      chaveCategoria: "id",
      series: [{ id: "v", rotulo: "Valor", cor: "var(--serie-1)" }],
      unidade: "GWh",
      orientacao: "horizontal",
      rotulosValor: true,
      referencias: [{ valor: 10.3, rotulo: "Limite" }],
    });
    const d = m.match(/<g[^>]*data-referencia="Limite"[^>]*><path d="([^"]+)"/)?.[1] ?? "";
    expect(d.match(/M/g)?.length).toBeGreaterThanOrEqual(2);
    // sem rótulo de valor a linha é um traço só
    const semValor = html({
      titulo: "Contra o limite",
      dados: [{ id: "A", v: 10 }],
      chaveCategoria: "id",
      series: [{ id: "v", rotulo: "Valor", cor: "var(--serie-1)" }],
      unidade: "GWh",
      orientacao: "horizontal",
      referencias: [{ valor: 10.3, rotulo: "Limite" }],
    });
    expect((semValor.match(/<g[^>]*data-referencia="Limite"[^>]*><path d="([^"]+)"/)?.[1] ?? "").match(/M/g)).toHaveLength(1);
  });
});
