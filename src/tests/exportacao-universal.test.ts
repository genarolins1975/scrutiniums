/* eslint-disable @typescript-eslint/no-explicit-any -- leitura do bundle da SPA */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Exportação universal: qualquer página do Observatório baixa uma planilha com o
 * que está na tela mais a procedência do dado. O que este teste protege:
 *
 *  1. o botão vive no cabeçalho comum — nenhuma página nova precisa lembrar dele;
 *  2. a planilha sempre carrega a aba "Sobre" com fonte, data-base e URL, para
 *     que o arquivo continue auditável depois de sair do site;
 *  3. números viram números, mas valores com unidade embutida (%, R$) ficam como
 *     texto — converter apagaria a unidade em silêncio;
 *  4. o bundle minificado servido em produção está em dia com o fonte.
 */
const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const min = readFileSync(join(process.cwd(), "public/obs/app.min.js"), "utf-8");

/** Extrai uma função do fonte da SPA para exercitá-la de verdade aqui. */
function fn(nome: string) {
  const i = app.indexOf(`function ${nome}(`);
  expect(i, `função ${nome} não encontrada`).toBeGreaterThan(-1);
  let profundidade = 0, j = app.indexOf("{", i);
  for (; j < app.length; j++) {
    if (app[j] === "{") profundidade++;
    else if (app[j] === "}" && --profundidade === 0) break;
  }
  return new Function(`${app.slice(i, j + 1)}; return ${nome};`)() as any;
}

describe("exportação universal: presença no cabeçalho comum", () => {
  it("o botão fica no pageHead, então toda página o herda", () => {
    const i = app.indexOf("function pageHead(o) {");
    const cabecalho = app.slice(i, app.indexOf("\nfunction ", i + 10));
    expect(cabecalho).toContain('onclick="exportarPagina()"');
  });

  it("exportarPagina e o escritor multiaba existem e estão expostos", () => {
    expect(app).toContain("window.exportarPagina =");
    expect(app).toContain("function xlsxMulti(");
    expect(app).toContain("function tabelasDaPagina(");
  });

  it("a exportação curada de cada página continua existindo", () => {
    // a universal soma, não substitui: quem já tinha CSV específico mantém
    expect((app.match(/baixar CSV/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

describe("exportação universal: procedência na aba Sobre", () => {
  it("o manifesto declara página, data-base, processamento, fonte e URL", () => {
    const i = app.indexOf("window.exportarPagina");
    const corpo = app.slice(i, app.indexOf("\n};", i));
    for (const campo of ["Página", "Dados até", "Processado em", "Fontes", "URL da consulta", "Pergunta que responde"]) {
      expect(corpo, campo).toContain(campo);
    }
  });

  it("avisa que célula vazia é ausência de dado, nunca zero", () => {
    const i = app.indexOf("window.exportarPagina");
    const corpo = app.slice(i, app.indexOf("\n};", i));
    expect(corpo).toMatch(/ausente na fonte — nunca zero/);
  });

  it("o guia didático não vaza para dentro da planilha", () => {
    expect(app).toContain('no.closest(".guia")');
  });
});

describe("exportação universal: conversão de valores", () => {
  const numeroPtBr = fn("numeroPtBr");

  it("número em pt-BR vira número de verdade", () => {
    expect(numeroPtBr("1.234,56")).toBeCloseTo(1234.56);
    expect(numeroPtBr("2026")).toBe(2026);
    expect(numeroPtBr("-0,47")).toBeCloseTo(-0.47);
    expect(numeroPtBr("2.510.183")).toBe(2510183);
  });

  it("valor com unidade embutida permanece texto (a unidade não se perde)", () => {
    expect(numeroPtBr("29,8%")).toBeNull();
    expect(numeroPtBr("R$ 2,26 tri")).toBeNull();
    expect(numeroPtBr("+13,86%")).toBeNull();
  });

  it("texto, ausência e rótulos ambíguos não viram número", () => {
    for (const v of ["n/d", "", "—", "2026-05", "S1 — grandes", "5 trim.", "1.2.3,4"]) {
      expect(numeroPtBr(v), v).toBeNull();
    }
  });
});

describe("exportação universal: nomes de aba dentro do limite do Excel", () => {
  const nomeAba = fn("nomeAba");

  it("corta em 31 caracteres e remove os caracteres proibidos", () => {
    const usados = new Set<string>();
    const n = nomeAba(usados, "Carteira por UF: crédito [PF/PJ] * 2026?");
    expect(n.length).toBeLessThanOrEqual(31);
    expect(n).not.toMatch(/[\\/?*[\]:]/);
  });

  it("desambigua repetições em vez de sobrescrever a aba", () => {
    const usados = new Set<string>();
    const a = nomeAba(usados, "Inadimplência");
    const b = nomeAba(usados, "Inadimplência");
    expect(a).not.toBe(b);
    expect(b.length).toBeLessThanOrEqual(31);
  });

  it("tabela sem título ainda recebe um nome válido", () => {
    expect(nomeAba(new Set(), "")).toBeTruthy();
  });
});

describe("exportação universal: bundle servido em produção", () => {
  it("o minificado contém a exportação e acompanha a versão do fonte", () => {
    expect(min).toContain("exportarPagina");
    const v = app.match(/const APP_VERSION = "([\d.]+)"/)?.[1];
    expect(v).toBeTruthy();
    expect(min).toContain(`APP_VERSION="${v}"`);
  });

  it("o index.html pede o bundle com o mesmo cache-buster", () => {
    const html = readFileSync(join(process.cwd(), "public/obs/index.html"), "utf-8");
    const v = app.match(/const APP_VERSION = "([\d.]+)"/)?.[1];
    expect(html).toContain(`app.min.js?v=${v}`);
  });
});
