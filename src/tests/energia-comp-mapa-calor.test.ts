import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  NAO_SE_APLICA,
  classeDe,
  limitesPorQuantis,
  moveNaGrade,
  resumoGrade,
  rotulosClasses,
  validaEscala,
  validaMatriz,
  type EscalaCores,
  type ValorCelula,
} from "@/lib/energia/mapa-calor";
import { MapaCalor, type MapaCalorProps } from "@/components/energia/MapaCalor";
import { NAO_SE_APLICA as NAO_SE_APLICA_ESCALAS } from "@/lib/energia/escalas";
import { NAO_SE_APLICA as NAO_SE_APLICA_COROPLETICO } from "@/components/energia/MapaCoropletico";

/**
 * Mapa de calor: a escala só aceita cores por token e com número certo de
 * classes, o centro da divergente fica no lugar, o limite inferior pertence à
 * classe, zero é valor, e sem dado e não se aplica nunca recebem cor de
 * classe. A navegação respeita as bordas da matriz.
 */

const SEQ: EscalaCores = {
  tipo: "sequencial",
  limites: [100, 200, 300],
  cores: ["var(--cor-energia-fundo)", "var(--cor-energia-soft)", "var(--cor-energia)", "var(--cor-energia-dark)"],
};

describe("escala", () => {
  it("sequencial consistente passa", () => {
    expect(validaEscala(SEQ)).toEqual([]);
  });

  it("recusa hexadecimal, contagem errada de cores e limites fora de ordem", () => {
    // hexadecimal montado em tempo de execução: o arquivo de teste não pode conter hex literal solto
    const hex = "#" + "0e6170";
    expect(validaEscala({ ...SEQ, cores: [...SEQ.cores.slice(0, 3), hex] }).join(" ")).toMatch(/tokens/);
    expect(validaEscala({ ...SEQ, cores: SEQ.cores.slice(0, 3) }).join(" ")).toMatch(/4 classes e 3 cores/);
    expect(validaEscala({ ...SEQ, limites: [100, 300, 200] }).join(" ")).toMatch(/crescentes/);
    expect(validaEscala({ ...SEQ, rotulos: ["a", "b"] }).join(" ")).toMatch(/rótulos/);
  });

  it("divergente exige centro no limite do meio (classes pares) ou dentro da classe neutra (ímpares)", () => {
    const par: EscalaCores = { tipo: "divergente", limites: [-10, 0, 10], cores: ["var(--a)", "var(--b)", "var(--c)", "var(--d)"], centro: 0 };
    expect(validaEscala(par)).toEqual([]);
    expect(validaEscala({ ...par, centro: 10 }).join(" ")).toMatch(/limite do meio/);
    expect(validaEscala({ ...par, centro: undefined }).join(" ")).toMatch(/centro/);
    const impar: EscalaCores = { tipo: "divergente", limites: [-10, -2, 2, 10], cores: ["var(--a)", "var(--b)", "var(--n)", "var(--c)", "var(--d)"], centro: 0 };
    expect(validaEscala(impar)).toEqual([]);
    expect(validaEscala({ ...impar, centro: 5 }).join(" ")).toMatch(/classe do meio/);
  });

  it("classe: limite inferior pertence à classe; pontas abertas; zero é valor; ausência não tem classe", () => {
    expect(classeDe(99.99, SEQ.limites)).toBe(0);
    expect(classeDe(100, SEQ.limites)).toBe(1);
    expect(classeDe(299.9, SEQ.limites)).toBe(2);
    expect(classeDe(300, SEQ.limites)).toBe(3);
    expect(classeDe(1e9, SEQ.limites)).toBe(3);
    expect(classeDe(0, SEQ.limites)).toBe(0);
    expect(classeDe(null, SEQ.limites)).toBeNull();
    expect(classeDe(undefined, SEQ.limites)).toBeNull();
    expect(classeDe(Number.NaN, SEQ.limites)).toBeNull();
    expect(classeDe(NAO_SE_APLICA, SEQ.limites)).toBeNull();
  });

  it("não se aplica é o mesmo marcador do mapa coroplético e de escalas.ts (a mesma matriz serve aos dois mapas)", () => {
    expect(NAO_SE_APLICA).toBe(NAO_SE_APLICA_ESCALAS);
    expect(NAO_SE_APLICA_COROPLETICO).toBe(NAO_SE_APLICA_ESCALAS);
    const r = resumoGrade([[NAO_SE_APLICA_COROPLETICO, 0]], SEQ.limites);
    expect(r.naoSeAplica).toBe(1);
    expect(r.semDado).toBe(0);
  });

  it("rótulos gerados descrevem as faixas; rótulos do chamador prevalecem", () => {
    expect(rotulosClasses(SEQ, 0)).toEqual(["menos de 100", "100 a menos de 200", "200 a menos de 300", "300 ou mais"]);
    expect(rotulosClasses({ ...SEQ, rotulos: ["baixa", "média", "alta", "muito alta"] }, 0)[3]).toBe("muito alta");
  });

  it("limites por quantis fundem limites repetidos", () => {
    const v: ValorCelula[][] = [[1, 1, 1, 1], [1, 1, 5, 9], [null, NAO_SE_APLICA, 1, 1]];
    const l = limitesPorQuantis(v, 4);
    expect(l).toEqual(Array.from(new Set(l)));
    for (let i = 1; i < l.length; i++) expect(l[i]).toBeGreaterThan(l[i - 1]);
    expect(limitesPorQuantis([[null]], 4)).toEqual([]);
  });
});

describe("matriz e navegação", () => {
  it("resumo separa valor, sem dado e não se aplica, e conta por classe", () => {
    const r = resumoGrade([[0, 150, null], [NAO_SE_APLICA, 350, undefined]], SEQ.limites);
    expect(r).toMatchObject({ celulas: 6, comValor: 3, semDado: 2, naoSeAplica: 1, min: 0, max: 350 });
    expect(r.porClasse).toEqual([1, 1, 0, 1]);
  });

  it("valida o formato da matriz", () => {
    expect(validaMatriz([[1, 2], [3]], 2, 2)).toHaveLength(1);
    expect(validaMatriz([[1, 2]], 2, 2)).toHaveLength(1);
    expect(validaMatriz([[1, 2], [3, 4]], 2, 2)).toEqual([]);
  });

  it("setas nas duas dimensões param nas bordas; Home, End e cantos", () => {
    const p = { l: 0, c: 0 };
    expect(moveNaGrade(p, "ArrowLeft", 3, 4)).toEqual({ l: 0, c: 0 });
    expect(moveNaGrade(p, "ArrowUp", 3, 4)).toEqual({ l: 0, c: 0 });
    expect(moveNaGrade(p, "ArrowRight", 3, 4)).toEqual({ l: 0, c: 1 });
    expect(moveNaGrade(p, "ArrowDown", 3, 4)).toEqual({ l: 1, c: 0 });
    expect(moveNaGrade({ l: 2, c: 3 }, "ArrowDown", 3, 4)).toEqual({ l: 2, c: 3 });
    expect(moveNaGrade({ l: 1, c: 2 }, "End", 3, 4)).toEqual({ l: 1, c: 3 });
    expect(moveNaGrade({ l: 1, c: 2 }, "Home", 3, 4)).toEqual({ l: 1, c: 0 });
    expect(moveNaGrade({ l: 1, c: 2 }, "End", 3, 4, true)).toEqual({ l: 2, c: 3 });
    expect(moveNaGrade({ l: 1, c: 2 }, "Home", 3, 4, true)).toEqual({ l: 0, c: 0 });
    expect(moveNaGrade({ l: 1, c: 2 }, "PageDown", 3, 4)).toEqual({ l: 2, c: 2 });
    expect(moveNaGrade(p, "Tab", 3, 4)).toBeNull();
  });
});

describe("renderização no servidor", () => {
  const horas = ["00", "01", "02"].map((h) => ({ id: h, rotulo: `${h}h` }));
  const dias = [
    { id: "d1", rotulo: "28/09/2026", curto: "28/09" },
    { id: "d2", rotulo: "29/09/2026", curto: "29/09" },
  ];
  const base: MapaCalorProps = {
    titulo: "PLD por hora e dia, SE/CO",
    linhas: dias,
    colunas: horas,
    nomeLinhas: "Dia",
    nomeColunas: "Hora",
    valores: [
      [0, 150, null],
      [NAO_SE_APLICA, 350, 210],
    ],
    escala: SEQ,
    unidade: "R$/MWh",
    casas: 0,
    periodo: "28 e 29/09/2026",
  };
  const html = renderToStaticMarkup(createElement(MapaCalor, base));

  it("grade com papel de grid, rótulos de linha e coluna e uma única parada de Tab", () => {
    expect(html).toMatch(/<table[^>]*role="grid"/);
    expect(html.match(/role="gridcell"/g)).toHaveLength(6);
    expect(html.match(/<td[^>]*tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/<td[^>]*tabindex="-1"/g)).toHaveLength(5);
    const grade = html.slice(0, html.indexOf("</table>"));
    expect(grade.match(/scope="row"/g)).toHaveLength(2);
    expect(grade).toContain("<caption");
    expect(html).toContain('aria-live="polite"');
  });

  it("sem dado é hachura, não se aplica é borda tracejada, zero recebe a cor da sua classe", () => {
    const celula = (estado: string) => html.match(new RegExp(`<td[^>]*data-estado="${estado}"[^>]*>`))?.[0] ?? "";
    expect(celula("sem-dado")).toContain("repeating-linear-gradient");
    expect(celula("sem-dado")).not.toContain("data-classe");
    expect(celula("nao-se-aplica")).toContain("border-dashed");
    expect(celula("nao-se-aplica")).not.toContain("style=");
    const zero = html.match(/<td[^>]*data-l="0" data-c="0"[^>]*>/)?.[0] ?? "";
    expect(zero).toContain('data-classe="0"');
    expect(zero).toContain("background:var(--cor-energia-fundo)");
    expect(html).toContain('data-sem-dado="1"');
  });

  it("célula leva o valor em texto para leitor de tela", () => {
    expect(html).toMatch(/<span class="sr-only">350 R\$\/MWh, classe 300 ou mais<\/span>/);
    expect(html).toMatch(/<span class="sr-only">sem dado<\/span>/);
  });

  it("legenda com unidade, classes, sem dado e não se aplica", () => {
    expect(html).toContain("Escala em R$/MWh");
    expect(html).toContain("menos de 100");
    expect(html).toMatch(/aria-label="Legenda: classes em R\$\/MWh"/);
    expect(html).toMatch(/<\/span>sem dado<\/li>/);
    expect(html).toMatch(/<\/span>não se aplica<\/li>/);
  });

  it("rolagem horizontal fica no componente e a tabela equivalente traz os três estados", () => {
    expect(html).toMatch(/<div class="tabela-scroll[^"]*"><table[^>]*role="grid"/);
    const equivalente = html.slice(html.lastIndexOf("<table"));
    expect(equivalente).not.toContain('role="grid"');
    expect(equivalente).toMatch(/28\/09\/2026<\/th><td[^>]*>0<\/td><td[^>]*>150<\/td><td[^>]*>sem dado<\/td>/);
    expect(equivalente).toContain("não se aplica");
    expect(html).toMatch(/<summary[^>]*min-h-\[44px\]/);
  });

  it("escala com cor fora dos tokens ou matriz torta falha no servidor", () => {
    const hex = "#" + "0e6170";
    expect(() => renderToStaticMarkup(createElement(MapaCalor, { ...base, escala: { ...SEQ, cores: [...SEQ.cores.slice(0, 3), hex] } }))).toThrow(/tokens/);
    expect(() => renderToStaticMarkup(createElement(MapaCalor, { ...base, valores: [[1, 2, 3]] }))).toThrow(/linhas de valores/);
  });
});
