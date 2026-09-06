/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Bancos e mercado de capitais. O que se trava:
 * - três réguas separadas (saldo SGS, ofertas CVM, lastro CRI/CRA), cada uma com sua data;
 * - a composição do saldo fecha (componentes somam o total) e as participações somam 100;
 * - a janela de ofertas tem 12 meses fechados e o mês corrente fica fora; anual = soma do mensal;
 * - lastro: vencidos e atraso entre 0 e 100, meses parciais declarados e fora dos KPIs,
 *   exclusões por informe inconsistente contadas;
 * - o subíndice não bancário do Sinais antecedentes tem quatro componentes declarados;
 * - a SPA registra a aba em todos os mapas.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const A = lerGold("ampliado.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const leading = read("pipeline/leading.py");
const comDado = !!A.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!comDado)("ampliado.json: saldo (SGS)", () => {
  const S = A.saldo;
  it("três segmentos, seis componentes declarados, participações somam 100 e componentes somam o total", () => {
    expect(S.disponivel).toBe(true);
    expect(Object.keys(S.kpis).sort()).toEqual(["ef", "pf", "pj"]);
    expect(S.componentes.length).toBe(6);
    for (const seg of ["ef", "pj", "pf"]) {
      const k = S.kpis[seg];
      expect(soma(k.componentes, "share")).toBeCloseTo(100, 0);
      expect(Math.abs(soma(k.componentes, "valor") - k.saldo) / k.saldo).toBeLessThan(0.002);
      const ult = S.series[seg][S.series[seg].length - 1];
      expect(ult.mes).toBe(S.mes);
      expect(ult.fecha_pct).toBeGreaterThan(99.5);
    }
  });
  it("famílias não emitem títulos privados (campo nulo) e devem quase tudo ao SFN; empresas dependem do mercado", () => {
    expect(S.kpis.pf.componentes.some((c: any) => c.id === "tit")).toBe(false);
    expect(S.kpis.pf.sfn_share).toBeGreaterThan(80);
    expect(S.kpis.pj.sfn_share).toBeLessThan(50);
    expect(S.kpis.pj.mercado_share).toBeGreaterThan(20);
  });
  it("série mensal desde 2013 e desintermediação com um ponto por dezembro mais o último mês", () => {
    expect(S.series.ef[0].mes).toBe("2013-01");
    const D = S.desintermediacao_empresas;
    expect(D.filter((d: any) => !d.parcial).every((d: any) => d.mes.endsWith("-12"))).toBe(true);
    expect(D[D.length - 1].parcial).toBe(!S.mes.endsWith("-12"));
  });
});

describe.skipIf(!comDado)("ampliado.json: emissões (CVM ofertas)", () => {
  const E = A.emissoes;
  it("janela de 12 meses fechados antes do mês corrente; anual é a soma do mensal", () => {
    expect(E.disponivel).toBe(true);
    expect(E.janela.fim < E.mes_corrente_parcial).toBe(true);
    const jan = E.serie_mensal.filter((p: any) => p.mes >= E.janela.ini && p.mes <= E.janela.fim);
    expect(jan.length).toBe(12);
    expect(Math.abs(soma(jan, "total") - E.kpis.valor_12m)).toBeLessThan(1);
    for (const a of E.anual.filter((x: any) => x.ano >= "2012")) {
      const meses = E.serie_mensal.filter((p: any) => p.mes.startsWith(a.ano));
      if (meses.length === a.meses) expect(Math.abs(soma(meses, "total") - a.total), a.ano).toBeLessThan(1);
    }
  });
  it("famílias somam o total da janela; dívida corporativa e securitização são subconjuntos; fundos abertos ficam fora", () => {
    expect(Math.abs(soma(E.por_familia, "valor") - E.kpis.valor_12m)).toBeLessThan(1);
    expect(soma(E.por_familia, "share")).toBeCloseTo(100, 0);
    expect(E.kpis.divida_corporativa_12m + E.kpis.securitizacao_12m).toBeLessThanOrEqual(E.kpis.valor_12m);
    expect(E.nota).toMatch(/ICVM 555/);
    expect(E.kpis.valor_12m).toBeLessThan(5e12); // sem o teto cadastral dos fundos abertos, o ano cabe em trilhões, não em centenas
  });
  it("Res. 160: público-alvo soma 100, em andamento fora dos totais, HHI dos coordenadores declarado", () => {
    expect(soma(E.res160.publico_alvo, "share")).toBeCloseTo(100, 0);
    expect(E.res160.em_andamento.n).toBeGreaterThanOrEqual(0);
    expect(E.divida_corporativa.hhi_lideres).toBeGreaterThan(0);
    expect(E.divida_corporativa.hhi_lideres).toBeLessThan(10000);
    expect(E.divida_corporativa.top_emissores.length).toBeGreaterThan(5);
    for (const l of E.divida_corporativa.top_lideres) expect(l.share).toBeLessThanOrEqual(100);
  });
});

describe.skipIf(!comDado)("ampliado.json: securitização (CVM CRI e CRA)", () => {
  const X = A.securitizacao;
  it("CRI e CRA com KPIs no último mês fechado; parciais declarados e fora do KPI; razões entre 0 e 100", () => {
    expect(X.disponivel).toBe(true);
    for (const t of ["cri", "cra"]) {
      const B = X.blocos[t];
      expect(B.meses_parciais).not.toContain(B.mes);
      expect(B.kpis.vencidos_pct).toBeGreaterThanOrEqual(0);
      expect(B.kpis.vencidos_pct).toBeLessThan(100);
      expect(B.kpis.atraso_pct).toBeLessThan(100);
      for (const p of B.serie.filter((x: any) => x.creditos)) {
        expect(p.vencidos_pct, `${t} ${p.mes}`).toBeLessThanOrEqual(100);
        expect(p.excluidos_unidade).toBeGreaterThanOrEqual(0);
      }
      expect(soma(B.segmentos, "share")).toBeCloseTo(100, 0);
      expect(soma(B.series_situacao, "share_n")).toBeCloseTo(100, 0);
    }
    expect(X.blocos.cri.primeiro_mes_com_credito).toBe("2022-07");
    expect(A.cautelas.join(" ")).toMatch(/2022-07/);
  });
});

describe("Sinais antecedentes: família não bancária com quatro componentes (E13)", () => {
  it("SUB_DEF lista FIDC, CRI, CRA e emissões; o mês só entra com metade dos componentes", () => {
    expect(leading).toMatch(/"nao_bancario": \["fidc_inad_pct", "cri_venc_pct", "cra_venc_pct", "emissoes_divida_yoy"\]/);
    expect(leading).toContain('SINAL_INVERTIDO = {"ivgr_real_yoy", "emissoes_divida_yoy"}');
    expect(leading).toContain("piso = max(1, len(comps) // 2)");
    expect(leading).toContain("amp_mod.serie_fidc(con)");
  });
  it("a aba não bancário da SPA mostra os quatro sinais e aponta para o painel", () => {
    expect(app).toContain('leadSignalChart(L, "cri_venc_pct")');
    expect(app).toContain('leadSignalChart(L, "emissoes_divida_yoy")');
    expect(app).toMatch(/ponte\("[^"]+", "ampliado", "amp-sec"/);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('ampliado: "/broad-credit"');
    expect(app).toContain('ampliado: "Bancos e mercado de capitais"');
    expect(app).toContain('ampliado: "renderAmpliado"');
    expect(app).toContain('ampliado: ["ampliado"]');
    expect(app).toContain('ampliado: "sgs"');
    expect(app).toContain('ampliado: ["bcb_sgs", "cvm_ofertas", "cvm_securit"]');
    expect(app).toContain('ampliado: "emergentes"');
    expect(app).toMatch(/\n  ampliado: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.amp = {");
    expect(html).toContain('data-view="ampliado">Bancos e mercado de capitais</button>');
    expect(html).toContain('id="view-ampliado"');
  });
  it("o renderizador vive no chunk emergentes e declara as três réguas", () => {
    const k = app.indexOf("function renderAmpliado(");
    const ini = app.indexOf("/* @chunk:emergentes:ini */"), fim = app.indexOf("/* @chunk:emergentes:fim */");
    expect(k).toBeGreaterThan(ini);
    expect(k).toBeLessThan(fim);
    expect(app).toContain("Nada aqui soma uma régua com a");
  });
  it("o pipeline registra os dois coletores novos e o gold", () => {
    const run = read("pipeline/run.py");
    expect(run).toContain('("cvm_ofertas", cvm_ofertas), ("cvm_securit", cvm_securit)');
    expect(read("pipeline/gold.py")).toContain('common.write_gold("ampliado.json", r_amp)');
    expect(read("config/config.json")).toContain('"key": "amp_ef_sec"');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/broad-credit"');
  });
});
