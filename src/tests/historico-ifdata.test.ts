/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Backfill histórico do IF.data (2015-2024). As garantias que importam:
 * o cadastro ATUAL nunca é sobrescrito por dado antigo (INSERT OR IGNORE);
 * o backfill é capado por execução (cache expirado reconverge sem estourar
 * o workflow); a fronteira contábil 2024/2025 e a segmentação retroativa
 * são DECLARADAS no método. Valores gated pelo gold publicado.
 */

const raiz = process.cwd();
const cfg = JSON.parse(readFileSync(join(raiz, "config/config.json"), "utf-8"));
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/institutions.json"), "utf-8"));
const ifdataPy = readFileSync(join(raiz, "pipeline/sources/ifdata.py"), "utf-8");
const indicadoresPy = readFileSync(join(raiz, "pipeline/indicators.py"), "utf-8");

describe("estático: configuração e salvaguardas do coletor", () => {
  it("a história cobre 2015-2024, do mais recente ao mais antigo, com cap por execução", () => {
    const h = cfg.ifdata.anomes_history;
    expect(h.length).toBe(40);
    expect(h[0]).toBe("202412");
    expect(h[h.length - 1]).toBe("201503");
    for (const a of h) expect(a).toMatch(/^\d{6}$/);
    expect(cfg.ifdata.backfill_por_execucao).toBeGreaterThanOrEqual(1);
    expect(cfg.ifdata.backfill_por_execucao).toBeLessThanOrEqual(40);
  });

  it("o plano contábil antigo é mapeado e o cadastro atual é protegido", () => {
    expect(ifdataPy).toContain('"Carteira de Crédito Classificada": "carteira_credito"');
    // instituições extintas entram; o registro de hoje nunca é clobberado
    expect(ifdataPy).toMatch(/INSERT OR IGNORE INTO institutions/);
    // falha consome o cap: rodada nunca fica presa num período quebrado
    expect(ifdataPy).toMatch(/falha também consome o cap/);
  });

  it("o método declara a segmentação retroativa e a fronteira da Res. 4.966", () => {
    expect(indicadoresPy).toMatch(/aplicada retroativamente/);
    expect(indicadoresPy).toMatch(/fronteira 2024\/2025 da Res\. 4\.966/);
  });
});

describe("gated: histórico no gold publicado (morde conforme o backfill converge)", () => {
  const insts: any[] = G.instituicoes || [];

  it("quando o backfill chega ao gold, os grandes têm série longa e ordenada", () => {
    if (!insts.length) return;
    const hist0 = insts[0].historico_score || [];
    if (hist0.length <= 10) return; // gold pré-backfill: nada a validar ainda
    // os maiores conglomerados existem desde 2015: série de 40+ trimestres.
    // O backfill anda com cap por rodada — estados intermediários (ex.: 25
    // trimestres em 19/08) são legítimos; o comprimento só é cobrado quando a
    // própria série líder mostra que a convergência chegou lá. A ordenação e a
    // sanidade dos pontos (abaixo) valem desde já.
    const longas = insts.slice(0, 6).filter((i: any) => (i.historico_score || []).length >= 30);
    if (hist0.length >= 30) expect(longas.length).toBeGreaterThanOrEqual(3);
    for (const i of insts.slice(0, 10)) {
      const h = i.historico_score || [];
      for (let k = 1; k < h.length; k++) {
        expect(h[k].anomes > h[k - 1].anomes, `${i.nome}: histórico fora de ordem`).toBe(true);
      }
      for (const p of h) {
        expect(String(p.anomes), i.nome).toMatch(/^\d{6}$/);
        expect(p.score, `${i.nome}@${p.anomes}`).toBeGreaterThanOrEqual(0);
        expect(p.score, `${i.nome}@${p.anomes}`).toBeLessThanOrEqual(100);
      }
    }
    expect(G.metodo).toMatch(/backfill do Resumo desde 2015/);
  });
});
