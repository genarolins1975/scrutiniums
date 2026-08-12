/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Ficha da IF completa: guidance × realizado, TI, remuneração e folha na
 * página da instituição. O coração: a junção é pela RAIZ do CNPJ da
 * companhia listada (cadastro CVM, emitida no bloco operacional) — nunca
 * por nome; cada sub-bloco só aparece quando a IF tem o dado; e a régua
 * do guidance é UM bloco compartilhado entre a aba e a ficha, para as
 * duas superfícies nunca divergirem.
 */

const raiz = process.cwd();
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const operPy = readFileSync(join(raiz, "pipeline/operacional.py"), "utf-8");
const OP = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/operacional.json"), "utf-8"));
const G = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/guidance.json"), "utf-8"));

describe("estático: junção declarada e seções da ficha", () => {
  it("o pipeline emite o cnpj8 da holding listada, separado do cnpj8 da rede", () => {
    expect(operPy).toMatch(/cnpj8 = raiz do CNPJ da COMPANHIA LISTADA/);
    expect(operPy).toMatch(/"cnpj8": c\["cnpj8"\]/);
  });

  it("a ficha monta as seções por cnpj8 e a página as carrega", () => {
    for (const fn of ["instListadaSecao", "instGuidanceIF", "instTiIF", "instRemuneracaoIF", "instFolhaIF", "instRegimeAviso"]) {
      expect(appJs, fn).toContain(`function ${fn}(`);
    }
    expect(appJs).toMatch(/listadaSec = instListadaSecao\(pg, cab\)/);
    // gold necessários declarados no VIEW_DATA da página da IF
    expect(appJs).toMatch(/inst: \[[^\]]*"guidance"[^\]]*\]/);
    expect(appJs).toMatch(/inst: \[[^\]]*"folha_bancos"[^\]]*\]/);
    expect(appJs).toMatch(/inst: \[[^\]]*"regimes"[^\]]*\]/);
  });

  it("a régua do guidance é compartilhada (um único bloco por ciclo)", () => {
    expect(appJs).toContain("function guidCicloBloco(");
    expect(appJs.split("guidCicloBloco").length - 1).toBeGreaterThanOrEqual(3); // def + aba + ficha
  });

  it("as cautelas centrais estão na ficha", () => {
    expect(appJs).toMatch(/nunca compare os valores entre instituições/);
    expect(appJs).toMatch(/nunca por nome/);
  });
});

describe("gated: gold publicado com a chave de junção", () => {
  it("todo perfil operacional carrega cnpj8 (ou null declarado)", () => {
    const insts: any[] = OP.instituicoes || [];
    expect(insts.length).toBeGreaterThanOrEqual(20);
    for (const r of insts) expect("cnpj8" in r, r.id).toBe(true);
    const com = insts.filter((r: any) => /^\d{8}$/.test(r.cnpj8 || ""));
    expect(com.length).toBeGreaterThanOrEqual(20);
  });

  it("os bancos com guidance existem no perfil operacional com o MESMO cnpj8", () => {
    const porCnpj8 = new Set((OP.instituicoes || []).map((r: any) => r.cnpj8));
    for (const c of G.ciclos || []) {
      expect(porCnpj8.has(c.cnpj8), `${c.id} (${c.cnpj8}) sem elo no perfil operacional`).toBe(true);
    }
  });

  it("remuneração e TI juntam pelo mesmo cnpj8 da holding", () => {
    const porCnpj8 = new Set((OP.instituicoes || []).map((r: any) => r.cnpj8));
    for (const e of OP.remuneracao.empresas || []) {
      expect(porCnpj8.has(e.cnpj8), `remuneração ${e.nome}`).toBe(true);
    }
    for (const o of OP.custos_ti.observacoes || []) {
      expect(porCnpj8.has(o.cnpj8), `TI ${o.banco}`).toBe(true);
    }
  });
});
