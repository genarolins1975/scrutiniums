import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  INDICADORES,
  fmtRefMes,
  fmtValor,
  indicadorPorSlug,
  indicadoresPublicos,
  resumoDiario,
} from "@/lib/dadosPublicos";

/**
 * Camada pública: todo número exposto sem login precisa ser DADO OBSERVADO
 * com fonte e série declaradas — nunca estimado, interpolado ou demo. O
 * catálogo é a fonte única de slugs (páginas estáticas + sitemap).
 */

describe("catálogo de indicadores públicos", () => {
  it("slugs únicos, em kebab-case, com textos completos", () => {
    const slugs = INDICADORES.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const i of INDICADORES) {
      expect(i.slug).toMatch(/^[a-z0-9-]+$/);
      expect(i.definicao.length).toBeGreaterThan(60);
      expect(i.comoLer.length).toBeGreaterThan(40);
      expect(i.limitacoes.length).toBeGreaterThan(40);
    }
  });

  it("todos os indicadores resolvem para séries observadas do pulse", () => {
    const inds = indicadoresPublicos();
    expect(inds.length).toBe(INDICADORES.length);
    for (const i of inds) {
      expect(i.fonte, i.slug).toBe("BCB/SGS");
      expect(i.serieCodigo, i.slug).toMatch(/^\d+$/);
      expect(i.nObs, i.slug).toBeGreaterThan(100);
      expect(Number.isFinite(i.valor), i.slug).toBe(true);
      expect(i.ref > i.primeiraRef, i.slug).toBe(true);
    }
  });

  it("busca por slug e formatação estável", () => {
    const inad = indicadorPorSlug("inadimplencia");
    expect(inad).toBeTruthy();
    expect(fmtValor(inad!, inad!.valor)).toMatch(/%$/);
    const saldo = indicadorPorSlug("saldo-de-credito");
    expect(fmtValor(saldo!, saldo!.valor)).toMatch(/^R\$ .+ (tri|bi)$/);
    expect(indicadorPorSlug("nao-existe")).toBeNull();
    expect(fmtRefMes("2026-05-01")).toBe("mai/2026");
  });
});

describe("resumo diário público", () => {
  it("diagnóstico determinístico com método e mudanças citando fonte e série", () => {
    const r = resumoDiario();
    expect(r).toBeTruthy();
    expect(r!.frase.length).toBeGreaterThan(40);
    expect(r!.metodo).toMatch(/determinístic/i);
    for (const m of [...r!.deterioracoes, ...r!.melhoras]) {
      expect(m.fonte, m.indicador).toBeTruthy();
      expect(m.serie, m.indicador).toBeTruthy();
      expect(Number.isFinite(m.delta1m), m.indicador).toBe(true);
    }
  });
});

describe("integração: rotas públicas registradas", () => {
  it("sitemap referencia /dados, /resumo e o catálogo; header e footer linkam", () => {
    const sitemap = readFileSync(join(process.cwd(), "src/app/sitemap.ts"), "utf-8");
    expect(sitemap).toContain('"/dados"');
    expect(sitemap).toContain('"/resumo"');
    expect(sitemap).toContain("INDICADORES");
    const header = readFileSync(join(process.cwd(), "src/components/layout/PublicHeader.tsx"), "utf-8");
    expect(header).toContain('href: "/dados"');
    const footer = readFileSync(join(process.cwd(), "src/components/layout/Footer.tsx"), "utf-8");
    expect(footer).toContain('href="/resumo"');
  });

  it("páginas estáticas: force-static declarado (nunca fs em runtime serverless)", () => {
    for (const p of ["src/app/dados/page.tsx", "src/app/dados/[slug]/page.tsx", "src/app/resumo/page.tsx"]) {
      const src = readFileSync(join(process.cwd(), p), "utf-8");
      expect(src, p).toContain('export const dynamic = "force-static"');
    }
  });

  it("área logada segue fora da superfície pública (robots)", () => {
    const robots = readFileSync(join(process.cwd(), "src/app/robots.ts"), "utf-8");
    expect(robots).toContain('"/observatorio"');
    expect(robots).toContain('"/app"');
  });
});
