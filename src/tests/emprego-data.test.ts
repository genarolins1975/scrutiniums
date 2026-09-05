/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Emprego formal (Novo Caged). O que se trava:
 * - Brasil: saldo do mês = variação do estoque; saldo em 12 meses coerente com a variação a/a;
 *   admissões − desligamentos do Ipeadata fecha com a variação do estoque do SGS (reconciliação publicada);
 * - seções: soma das seções não agregadas + não itemizado = total; agregados (SIUP, Serviços) somam suas partes;
 *   z-score com janela declarada e mínimo de observações; faixa coerente com o z;
 * - UFs: 27 UFs, saldo = admissões − desligamentos, soma das UFs = Brasil, posições de 1 a 27;
 * - score setorial: capacidade financeira observada, com peso > 0, e pesos somando 1 entre os observados;
 * - página de UF carrega o bloco de emprego com posições;
 * - a SPA registra a aba em todos os mapas e o pipeline registra coletor e gold.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("emprego.json") ?? { disponivel: false };
const S = lerGold("sectors.json");
const U = lerGold("ufs.json");
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!D.disponivel)("emprego.json: Brasil", () => {
  const B = D.brasil;
  it("estoque, saldos e variação a/a são coerentes entre si e com a série", () => {
    expect(B.estoque).toBeGreaterThan(30e6);
    const ser = D.serie;
    const ult = ser[ser.length - 1], ant = ser[ser.length - 2], ant12 = ser[ser.length - 13];
    expect(ult.ref).toBe(D.mes);
    expect(ult.estoque).toBe(B.estoque);
    expect(ult.saldo).toBeCloseTo(ult.estoque - ant.estoque, 6);
    expect(B.saldo_12m).toBeCloseTo(ult.estoque - ant12.estoque, 6);
    expect(B.yoy_pct).toBeCloseTo((ult.estoque / ant12.estoque - 1) * 100, 1);
    expect(D.mes_preliminar).toBe(true);
  });
  it("admissões − desligamentos do Ipeadata fecha com a variação do estoque do SGS (reconciliação publicada)", () => {
    expect(D.reconciliacao).toBeTruthy();
    expect(D.reconciliacao.mes).toBe(D.mes);
    expect(D.reconciliacao.saldo_ipea).toBeCloseTo(B.admissoes_mes - B.desligamentos_mes, 6);
    expect(Math.abs(D.reconciliacao.diferenca)).toBeLessThanOrEqual(Math.abs(B.saldo_mes) * 0.02 + 100);
  });
});

describe.skipIf(!D.disponivel)("emprego.json: seções CNAE", () => {
  const setores = D.setores as any[];
  const total = setores.find((s) => s.key === "total");
  const porKey = Object.fromEntries(setores.map((s) => [s.key, s]));
  it("seções não agregadas + não itemizado = total; agregados somam suas partes", () => {
    const soma_secoes = soma(setores.filter((s) => !s.agregado && s.key !== "total"), "estoque");
    expect(soma_secoes + D.brasil.nao_itemizado).toBeCloseTo(total.estoque, 3);
    expect(porKey.SIUP.estoque).toBeCloseTo(porKey.D.estoque + porKey.E.estoque, 3);
    const servicos = ["H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "S"].reduce((acc, k) => acc + porKey[k].estoque, 0);
    expect(porKey.SERV.estoque).toBeGreaterThanOrEqual(servicos); // R, T e U não itemizadas ficam dentro de Serviços
    // o resíduo sem seção (total − grandes grupos) é publicado e fica em dezenas de vínculos, nunca em milhares
    const grupos = ["A", "B", "C", "SIUP", "F", "G", "SERV"].reduce((acc, k) => acc + porKey[k].estoque, 0);
    expect(D.brasil.nao_classificado).toBeCloseTo(total.estoque - grupos, 3);
    expect(Math.abs(D.brasil.nao_classificado)).toBeLessThan(1000);
    expect(D.brasil.nao_itemizado - (porKey.SERV.estoque - servicos)).toBeCloseTo(D.brasil.nao_classificado, 3);
  });
  it("z-score com janela declarada, mínimo de observações e faixa coerente; secoes_z espelha as seções", () => {
    expect(D.janela_z.inicio).toBe("2013-01");
    for (const s of setores) {
      if (s.z == null) continue;
      expect(s.n_obs_z).toBeGreaterThanOrEqual(D.janela_z.min_obs);
      expect(s.z).toBeCloseTo((s.yoy_pct - s.yoy_media_janela) / s.yoy_dp_janela, 0);
      const faixa = s.z <= -1 ? "contração" : s.z < -0.5 ? "fraco" : s.z <= 0.5 ? "na média" : s.z < 1 ? "forte" : "aquecido";
      expect(s.faixa).toBe(faixa);
      if (s.key !== "total") expect(D.secoes_z[s.key]).toBe(s.z);
    }
    expect(D.secoes_z.total).toBeUndefined();
    expect(Object.keys(D.secoes_z).length).toBe(setores.length - 1);
  });
  it("share das seções soma 100 menos o não itemizado", () => {
    const share = soma(setores.filter((s) => !s.agregado && s.key !== "total"), "share_pct");
    expect(share + D.brasil.nao_itemizado_pct).toBeCloseTo(100, 0);
  });
});

describe.skipIf(!D.disponivel || !D.ufs)("emprego.json: UFs", () => {
  const ufs = D.ufs as any[];
  it("27 UFs, saldo = admissões − desligamentos, a soma das UFs fecha com o Brasil, posições de 1 a 27", () => {
    expect(ufs.length).toBe(27);
    for (const u of ufs) {
      expect(u.saldo_mes).toBeCloseTo(u.admissoes_mes - u.desligamentos_mes, 6);
      expect(u.saldo_12m).toBeCloseTo(u.admissoes_12m - u.desligamentos_12m, 6);
      expect(u.retencao_pct).toBeCloseTo((u.saldo_12m / u.admissoes_12m) * 100, 1);
      expect(u.regiao).toBeTruthy();
    }
    // Brasil − 27 UFs = vínculos sem UF identificada, publicados e pequenos (abaixo de 0,1% do mês)
    const ni = D.ufs_nao_identificado;
    expect(soma(ufs, "admissoes_mes") + ni.admissoes).toBeCloseTo(D.brasil.admissoes_mes, 3);
    expect(soma(ufs, "desligamentos_mes") + ni.desligamentos).toBeCloseTo(D.brasil.desligamentos_mes, 3);
    expect(Math.abs(ni.admissoes)).toBeLessThan(D.brasil.admissoes_mes * 0.001);
    expect(Math.abs(soma(ufs, "desligamentos_12m") - D.brasil.desligamentos_12m)).toBeLessThan(D.brasil.desligamentos_12m * 0.001);
    const pos = ufs.map((u) => u.posicoes.saldo_12m).sort((a, b) => a - b);
    expect(pos).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
  });
});

describe.skipIf(!S || !S.emprego_ref)("sectors.json: capacidade financeira observada com o Caged", () => {
  it("todo setor tem capacidade financeira observada, com peso > 0, pesos dos observados somando 1 e RJ demonstrativo com peso zero", () => {
    expect(S.emprego_ref).toBe(D.mes);
    for (const s of S.setores) {
      const c = s.componentes;
      expect(c.capacidade_financeira.status).toBe("observado");
      expect(c.capacidade_financeira.peso).toBeGreaterThan(0);
      expect(c.capacidade_financeira.fonte).toMatch(/Novo Caged/);
      expect(c.estresse_empresarial.status).toBe("demonstrativo");
      expect(c.estresse_empresarial.peso).toBe(0);
      const soma_pesos = Object.values(c).filter((x: any) => x.status === "observado").reduce((a: number, x: any) => a + x.peso, 0);
      expect(soma_pesos).toBeCloseTo(1, 2);
      const z = Object.values(c).reduce((a: number, x: any) => a + x.z * x.peso, 0);
      expect(s.score).toBeCloseTo(Math.max(0, Math.min(100, 50 + 20 * z)), 0);
    }
    expect(S.metodo).toMatch(/capacidade financeira/);
    expect(S.aviso_demo).not.toMatch(/capacidade financeira/);
  });
  it("as divisões da transformação herdam a seção C e a extrativa herda B", () => {
    const porCod = Object.fromEntries(S.setores.map((s: any) => [s.codigo, s]));
    const zC = -D.secoes_z.C, zB = -D.secoes_z.B;
    expect(porCod["129316"].componentes.capacidade_financeira.z).toBeCloseTo(zC, 1);
    expect(porCod["129317"].componentes.capacidade_financeira.z).toBeCloseTo(zC, 1);
    expect(porCod["129315"].componentes.capacidade_financeira.z).toBeCloseTo(zB, 1);
    expect(porCod["129314"].componentes.capacidade_financeira.z).toBeCloseTo((zB + zC) / 2, 1);
  });
});

describe.skipIf(!U || !U.disponivel || !D.disponivel)("ufs.json: bloco de emprego nas páginas por UF", () => {
  it("cada UF carrega saldo, admissões, desligamentos e retenção do painel de emprego, com posições", () => {
    const porUF = Object.fromEntries((D.ufs || []).map((u: any) => [u.uf, u]));
    for (const u of U.ufs) {
      expect(u.emprego).toBeTruthy();
      expect(u.emprego.saldo_12m).toBe(porUF[u.uf].saldo_12m);
      expect(u.posicoes["emprego.saldo_12m"]).toBeGreaterThanOrEqual(1);
      expect(u.posicoes["emprego.saldo_12m"]).toBeLessThanOrEqual(27);
    }
    expect(U.datas.emprego).toBe(D.ufs_mes);
    expect(U.fontes.join(" ")).toMatch(/Novo Caged/);
  });
});

describe("SPA: aba registrada em todos os mapas", () => {
  it("rota, título, render, dados, vintage, coletores, chunk, guia, estado e HTML", () => {
    expect(app).toContain('emprego: "/formal-employment"');
    expect(app).toContain('emprego: "Emprego formal"');
    expect(app).toContain('emprego: "renderEmprego"');
    expect(app).toContain('emprego: ["emprego"]');
    expect(app).toContain('emprego: "caged"');
    expect(app).toContain('emprego: ["bcb_sgs", "ipea_caged"]');
    expect(app).toContain('emprego: "emergentes"');
    expect(app).toMatch(/\n  emprego: \{ q: "[^"]+\?"/);
    expect(app).toContain("state.emp = {");
    expect(html).toContain('data-view="emprego">Emprego formal</button>');
    expect(html).toContain('id="view-emprego"');
    expect(app).toContain('["emprego", "Emprego formal", "emprego"]');
    expect(app).toContain('["#uf-emprego", "Emprego"]');
  });
  it("o renderizador vive no chunk emergentes e o pipeline registra coletor, gold e vintage", () => {
    const k = app.indexOf("function renderEmprego(");
    expect(k).toBeGreaterThan(app.indexOf("/* @chunk:emergentes:ini */"));
    expect(k).toBeLessThan(app.indexOf("/* @chunk:emergentes:fim */"));
    expect(read("pipeline/run.py")).toContain('("ipea_caged", ipea_caged)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("emprego.json", r_emp)');
    expect(gold.indexOf('common.write_gold("emprego.json", r_emp)')).toBeLessThan(gold.indexOf("build_sector_stress(con, cfg, RJ_DEMO"));
    expect(gold).toContain('"caged": _vg("SELECT MAX(mes) FROM caged_uf")');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/formal-employment"');
    expect(read("scripts/vigilancia.py")).toContain('"caged": 45');
    const cfg = JSON.parse(read("config/config.json"));
    const emp = cfg.sgs_series.filter((s: any) => s.category === "emprego");
    expect(emp.length).toBe(42);
    expect(emp.map((s: any) => s.code).sort((a: number, b: number) => a - b)).toEqual(Array.from({ length: 42 }, (_, i) => 28763 + i));
  });
  it("o Risco setorial não descreve mais o emprego como demonstrativo", () => {
    expect(app).not.toContain("estresse setorial (RJ/emprego)");
    expect(app).not.toContain("após Caged/RJ setoriais reais");
    expect(read("pipeline/indicators.py")).toContain('PESOS_SCORE = {"atividade": 0.45, "condicoes_credito": 0.20, "capacidade_financeira": 0.15}');
  });
});
