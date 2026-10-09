import { describe, expect, it } from "vitest";
import { Fragment, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GraficoLinhas, type GraficoLinhasProps } from "@/components/energia/GraficoLinhas";
import { CursorSincronizado } from "@/components/energia/CursorSincronizado";
import {
  criarLojaCursor,
  dominioLinhas,
  indicesDoIntervalo,
  intervaloDosIndices,
  mesmaEscala,
  periodosProntos,
  rotulosDoEixoX,
} from "@/lib/energia/series-temporais";
import { somarDias, somarMeses } from "@/lib/energia/calendario";

/**
 * GraficoLinhas com zoom, cursor sincronizado e legenda interativa
 * (src/components/energia/GraficoLinhas.tsx e src/lib/energia/series-temporais.ts).
 * Os casos cobrem os erros que distorcem a leitura: intervalo vazio ou de um
 * ponto, período "30 dias" contado em linhas (e não no calendário), domínio
 * que estoura a pilha em série longa, escala que muda sem aviso ao ocultar
 * série, ausência desenhada como zero, cursor que aparece num dia que o
 * gráfico não tem e o HTML de sempre alterado para quem não usa as props novas.
 */

const dias = (inicio: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(inicio, i) as string);
const X10 = dias("2024-01-01", 10);

describe("intervalo de zoom (valores de X, não índices)", () => {
  it("sem intervalo, a série completa; com intervalo, as pontas inclusive", () => {
    expect(indicesDoIntervalo(X10, null)).toEqual([0, 9]);
    expect(indicesDoIntervalo(X10, { inicio: "2024-01-03", fim: "2024-01-05" })).toEqual([2, 4]);
  });

  it("pontas que não existem na série valem pelo primeiro X ≥ início e o último X ≤ fim", () => {
    expect(indicesDoIntervalo(X10, { inicio: "2023-12-15", fim: "2024-01-04" })).toEqual([0, 3]);
    expect(indicesDoIntervalo(X10, { inicio: "2024-01-02T12:00", fim: "2024-02-01" })).toEqual([2, 9]);
  });

  it("intervalo invertido, fora da série ou com um só ponto volta à série completa (nunca gráfico vazio)", () => {
    expect(indicesDoIntervalo(X10, { inicio: "2024-01-08", fim: "2024-01-02" })).toEqual([0, 9]);
    expect(indicesDoIntervalo(X10, { inicio: "2025-01-01", fim: "2025-02-01" })).toEqual([0, 9]);
    expect(indicesDoIntervalo(X10, { inicio: "2024-01-05", fim: "2024-01-05" })).toEqual([0, 9]);
  });

  it("série fora de ordem (texto) só aceita pontas exatas", () => {
    expect(indicesDoIntervalo(["B", "A", "C", "D"], { inicio: "A", fim: "C" })).toEqual([1, 2]);
    expect(indicesDoIntervalo(["B", "A", "C", "D"], { inicio: "AA", fim: "C" })).toEqual([0, 3]);
  });

  it("índices viram intervalo: pontas trocadas, alargamento até dois pontos e null para a série inteira", () => {
    expect(intervaloDosIndices(X10, 4, 2)).toEqual({ inicio: "2024-01-03", fim: "2024-01-05" });
    expect(intervaloDosIndices(X10, 5, 5)).toEqual({ inicio: "2024-01-06", fim: "2024-01-07" });
    expect(intervaloDosIndices(X10, 9, 9)).toEqual({ inicio: "2024-01-09", fim: "2024-01-10" });
    expect(intervaloDosIndices(X10, 0, 9)).toBeNull();
    expect(intervaloDosIndices(X10, -3, 40)).toBeNull();
  });
});

describe("períodos prontos contados no calendário", () => {
  const X = dias("2025-08-27", 400); // termina em 2026-09-30

  it("30 dias, 90 dias e 1 ano terminam no último ponto; 5 anos não entra em série de 400 dias", () => {
    expect(X.at(-1)).toBe("2026-09-30");
    const p = periodosProntos(X, "data");
    expect(p.map((q) => [q.rotulo, q.inicio, q.pontos])).toEqual([
      ["30 dias", "2026-09-01", 30],
      ["90 dias", "2026-07-03", 90],
      ["1 ano", "2025-10-01", 365],
    ]);
  });

  it("dia faltando não encurta o período: '30 dias' continua começando no mesmo dia, com um ponto a menos", () => {
    const comLacuna = X.filter((d) => d !== "2026-09-10");
    const p30 = periodosProntos(comLacuna, "data").find((q) => q.id === "30d");
    expect(p30).toMatchObject({ inicio: "2026-09-01", fim: "2026-09-30", pontos: 29 });
  });

  it("série mensal usa meses; formatos sem calendário e séries curtas não têm período pronto", () => {
    const meses = Array.from({ length: 80 }, (_, i) => somarMeses("2020-01", i) as string); // até 2026-08
    expect(periodosProntos(meses, "mes").map((q) => [q.rotulo, q.inicio])).toEqual([
      ["12 meses", "2025-09"],
      ["5 anos", "2021-09"],
    ]);
    expect(periodosProntos(["01-01", "01-02", "01-03", "01-04"], "md")).toEqual([]);
    expect(periodosProntos(dias("2026-09-28", 3), "data")).toEqual([]);
  });
});

describe("domínio vertical e mudança de escala", () => {
  const dados = [
    { d: "a", s: 10, g: 200 },
    { d: "b", s: null, g: 180 },
    { d: "c", s: 20, g: Number.NaN },
    { d: "d", s: undefined, g: undefined },
  ];

  it("ignora ausência (null, undefined, NaN) e mantém a regra de folga de 6%", () => {
    const r = dominioLinhas(dados, ["s"]);
    expect(r.yMin).toBeCloseTo(9.4, 10);
    expect(r.yMax).toBeCloseTo(20.6, 10);
    expect(dominioLinhas(dados, ["s"], true).yMin).toBe(0);
    expect(dominioLinhas(dados, ["s"], true).yMax).toBeCloseTo(21.2, 10);
    expect(dominioLinhas([{ d: "a", s: null }], ["s"])).toEqual({ yMin: 0, yMax: 1 });
  });

  it("ocultar a série grande muda o domínio, e mesmaEscala detecta isso", () => {
    const todas = dominioLinhas(dados, ["s", "g"]);
    const visiveis = dominioLinhas(dados, ["s"]);
    expect(mesmaEscala(todas, visiveis)).toBe(false);
    expect(mesmaEscala(todas, dominioLinhas(dados, ["g", "s"]))).toBe(true);
  });

  it("série horária longa não estoura a pilha de argumentos", () => {
    const longa = Array.from({ length: 300_000 }, (_, i) => ({ v: i % 1000 }));
    expect(() => dominioLinhas(longa, ["v"])).not.toThrow();
    expect(dominioLinhas(longa, ["v"]).yMax).toBeCloseTo(999 + 999 * 0.06, 6);
  });
});

describe("loja do cursor sincronizado", () => {
  it("avisa só quando muda, e uma origem não apaga o cursor de outra", () => {
    const loja = criarLojaCursor();
    let avisos = 0;
    const sair = loja.assinar(() => avisos++);
    loja.publicar("d", "2024-01-03", "A");
    loja.publicar("d", "2024-01-03", "A");
    expect(avisos).toBe(1);
    loja.limpar("B");
    expect(loja.ler()).toEqual({ grupo: "d", valor: "2024-01-03", origem: "A" });
    loja.limpar("A");
    expect(loja.ler()).toBeNull();
    expect(avisos).toBe(2);
    sair();
    loja.publicar("d", "2024-01-04", "A");
    expect(avisos).toBe(2);
  });
});

/* ---------- renderização no servidor ---------- */

const html = (p: GraficoLinhasProps) => renderToStaticMarkup(createElement(GraficoLinhas, p));

const serie10 = X10.map((d, i) => ({ d, a: i === 4 ? null : 10 + i, b: 100 + i * 10 }));
const base: GraficoLinhasProps = {
  titulo: "Carga diária",
  dados: serie10,
  chaveX: "d",
  series: [
    { id: "a", rotulo: "Série A", cor: "var(--serie-1)" },
    { id: "b", rotulo: "Série B", cor: "var(--serie-3)" },
  ],
  unidade: "MWmed",
};

function corpoTabela(m: string): string {
  const t = m.match(/<tbody>([\s\S]*?)<\/tbody>/);
  if (!t) throw new Error("tabela não montada");
  return t[1];
}
const caminhoDe = (m: string, cor: string) => m.match(new RegExp(`<path d="([^"]*)" fill="none" stroke="${cor.replace(/[()]/g, "\\$&")}"`))?.[1] ?? null;

describe("GraficoLinhas no servidor, sem as props novas (compatibilidade)", () => {
  const m = html(base);

  it("mantém legenda estática, altura fixa, leitura aria-live e tabela recolhida", () => {
    expect(m).toContain('aria-label="Legenda"');
    expect(m).not.toContain("<button");
    expect(m).not.toContain("data-controles");
    expect(m).not.toContain("aria-describedby");
    expect(m).toMatch(/<svg width="100%" height="300" viewBox="0 0 760 300" role="img"/);
    expect(m).toContain('aria-live="polite"');
    expect(m).toContain("Dados do gráfico em tabela (10 linhas)");
  });

  it("ausência é lacuna: a série com um nulo no meio vira dois trechos, nunca um ponto em zero", () => {
    const d = caminhoDe(m, "var(--serie-1)");
    expect(d).not.toBeNull();
    expect((d as string).match(/M/g)).toHaveLength(2);
  });

  it("ticks do eixo vertical com as casas do passo: passo 2,5 não vira 3 e 8", () => {
    // valores de 0 a 9 com folga de 6%: passo 2,5 (ticks 0; 2,5; 5; 7,5)
    const dados = X10.map((d, i) => ({ d, a: i }));
    const g = html({ titulo: "Passo 2,5", dados, chaveX: "d", series: [{ id: "a", rotulo: "A", cor: "var(--serie-1)" }], unidade: "MW" });
    const ticks = Array.from(g.matchAll(/text-anchor="end" font-size="11" fill="var\(--cor-mineral\)">([^<]+)</g)).map((t) => t[1]);
    expect(ticks).toEqual(["0,0", "2,5", "5,0", "7,5"]);
  });
});

describe("zoom por intervalo", () => {
  it("controles acessíveis: grupo rotulado, períodos, restaurar desativado sem zoom e início e fim nativos", () => {
    const m = html({ ...base, zoom: true });
    expect(m).toMatch(/role="group" aria-label="Intervalo do gráfico: Carga diária"/);
    expect(m).toMatch(/aria-disabled="true"[^>]*>Restaurar intervalo/);
    expect(m.match(/type="range"/g)).toHaveLength(2);
    expect(m).toContain('aria-valuetext="01/01/2024"');
    expect(m).toContain('aria-valuetext="10/01/2024"');
    expect(m).toContain("aria-describedby");
  });

  it("intervalo inicial recorta gráfico e tabela, diz o recorte e que o eixo foi recalculado", () => {
    const m = html({ ...base, zoom: true, intervaloInicial: { inicio: "2024-01-03", fim: "2024-01-06" }, tabelaAbertaInicial: true });
    expect(m).toMatch(/aria-disabled="false"[^>]*>Restaurar intervalo/);
    expect(m).toContain("Intervalo exibido: 03/01/2024 a 06/01/2024, 4 de 10 pontos; eixo vertical recalculado para o intervalo.");
    expect(m).toContain("Dados do gráfico em tabela (4 de 10 linhas, intervalo exibido)");
    const corpo = corpoTabela(m);
    expect(corpo.match(/<tr/g)).toHaveLength(4);
    expect(corpo).toContain("03/01/2024");
    expect(corpo).not.toContain("02/01/2024");
    // o nulo de 05/01 continua "sem dado" na tabela do trecho
    expect(corpo).toMatch(/05\/01\/2024<\/th><td[^>]*>sem dado<\/td>/);
    expect(m).toContain('aria-valuetext="03/01/2024"');
    expect(m).toContain('aria-valuetext="06/01/2024"');
  });

  it("intervalo controlado inválido não esvazia o gráfico", () => {
    const m = html({ ...base, zoom: true, intervalo: { inicio: "2030-01-01", fim: "2030-02-01" } });
    expect(m).toContain("Dados do gráfico em tabela (10 linhas)");
    expect(m).toMatch(/aria-disabled="true"[^>]*>Restaurar intervalo/);
  });
});

describe("legenda interativa", () => {
  it("botões com aria-pressed, unidade preservada e aviso quando a escala muda", () => {
    const m = html({ ...base, legendaInterativa: true, ocultasIniciais: ["b"], tabelaAbertaInicial: true });
    expect(m).toMatch(/<button type="button" aria-pressed="true"[^>]*>[\s\S]*?Série A/);
    expect(m).toMatch(/<button type="button" aria-pressed="false"[^>]*>[\s\S]*?Série B[\s\S]*?\(oculta\)/);
    expect(m).toContain("Valores em MWmed");
    expect(m).toContain("Escala ajustada às séries visíveis");
    expect(m).toContain("Manter a escala de todas as séries");
    expect(caminhoDe(m, "var(--serie-3)")).toBeNull();
    expect(m).toContain("séries ocultas no gráfico e na tabela: Série B");
    expect(m).not.toContain("Série B (MWmed)");
  });

  it("com escalaAoOcultar='manter', a escala não muda e o texto diz isso", () => {
    const m = html({ ...base, legendaInterativa: true, ocultasIniciais: ["b"], escalaAoOcultar: "manter" });
    expect(m).toContain("Escala mantida com todas as séries, inclusive as ocultas.");
    expect(m).not.toContain("Escala ajustada");
    // mesmo eixo do gráfico com as duas séries: o maior tick continua o de B
    const ticks = (s: string) => Array.from(s.matchAll(/text-anchor="end" font-size="11" fill="var\(--cor-mineral\)">([^<]+)</g)).map((t) => t[1]);
    expect(ticks(m)).toEqual(ticks(html(base)));
  });

  it("ocultar todas equivale a não ocultar nenhuma: nunca um gráfico sem linha", () => {
    const m = html({ ...base, legendaInterativa: true, ocultasIniciais: ["a", "b"] });
    expect(m.match(/aria-pressed="true"/g)).toHaveLength(2);
    expect(m).not.toContain("(oculta)");
  });
});

describe("cursor sincronizado", () => {
  const grafico = (p: Partial<GraficoLinhasProps>) => createElement(GraficoLinhas, { ...base, ...p });

  it("gráficos com a mesma chaveX sob o provedor mostram a cruz no mesmo dia; os demais, não", () => {
    const mensal = [
      { m: "2024-01", a: 1, b: 2 },
      { m: "2024-02", a: 3, b: 4 },
    ];
    const m = renderToStaticMarkup(
      createElement(
        CursorSincronizado,
        { inicial: { grupo: "d", valor: "2024-01-04" } },
        createElement(
          Fragment,
          null,
          grafico({ titulo: "G1" }),
          grafico({ titulo: "G2" }),
          grafico({ titulo: "G3 mensal", dados: mensal, chaveX: "m", formatoX: "mes" }),
          grafico({ titulo: "G4 sem sincronia", sincronizarCursor: false }),
          grafico({ titulo: "G5 fora do trecho", zoom: true, intervaloInicial: { inicio: "2024-01-06", fim: "2024-01-09" } }),
        ),
      ),
    );
    const partes = m.split(/(?=<title id=)/).slice(1);
    const comCursor = partes.map((p) => /data-cursor="sincronizado"/.test(p));
    expect(comCursor).toEqual([true, true, false, false, false]);
    // só a cruz: a dica e a leitura aria-live ficam com o gráfico de origem
    expect(m).not.toContain("pointer-events-none absolute top-6");
  });

  it("sem provedor, nenhum cursor externo", () => {
    expect(html(base)).not.toContain("data-cursor");
  });
});


describe("rótulos do eixo X", () => {
  it("em poucas semanas, o formato data passa para dia e mês em vez de repetir o mês", () => {
    const dias = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-30"];
    expect(rotulosDoEixoX(dias, "data")).toEqual(["01/09", "08/09", "15/09", "22/09", "30/09"]);
  });
  it("em meses diferentes, mantém mês e ano; em anos diferentes com o mesmo dia e mês, escreve o ano", () => {
    expect(rotulosDoEixoX(["2026-01-15", "2026-04-15", "2026-09-15"], "data")).toEqual(["jan/26", "abr/26", "set/26"]);
    expect(rotulosDoEixoX(["2025-09-30", "2026-09-30"], "data")).toEqual(["set/25", "set/26"]);
    expect(rotulosDoEixoX(["2025-09-01", "2025-09-20", "2026-09-01", "2026-09-20"], "data")).toEqual(["01/09/2025", "20/09/2025", "01/09/2026", "20/09/2026"]);
  });
  it("outros formatos seguem como estavam", () => {
    expect(rotulosDoEixoX(["2026-08", "2026-09"], "mes")).toEqual(["ago/26", "set/26"]);
    expect(rotulosDoEixoX(["x", "y"], undefined)).toEqual(["x", "y"]);
  });
});

describe("rótulo de marco dentro da área do gráfico", () => {
  const longo = "29/04/2023: a MMGD entrou na curva de carga e a série passa a incluir a geração distribuída estimada pelo ONS";

  it("marco perto da borda direita com texto longo vai para a esquerda e quebra em até três linhas, sem passar da área", () => {
    const m = html({ ...base, marcos: [{ x: serie10[8].d as string, rotulo: longo }] });
    const texto = m.match(/<text[^>]*text-anchor="end"[^>]*font-size="10"[^>]*>([\s\S]*?)<\/text>/)?.[1] ?? "";
    const linhas = Array.from(texto.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)).map((l) => l[1]);
    expect(linhas.length).toBeGreaterThan(1);
    expect(linhas.length).toBeLessThanOrEqual(3);
    // a esquerda do traço de x ≈ 8/9 da largura há cerca de 600 px: nenhuma linha passa disso (cerca de 5,4 px por caractere)
    for (const l of linhas) expect(l.length * 5.4).toBeLessThanOrEqual(640);
    // o que sobra do texto fica em reticências na última linha, e o começo é preservado
    expect(linhas.join(" ")).toContain("29/04/2023: a MMGD");
  });

  it("texto curto continua numa linha só, à direita do traço quando cabe", () => {
    const m = html({ ...base, marcos: [{ x: serie10[1].d as string, rotulo: "Troca de regra" }] });
    expect(m).toMatch(/<text[^>]*text-anchor="start"[^>]*font-size="10"[^>]*>Troca de regra<\/text>/);
  });

  it("marcos próximos se empilham pela altura de cada um (sem sobrepor o texto do anterior)", () => {
    const m = html({
      ...base,
      marcos: [
        { x: serie10[2].d as string, rotulo: longo },
        { x: serie10[3].d as string, rotulo: "Outro marco" },
      ],
    });
    const ys = Array.from(m.matchAll(/<text[^>]*y="([\d.]+)"[^>]*font-size="10"/g)).map((r) => Number(r[1]));
    expect(ys.length).toBeGreaterThanOrEqual(2);
    expect(ys[1]).toBeGreaterThanOrEqual(ys[0] + 12);
  });
});
