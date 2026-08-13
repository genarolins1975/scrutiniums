/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * P1 rodada 2 da auditoria de 12/08: bloco "O que mudou" na Visão geral,
 * ordem narrativa da Penetração (mapa antes dos agregados), CSV e flag de
 * divergência de métodos nos rankings, e presets dinâmicos do comparador.
 * O que estes testes travam: régua declarada no consolidado de novidades,
 * presets calculados dos gold (nunca listas de nomes), e a divergência de
 * sinal entre os dois métodos de gap sempre sinalizada, nunca escondida.
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const overview = JSON.parse(read("public/obs/data/gold/overview.json"));

describe("overview.novidades: o diff editorial da execução", () => {
  it("bloco publicado com itens, tipos conhecidos e régua declarada", () => {
    const N = overview.novidades;
    expect(N).toBeTruthy();
    expect(N.itens.length).toBeGreaterThan(0);
    expect(N.itens.length).toBeLessThanOrEqual(8);
    for (const n of N.itens) {
      expect(["alerta_novo", "regime", "recorde", "guidance"]).toContain(n.tipo);
      expect(n.titulo).toBeTruthy();
      expect(n.link?.view).toBeTruthy();
    }
    // a régua é parte do dado: sem ela o bloco vira "curadoria invisível"
    expect(N.nota).toMatch(/regra determinística/);
    expect(N.nota).toMatch(/a ordem não é gravidade/);
  });

  it("a SPA monta o bloco no padrão dos demais (ligado por padrão, graceful sem o campo)", () => {
    expect(app).toMatch(/\["novidades", "O que mudou", true\]/);
    expect(app).toContain("const secNovidades = !NOV || !(NOV.itens || []).length ? \"\"");
    expect(app).toContain("novidades: secNovidades,");
  });
});

describe("penetração: ordem narrativa, CSV e divergência de métodos", () => {
  it("a página abre no mapa: aviso+filtros+mapa antes dos agregados (ponte e perfil no meio)", () => {
    // ordem narrativa por posição das partes — tolerante a inserções (a ponte
    // para o Panorama entrou entre o mapa e o perfil na rodada P2)
    const asm = app.slice(app.indexOf("function renderPenetracao"));
    const seq = ["+ avisoPen + filtros + mapa", "+ perfil + cards + cobertura + dispersao + rankings + achados + metodo_sec;"];
    let pos = -1;
    for (const parte of seq) {
      const k = asm.indexOf(parte);
      expect(k, parte).toBeGreaterThan(pos);
      pos = k;
    }
  });

  it("o CSV do ranking exporta os dois métodos de gap e a coluna de divergência", () => {
    expect(app).toContain("window.penRankCSV");
    for (const col of ["gap_abs_modelo", "gap_rel_modelo", "gap_abs_pares", "gap_rel_pares"]) {
      expect(app.slice(app.indexOf("window.penRankCSV"))).toContain(col);
    }
    expect(app).toContain("metodos_divergem");
  });

  it("divergência = sinais opostos entre modelo e pares, e a marcação aparece na tabela", () => {
    expect(app).toMatch(/\(m\.gap_rel_modelo > 0\) !== \(m\.gap_rel_pares > 0\)/);
    expect(app).toContain("métodos divergem");
  });
});

describe("comparador: presets dinâmicos, nunca listas de nomes", () => {
  it("os três presets existem e são calculados dos gold no clique", () => {
    const bloco = app.slice(app.indexOf("window.cmpPreset"), app.indexOf("window.cmpPreset") + 2200);
    expect(bloco).toContain("startsWith(\"B3\")"); // coops via TCB, nunca por nome
    expect(bloco).toContain("i.sr === seg"); // S2/S3 via segmento do índice
    expect(bloco).toMatch(/ativo_total_brl.*-.*ativo_total_brl|b\.ativo_total_brl \|\| 0\) - \(a\.ativo_total_brl/);
    // nível único por preset: só conglomerado prudencial nos segmentos
    expect(bloco).toContain("i.cod.startsWith(\"C\")");
    // nenhum nome de instituição embutido no preset
    expect(bloco).not.toMatch(/Sicoob|Sicredi|Nubank|Itaú|Bradesco/i);
  });

  it("o comparador declara a dependência do gold de instituições", () => {
    expect(app).toMatch(/compare: \["compare", "inst_index", "operacional", "institutions"\]/);
  });

  it("botões dos presets no seletor", () => {
    expect(app).toContain("cmpPreset('coops')");
    expect(app).toContain("cmpPreset('s2')");
    expect(app).toContain("cmpPreset('s3')");
  });
});
