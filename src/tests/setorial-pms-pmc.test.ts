/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * PMS/PMC no risco setorial (último P1 do Top 10 — "país de serviços sem
 * serviços"). O que se trava: as três pesquisas convivem na mesma régua
 * (volume 2022=100, sem ajuste sazonal), os totais das pesquisas ficam FORA
 * (total não é setor), os recortes duplicados do PMC não entram, o score
 * continua 100% observado, e a SPA agrupa por pesquisa em vez de misturar
 * universos numa lista única.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const sectors = JSON.parse(read("public/obs/data/gold/sectors.json"));
const app = read("public/obs/app.js");

describe("sectors.json: as três pesquisas", () => {
  const por = (p: string) => sectors.setores.filter((s: any) => s.pesquisa === p);

  it("indústria, serviços e comércio presentes, com tamanhos plausíveis", () => {
    expect(por("industria").length).toBeGreaterThanOrEqual(20);
    expect(por("servicos").length).toBe(5); // os 5 grandes grupos da PMS
    expect(por("comercio").length).toBeGreaterThanOrEqual(9);
    for (const s of sectors.setores) {
      expect(["industria", "servicos", "comercio"]).toContain(s.pesquisa);
    }
  });

  it("nenhum 'Total' de pesquisa vira setor, e os recortes duplicados do PMC ficam fora", () => {
    for (const s of sectors.setores) {
      expect(s.nome.trim().toLowerCase(), s.codigo).not.toBe("total");
    }
    const codigos = new Set(sectors.setores.map((s: any) => s.codigo));
    // subrecortes do PMC (hiper/super; móveis; eletros) duplicariam a mãe
    for (const dup of ["pmc_103154", "pmc_31555", "pmc_31556"]) {
      expect(codigos.has(dup), dup).toBe(false);
    }
  });

  it("PMS entra pelos 5 grandes grupos numerados, com código prefixado único", () => {
    for (const s of sectors.setores.filter((x: any) => x.pesquisa === "servicos")) {
      expect(s.nome).toMatch(/^\d\. /);
      expect(s.codigo).toMatch(/^pms_/);
    }
    for (const s of sectors.setores.filter((x: any) => x.pesquisa === "comercio")) {
      expect(s.codigo).toMatch(/^pmc_/);
    }
  });

  it("o score segue 100% observado, com a fonte de atividade da própria pesquisa", () => {
    for (const s of sectors.setores) {
      const at = s.componentes.atividade;
      expect(at.status).toBe("observado");
      const esperado = { industria: /PIM/, servicos: /PMS/, comercio: /PMC/ }[s.pesquisa as string];
      expect(at.fonte, s.codigo).toMatch(esperado as RegExp);
      // invariante transversal: nenhum demonstrativo com peso > 0
      for (const c of Object.values<any>(s.componentes)) {
        if (c.status === "demonstrativo") expect(c.peso).toBe(0);
      }
    }
  });

  it("séries longas e recentes nas três pesquisas", () => {
    for (const s of sectors.setores) {
      expect(s.serie_obs.length, s.codigo).toBeGreaterThanOrEqual(36);
      expect(s.ref >= "2026-01-01", `${s.codigo} ref ${s.ref}`).toBe(true);
    }
  });

  it("método e limitações declaram a régua comum e a seleção", () => {
    expect(sectors.metodo).toMatch(/PMS para\s+serviços/);
    expect(sectors.metodo).toMatch(/PMC para o varejo ampliado/);
    expect(sectors.metodo).toMatch(/totais das pesquisas ficam fora/);
    expect(sectors.limitacoes).toMatch(/VOLUME de atividade, não inadimplência/);
    expect(sectors.limitacoes).toMatch(/Universos distintos por pesquisa/);
  });
});

describe("app.js: agrupamento por pesquisa", () => {
  it("a tabela é agrupada por pesquisa, nunca uma lista única de universos misturados", () => {
    expect(app).toContain('["industria", "Indústria — produção física (PIM-PF)"]');
    expect(app).toContain('["servicos", "Serviços — volume (PMS)"]');
    expect(app).toContain('["comercio", "Comércio varejista ampliado — volume de vendas (PMC)"]');
    expect(app).toMatch(/z-score compara cada[\s\S]{0,40}setor com a própria história/);
  });

  it("a ficha do setor rotula a medida pela pesquisa (volume nunca vira 'produção')", () => {
    expect(app).toContain('servicos: { medida: "Volume de serviços"');
    expect(app).toContain('comercio: { medida: "Volume de vendas (varejo ampliado)"');
  });
});
