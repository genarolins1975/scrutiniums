/* eslint-disable @typescript-eslint/no-explicit-any -- extração do dicionário de conceitos do bundle da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Camada didática de conceitos. O contrato: todo conceito tem as seis
 * camadas (resumo, intuição, cálculo, história, regulação, armadilhas),
 * a história ancora em ano concreto, as referências cruzadas apontam para
 * conceitos existentes, os infográficos referenciados existem, e os termos
 * estão de fato aplicados nas superfícies do painel.
 */

const raiz = process.cwd();
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const css = readFileSync(join(raiz, "public/obs/styles.css"), "utf-8");

function extrairConceitos(): Record<string, any> {
  const ini = appJs.indexOf("const CONCEITOS = {");
  expect(ini).toBeGreaterThan(-1);
  const fim = appJs.indexOf("\n};", ini);
  const literal = appJs.slice(ini + "const CONCEITOS = ".length, fim + 2);
  // objeto literal puro (strings e arrays) — avaliável sem DOM
  return new Function(`return (${literal})`)();
}

const C = extrairConceitos();
const OBRIGATORIOS = ["nome", "resumo", "intuicao", "calculo", "historia", "regulacao", "armadilhas"];
const NUCLEO = ["roe", "indice-de-basileia", "capital-principal", "rwa", "acp", "alavancagem",
  "lcr", "nsfr", "inadimplencia-90", "atraso-15-90", "ativos-problematicos",
  "provisao-perda-esperada", "carteira-de-credito", "spread", "custo-do-credito",
  "custo-de-captacao", "indice-de-eficiencia", "hhi", "percentil-quartis",
  "score-relativo", "segmentacao-prudencial", "guidance", "pilar-3",
  "regime-de-resolucao", "consignado", "rotativo-do-cartao"];

describe("dicionário de conceitos", () => {
  it("cobre o núcleo do painel", () => {
    for (const slug of NUCLEO) expect(C[slug], slug).toBeTruthy();
    expect(Object.keys(C).length).toBeGreaterThanOrEqual(NUCLEO.length);
  });

  it("todo conceito tem as seis camadas didáticas, substanciais", () => {
    for (const [slug, c] of Object.entries(C) as [string, any][]) {
      for (const campo of OBRIGATORIOS) {
        expect(c[campo], `${slug}.${campo}`).toBeTruthy();
      }
      expect(c.resumo.length, `${slug}: resumo é uma linha`).toBeLessThan(220);
      expect(c.intuicao.length, `${slug}: intuição de verdade, não definição`).toBeGreaterThan(120);
      // história ancorada em ano concreto — nunca "antigamente"
      expect(c.historia, `${slug}: história sem ano`).toMatch(/\b(19|20)\d{2}\b/);
    }
  });

  it("referências cruzadas apontam para conceitos que existem", () => {
    for (const [slug, c] of Object.entries(C) as [string, any][]) {
      for (const v of c.veja || []) expect(C[v], `${slug} → veja ${v}`).toBeTruthy();
    }
  });

  it("infográficos referenciados existem no catálogo IG", () => {
    const igs = [...appJs.matchAll(/^  (\w+): \(\) => `<svg/gm)].map((m) => m[1]);
    expect(igs.length).toBeGreaterThanOrEqual(5);
    for (const [slug, c] of Object.entries(C) as [string, any][]) {
      if (c.infografico) expect(igs, `${slug} → infográfico ${c.infografico}`).toContain(c.infografico);
    }
  });
});

describe("aplicação nas superfícies", () => {
  it("os termos estão espalhados pelo painel, não só no dicionário", () => {
    const usos = appJs.split("${termo(").length - 1;
    expect(usos).toBeGreaterThanOrEqual(12);
    // âncoras que precisam existir
    for (const alvo of ['termo("indice-de-basileia"', 'termo("roe"', 'termo("lcr"',
      'termo("score-relativo"', 'termo("custo-de-captacao"', 'termo("inadimplencia-90"']) {
      expect(appJs, alvo).toContain(alvo);
    }
  });

  it("o modal e o estilo do termo existem, e a Metodologia lista tudo", () => {
    expect(appJs).toContain("window.abrirConceito");
    expect(appJs).toContain("conceitosLista()");
    expect(css).toContain(".termo {");
    expect(css).toContain("#conceitoDlg");
    expect(appJs).toMatch(/Conceitos, do zero/);
  });
});
