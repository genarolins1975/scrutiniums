/* eslint-disable @typescript-eslint/no-explicit-any -- validação estática da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Kit padronizado (P2 da auditoria: "inconsistência de utilitários").
 * O que se trava: UM helper de download (o alias legado delega); rótulos de
 * exportação sempre no padrão "baixar FORMATO (qualificador)" — o verbo
 * "exportar" não sobrevive em botão; a regra de tooltips documentada com o
 * helper dica(); e as âncoras do kit nas páginas densas que faltavam
 * (Panorama e Metodologia).
 */
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");

describe("exportação: helper único e rótulos padronizados", () => {
  it("download() é alias de dlFile() — uma só implementação, revoke adiado", () => {
    expect(app).toContain("function download(name, content, mime) { dlFile(name, content, mime); }");
    expect(app).toMatch(/setTimeout\(\(\) => URL\.revokeObjectURL\(url\), 4000\);/);
    // a implementação antiga com revoke imediato não existe mais
    expect(app).not.toMatch(/a\.click\(\); URL\.revokeObjectURL/);
  });

  it("nenhum botão diz 'exportar FORMATO' — o verbo padrão é 'baixar'", () => {
    expect(app).not.toMatch(/>exportar (CSV|JSON|XLSX|\(JSON\)|planilha|dados)</);
    expect(app).not.toContain(">exportar ▾<");
    // e o padrão positivo existe em volume
    const baixar = app.match(/>baixar (CSV|JSON|XLSX)/g) || [];
    expect(baixar.length).toBeGreaterThanOrEqual(15);
  });
});

describe("tooltips: uma regra, um helper", () => {
  it("dica() existe com a regra documentada (title curto; data-tip só em gráfico)", () => {
    expect(app).toContain("const dica = txt =>");
    expect(app).toMatch(/data-tip \(tooltip rico\) SOMENTE dentro de gráficos/);
    // adotado nos pontos convertidos
    const usos = app.match(/\$\{dica\(/g) || [];
    expect(usos.length).toBeGreaterThanOrEqual(5);
  });
});

describe("âncoras: as páginas densas que faltavam", () => {
  it("Panorama tem subnav fixa e seções ancoradas", () => {
    expect(app).toMatch(/\[\["#pan-mapa", "Mapa"\], \["#pan-comp", "Comparação"\]/);
    for (const id of ["pan-mapa", "pan-comp", "pan-perfis", "pan-alertas", "pan-exp", "pan-met"]) {
      expect(app).toContain(`secWrap("${id}"`);
    }
  });

  it("Metodologia tem subnav fixa e cabeçalhos ancorados", () => {
    expect(app).toMatch(/\[\["#met-catalogo", "Catálogo"\]/);
    for (const id of ["met-catalogo", "met-dicionario", "met-models", "met-scores", "met-versoes", "met-linhagem", "met-refs"]) {
      expect(app).toContain(`id="${id}"`);
    }
  });
});
