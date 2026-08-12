/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Item 6: cooperativas no corte + interconexão interfinanceira.
 * O coração: classificação por TCB do próprio BCB (nunca heurística de
 * nome); dep_total é a SOMA declarada das cinco famílias (o lid de total
 * não existe na fonte); interconexão é PROXY do passivo (matriz bilateral
 * não é pública) e interfinanceiro alto em central cooperativa é desenho,
 * não fragilidade.
 */

const raiz = process.cwd();
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/institutions.json"), "utf-8"));
const indicadoresPy = readFileSync(join(raiz, "pipeline/indicators.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: fallback do total de depósitos e seções da SPA", () => {
  it("dep_total é a soma das famílias quando o lid de total falta — declarado", () => {
    expect(indicadoresPy).toMatch(/o total é a SOMA das cinco famílias/);
    expect(indicadoresPy).toMatch(/partes_dep = \[m\.get\(k\) for k in rotulos/);
  });

  it("filtro por tipo usa a TCB do BCB, nunca heurística de nome", () => {
    expect(appJs).toMatch(/tipoDe = \(i\) => \/\^B3\/\.test\(i\.tcb/);
    expect(appJs).toContain("Cooperativas de crédito no corte");
  });

  it("interconexão declara proxy e o desenho das centrais", () => {
    expect(appJs).toContain("Interconexão — funding interfinanceiro");
    expect(appJs).toMatch(/matriz bilateral \(quem deve a quem\) não é pública/);
    expect(appJs).toMatch(/DESENHO do sistema/);
    expect(appJs).toMatch(/nunca ler esta tabela como ranking de risco/);
  });
});

describe("gated: gold publicado", () => {
  const insts: any[] = G.instituicoes || [];

  it("cooperativas presentes no corte com TCB B3", () => {
    const coops = insts.filter((i: any) => /^B3/.test(i.tcb || ""));
    if (insts.length <= 30) return; // gold pré-expansão
    expect(coops.length).toBeGreaterThanOrEqual(10);
    for (const c of coops) expect(["B3C", "B3S"], c.nome).toContain(c.tcb);
  });

  it("quando o mix de depósitos materializar, soma ~100% e interfinanceiro existe", () => {
    const comMix = insts.filter((i: any) => i.captacao && i.captacao.mix_depositos_pct);
    if (!comMix.length) return; // morde após o próximo ciclo diário (fallback do dep_total)
    let comInterf = 0;
    for (const i of comMix) {
      const soma = (Object.values(i.captacao.mix_depositos_pct) as number[]).reduce((s, v) => s + v, 0);
      expect(soma, i.nome).toBeGreaterThan(97);
      expect(soma, i.nome).toBeLessThan(103);
      if (i.captacao.mix_depositos_pct.interfinanceiro != null) comInterf++;
    }
    expect(comInterf).toBeGreaterThanOrEqual(5);
  });
});
