import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decompor, iniciosDosPeriodos, periodos, recortesDecompostos } from "@/lib/educacao/decomposicao";
import type { ArquivoUf, GoldEducacao } from "@/lib/educacao/tipos";

/**
 * Pedido do coordenador da rodada de 24/11/2026: a divisão da mudança do Ideb do Brasil e dos estados é calculada em src/lib a
 * partir da gold, sem tocar o pipeline. Invariantes: a função reproduz, par a par, as variações que o pipeline publicou para os
 * municípios (mesma regra); as parcelas fecham a mudança do produto N × P; ausência nunca vira parcela zero.
 */
const raiz = process.cwd();
const gold = JSON.parse(readFileSync(join(raiz, "public/educacao/gold/educacao.json"), "utf-8")) as GoldEducacao;
const uf = (s: string) => JSON.parse(readFileSync(join(raiz, "public/educacao/gold/municipios", `${s}.json`), "utf-8")) as ArquivoUf;

describe("educação: divisão da mudança do Ideb entre aprendizagem e aprovação", () => {
  it("reproduz as variações publicadas pelo pipeline para todos os municípios de três estados", () => {
    // mesma conferência par a par, com as divergências acumuladas e uma asserção só no fim: dezenas de milhares de expect
    // individuais estouravam o tempo do teste no CI sob carga (24/11/2026)
    const perto = (a: number | null, b: number | null) => (a === null || b === null ? a === b : Math.abs(a - b) < 5e-10);
    const divergencias: string[] = [];
    let conferidos = 0;
    for (const s of ["SE", "SP", "RR"]) {
      const a = uf(s);
      for (const m of a.municipios) {
        for (const e of ["ai", "af"] as const) {
          const serie = m[e].municipal;
          for (const v of m.analises[e].variacoes) {
            const calc = decompor(serie!, v[0], v[1]);
            conferidos++;
            if (!calc) { divergencias.push(`${m.id} ${e} ${v[0]}-${v[1]}: nulo`); continue; }
            for (let k = 2; k < 8; k++) {
              const esperado = (v[k] ?? null) as number | null;
              const obtido = (calc[k] ?? null) as number | null;
              if (!perto(obtido, esperado)) divergencias.push(`${m.id} ${e} ${v[0]}-${v[1]} [${k}]: ${obtido} ≠ ${esperado}`);
            }
          }
        }
      }
    }
    expect(divergencias.slice(0, 20)).toEqual([]);
    expect(conferidos).toBeGreaterThan(1000);
  }, 30_000);

  it("Brasil e estados: parcelas fecham o produto, períodos existem na série e ausência não vira zero", () => {
    const recortes = recortesDecompostos(gold, (s) => s);
    expect(recortes[0].id).toBe("BR");
    expect(recortes.length).toBe(1 + Object.keys(gold.ideb.ufs.ai).length);
    for (const r of recortes) {
      for (const p of r.periodos) {
        expect(gold.ideb.anos).toContain(p.inicio);
        expect(p.fim).toBe(gold.ideb.ano);
        for (const e of p.etapas) {
          expect(Number.isFinite(e.ideb[0]) && Number.isFinite(e.ideb[1])).toBe(true);
          if (e.parcelaN !== null && e.parcelaP !== null) expect(e.parcelaN + e.parcelaP).toBeCloseTo(e.produto[1] - e.produto[0], 10);
          else expect(Math.abs(e.produto[1] - e.produto[0])).toBeLessThan(0.05 + 1e-9);
        }
      }
    }
    // o par padrão (edição mais recente e a de seis anos antes) está entre os períodos
    expect(iniciosDosPeriodos(gold.ideb.anos, gold.ideb.ano)).toContain(gold.ideb.ano - 6);
    // série com lacuna: o período sem N ou P na edição inicial sai, em vez de virar zero
    const k0 = 0;
    const furada = { ...gold.ideb.brasil.ai.municipal, n: gold.ideb.brasil.ai.municipal.n.map((x, i) => (i === k0 ? null : x)) };
    const ps = periodos({ ai: furada, af: null }, gold.ideb.anos, gold.ideb.ano);
    expect(ps.some((p) => p.inicio === gold.ideb.anos[k0])).toBe(false);
  });
});
