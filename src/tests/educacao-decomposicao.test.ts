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
    let conferidos = 0;
    for (const s of ["SE", "SP", "RR"]) {
      const a = uf(s);
      for (const m of a.municipios) {
        for (const e of ["ai", "af"] as const) {
          const serie = m[e].municipal;
          for (const v of m.analises[e].variacoes) {
            const calc = decompor(serie!, v[0], v[1])!;
            expect(calc, `${m.id} ${e} ${v[0]}-${v[1]}`).not.toBeNull();
            for (let k = 2; k < 6; k++) expect(calc[k]).toBeCloseTo(v[k] as number, 9);
            if (v[6] === null) expect(calc[6], `${m.id} ${e}`).toBeNull();
            else expect(calc[6]).toBeCloseTo(v[6], 9);
            if (v[7] === null) expect(calc[7]).toBeNull();
            else expect(calc[7]).toBeCloseTo(v[7], 9);
            conferidos++;
          }
        }
      }
    }
    expect(conferidos).toBeGreaterThan(1000);
  });

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
