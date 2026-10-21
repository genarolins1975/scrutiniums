/* eslint-disable @typescript-eslint/no-explicit-any -- executa funções da SPA sem iniciar o navegador */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";

const app = readFileSync("public/obs/app.js", "utf8");
const core = readFileSync("public/obs/app.min.js", "utf8");
function declaration(source: string, name: string) {
  const tree = ts.createSourceFile("spa.js", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const node = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  if (!node) throw new Error(`Função ausente do arquivo servido: ${name}`);
  return node.getText(tree);
}
const fmt = { n: (x: number, n: number) => x.toLocaleString("pt-BR", { maximumFractionDigits: n }), my: (x: string) => x.slice(5, 7) + "/" + x.slice(0, 4) };

describe("revisão individual: regressões observadas na navegação real", () => {
  it("uma entrada direta encontra os guias de gráfico sem visitar Bancos na bolsa", () => {
    for (const name of ["leitura", "entenda"]) {
      const fn = new Function(`${declaration(core, name)}; return ${name};`)();
      expect(name === "leitura" ? fn([["Leitura", "Conteúdo"]]) : fn("x", [["Leitura", "Conteúdo"]])).toContain("Conteúdo");
    }
  });

  const chart = new Function("fmt", "ccol", "attr", `${declaration(app, "lineChart")}; return lineChart;`)(fmt, (x: string) => x, (x: string) => x);
  it("dois dias do mesmo mês permanecem distinguíveis no eixo, tabela e tooltip", () => {
    const html = chart({ series: [{ pts: [{ x: "2026-07-30", y: 14 }, { x: "2026-07-31", y: 13.75 }], label: "Selic", color: "blue" }], unit: "% a.a." });
    expect(html).toContain("<td>30/07/2026</td>");
    expect(html).toContain("<td>31/07/2026</td>");
    const payload = JSON.parse(decodeURIComponent(html.match(/data-chart="([^"]+)"/)![1]));
    expect(payload.dailyDates).toBe(true);
    expect(payload.series[0].vals).toEqual([14, 13.75]);
  });
  it("séries mensais conservam o mês e não ganham um dia fictício", () => {
    const html = chart({ series: [{ pts: [{ x: "2026-06-01", y: 1 }, { x: "2026-07-01", y: null }, { x: "2026-08-01", y: 3 }], color: "blue" }] });
    expect(html).toContain("<td>07/2026</td>");
    expect(html).toContain('>–</td>');
    expect(html).not.toContain("01/07/2026");
  });

  const delta = new Function("_d12", `${declaration(app, "variacaoPulso")}; return variacaoPulso;`)((s: any) => s.obs.length >= 13 ? s.obs.at(-1).v - s.obs.at(-13).v : null);
  const series = { obs: Array.from({ length: 13 }, (_, i) => ({ v: i === 12 ? 4.88 : 3.96 })), yoy: [{ v: 23.23 }], yoy_real: [{ v: 18.4 }] };
  it("a passagem de 3,96% para 4,88% é +0,92 p.p., inclusive com filtro real", () => {
    for (const key of ["inad", "taxa", "spread"]) {
      const result = delta(series, key, "real");
      expect(result.valor).toBeCloseTo(0.92);
      expect(result.rotulo).toBe(" p.p. em 12 meses");
    }
  });
  it("saldo e concessões conservam crescimento nominal ou real e ausência explícita", () => {
    expect(delta(series, "saldo", "nominal").valor).toBe(23.23);
    expect(delta(series, "concessoes", "real").valor).toBe(18.4);
    expect(delta({ obs: [], yoy: [] }, "inad", "nominal").valor).toBeNull();
  });

  it("proventos exibem o ticker publicado de todas as companhias, além das três do piloto", () => {
    const render = new Function("state", "fmt", "badge", "sechead", "leitura", "entenda", "metricCard", `${declaration(app, "mktProventos")}; return mktProventos;`)(
      { mkt: { emp: "todas" } }, fmt, () => "", (x: string) => x, () => "", () => "", () => "",
    );
    const market = JSON.parse(readFileSync("public/obs/data/gold/market.json", "utf8"));
    const html = render({ ...market, valuation: [] }, {}, {});
    for (const e of market.empresas) expect(html).toContain(`(${e.main_ticker})`);
    expect(html).not.toContain("undefined");
  });
});
