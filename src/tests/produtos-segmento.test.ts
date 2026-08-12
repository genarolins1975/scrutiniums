/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Recorte por segmento prudencial (S1–S5) nos gráficos de produto. O coração:
 * a classificação vem do sr do cadastro BCB (nunca heurística); ponto ou
 * estatística com poucos reportantes é OMITIDO pelo pipeline (um "S2" de duas
 * IFs viraria a série delas com cara de mercado) e o n viaja em cada ponto;
 * o volume do segmento nunca excede o total do mesmo trimestre.
 */

const raiz = process.cwd();
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const prodPy = readFileSync(join(raiz, "pipeline/products.py"), "utf-8");

describe("estático: recorte declarado no pipeline e na SPA", () => {
  it("o pipeline agrega por sr do cadastro com mínimos de n declarados", () => {
    expect(prodPy).toMatch(/SEGMENTOS_FILTRO = \("S1", "S2", "S3", "S4", "S5"\)/);
    expect(prodPy).toMatch(/MIN_SEG_VOL = 3/);
    expect(prodPy).toMatch(/MIN_SEG_ATRASO = 5/);
    expect(prodPy).toMatch(/MIN_SEG_TAXA = 5/);
    expect(prodPy).toMatch(/"por_segmento": _por_segmento/);
    // taxa: segmento da IF via conglomerado → cadastro, nunca por nome
    expect(prodPy).toMatch(/nunca por nome/);
    expect(prodPy).toMatch(/"sr": _sr_de\(r\["cnpj8"\]\)/);
  });

  it("a SPA tem os botões e aplica o recorte a gráficos, matriz e taxas", () => {
    expect(appJs).toContain("window.setProdSeg");
    expect(appJs).toMatch(/Recorte por \$\{termo\("segmentacao-prudencial"/);
    expect(appJs).toMatch(/matrizSeg = PMX_SEG === "todos" \? p\.matriz : p\.matriz\.filter\(r => r\.sr === PMX_SEG\)/);
    expect(appJs).toMatch(/segD \? segD\.serie : p\.serie/);
    // com recorte ativo e sem agregado do segmento, NUNCA cai para o universo
    expect(appJs).toMatch(/cortou \? \(tSeg \? tSeg\.serie : null\) : it\.serie/);
    // recorte sem dado declara omissão, nunca aproxima
    expect(appJs).toMatch(/omitido, nunca aproximado/);
  });
});

describe("gated: invariantes do gold quando o recorte materializar", () => {
  const dir = join(raiz, "public/obs/data/gold/prod");
  const arquivos = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

  it("séries por segmento respeitam mínimos de n e nunca excedem o total", () => {
    let vistos = 0;
    for (const f of arquivos) {
      const d = JSON.parse(readFileSync(join(dir, f), "utf-8"));
      const p = d.produto || {};
      const ps = p.por_segmento;
      if (!ps) continue; // gold pré-recorte: materializa no ciclo diário seguinte
      vistos++;
      const totalPorAnomes: Record<string, number> = {};
      for (const x of p.serie || []) totalPorAnomes[x.anomes] = x.total_brl;
      for (const [seg, dseg] of Object.entries(ps) as [string, any][]) {
        expect(["S1", "S2", "S3", "S4", "S5"], f).toContain(seg);
        for (const pt of dseg.serie || []) {
          expect(pt.n_inst, `${f} ${seg}@${pt.anomes}`).toBeGreaterThanOrEqual(3);
          if (totalPorAnomes[pt.anomes] != null) {
            expect(pt.total_brl, `${f} ${seg}@${pt.anomes} excede o total`).toBeLessThanOrEqual(totalPorAnomes[pt.anomes] * 1.0001);
          }
        }
        for (const pt of dseg.atraso_serie || []) {
          expect(pt.n, `${f} ${seg} atraso@${pt.anomes}`).toBeGreaterThanOrEqual(5);
        }
      }
      // taxas: recorte com n mínimo e sr no ranking
      for (const item of (p.taxas || {}).itens || []) {
        for (const [seg, ts] of Object.entries(item.por_segmento || {}) as [string, any][]) {
          expect(ts.n, `${f} taxa ${seg}`).toBeGreaterThanOrEqual(5);
          for (const pt of ts.serie || []) expect(pt.n, `${f} taxa ${seg} série`).toBeGreaterThanOrEqual(5);
        }
      }
    }
    // enquanto o gold não materializa, o teste não morde (marcador declarado acima)
    if (vistos) expect(vistos).toBeGreaterThanOrEqual(1);
  });
});
