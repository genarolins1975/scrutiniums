/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Entrantes e saídas do SFN. O que se trava:
 * - cadastro: grupos somam o total, UFs somam o total, cooperativas por sistema somam as cooperativas;
 * - IF.data: série trimestral com entradas e saídas coerentes (n_t = n_{t-1} + entradas − saídas),
 *   último trimestre marcado como provisório, listas nominais só dos últimos oito trimestres;
 * - regimes: vigentes e decretados em 12 meses coerentes com regimes.json;
 * - a SPA registra a aba em todos os mapas e o pipeline registra o coletor.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const S = lerGold("sfn.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const comCadastro = !!S.disponivel && !!S.cadastro?.disponivel;
const comIfdata = !!S.disponivel && !!S.ifdata?.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!comCadastro)("sfn.json: cadastro de instituições em funcionamento", () => {
  const C = S.cadastro;
  it("grupos, UFs e regiões somam o total; segmentos somam o grupo; bancos e cooperativas presentes", () => {
    expect(C.total).toBeGreaterThan(1000);
    expect(soma(C.grupos, "n")).toBe(C.total);
    expect(soma(C.ufs, "n")).toBe(C.total);
    expect(soma(C.regioes, "n")).toBe(C.total);
    for (const g of C.grupos) expect(soma(g.segmentos, "n"), g.grupo).toBe(g.n);
    const nomes = C.grupos.map((g: any) => g.grupo);
    for (const g of ["Bancos", "Cooperativas de crédito", "Instituições de pagamento", "Fintechs de crédito"]) expect(nomes).toContain(g);
    expect(C.grupos.find((g: any) => g.grupo === "Outros")).toBeUndefined();
  });
  it("cooperativas: sistemas, critérios e categorias somam as cooperativas; bancos com e sem carteira comercial", () => {
    const coop = C.cooperativas;
    expect(coop.n).toBe(C.grupos.find((g: any) => g.grupo === "Cooperativas de crédito").n);
    expect(soma(coop.por_sistema, "n")).toBe(coop.n);
    expect(soma(coop.por_associacao, "n")).toBe(coop.n);
    expect(coop.por_sistema.map((x: any) => x.sistema)).toContain("Sicoob");
    expect(C.bancos.com_carteira_comercial + C.bancos.sem_carteira_comercial).toBeLessThanOrEqual(C.bancos.n);
  });
  it("o histórico próprio declara a data de início e nunca inventa entradas antes dela", () => {
    expect(C.historico_proprio.desde).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const e of C.historico_proprio.entradas) expect(e.data > C.historico_proprio.desde).toBe(true);
    expect(C.nota).toMatch(/Sem data de início/);
  });
});

describe.skipIf(!comIfdata)("sfn.json: reportantes do IF.data", () => {
  const I = S.ifdata;
  it("a série fecha: reportantes de t = t−1 + entradas − saídas; último trimestre é provisório", () => {
    const ser = I.serie;
    expect(ser.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < ser.length; i++) {
      expect(ser[i].n, ser[i].anomes).toBe(ser[i - 1].n + ser[i].entradas - ser[i].saidas);
      expect(soma(Object.entries(ser[i].por_tcb).map(([, v]) => ({ v })), "v"), ser[i].anomes).toBe(ser[i].n);
    }
    expect(ser[ser.length - 1].provisorio).toBe(true);
    expect(ser.filter((p: any) => p.provisorio).length).toBe(1);
    expect(I.ultimo_fechado < I.ultimo).toBe(true);
  });
  it("KPIs dos quatro trimestres fechados e listas nominais dos últimos oito", () => {
    const fechados = I.serie.filter((p: any) => !p.provisorio).slice(-4);
    expect(I.kpis.entradas_4t).toBe(soma(fechados, "entradas"));
    expect(I.kpis.saidas_4t).toBe(soma(fechados, "saidas"));
    expect(I.kpis.reportantes).toBe(fechados[fechados.length - 1].n);
    const oito = I.serie.slice(-8).map((p: any) => p.anomes);
    for (const x of [...I.entradas, ...I.saidas]) expect(oito, x.nome).toContain(x.anomes);
    for (const x of I.saidas.filter((s: any) => s.anomes === I.ultimo)) expect(x.provisorio).toBe(true);
    expect(soma(I.por_tcb, "share")).toBeCloseTo(100, 0);
  });
});

describe.skipIf(!S.disponivel)("sfn.json: regimes e cautelas", () => {
  it("regimes coerentes com regimes.json; cautelas declaram as três réguas e que saída não é quebra", () => {
    const R = lerGold("regimes.json");
    if (R?.disponivel && S.regimes.disponivel) {
      expect(S.regimes.vigentes).toBe(R.vigentes.length);
      expect(S.regimes.decretados_12m).toBeLessThanOrEqual(S.regimes.vigentes);
    }
    expect(S.cautelas.join(" ")).toMatch(/três réguas/);
    expect(S.cautelas.join(" ")).toMatch(/não é falência|não é quebra/);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('sfn: "/sfn-entries-exits"');
    expect(app).toContain('sfn: "Entrantes e saídas do SFN"');
    expect(app).toContain('sfn: "renderSfn"');
    expect(app).toContain('sfn: ["sfn"]');
    expect(app).toContain('sfn: "ifdata"');
    expect(app).toContain('sfn: ["sfn_cadastro", "ifdata", "regimes"]');
    expect(app).toContain('sfn: "emergentes"');
    expect(app).toMatch(/\n  sfn: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.sfn = {");
    expect(html).toContain('data-view="sfn">Entrantes e saídas do SFN</button>');
    expect(html).toContain('id="view-sfn"');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletor e gold", () => {
    const k = app.indexOf("function renderSfn(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("sfn_cadastro", sfn_cadastro)');
    expect(read("pipeline/gold.py")).toContain('common.write_gold("sfn.json", r_sfn)');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/sfn-entries-exits"');
    expect(app).toMatch(/ponte\("[^"]+", "institutions", "sec-regimes"/);
  });
});
