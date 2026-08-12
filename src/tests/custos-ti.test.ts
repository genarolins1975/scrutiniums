/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Custos de TI dos bancos (Fase 2) — despesa contábil nas notas das DFP.
 * Os testes negativos são o coração: conceitos/regimes NÃO comparáveis entre
 * bancos (BRGAAP × IFRS; com/sem telecom; "tecnologia e sistemas") — nunca
 * somar, nunca ranquear; e a camada Febraban (orçamento capex+opex) nunca se
 * compara às linhas das DFP. Publica só `aprovado`, com evidência completa.
 * Gold PUBLICADO (public/obs/data/gold) — a lição do consignado.
 */

const raiz = process.cwd();
const cur = JSON.parse(readFileSync(join(raiz, "pipeline/curated/custos_ti.json"), "utf-8"));
const OP = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/operacional.json"), "utf-8"));
const operPy = readFileSync(join(raiz, "pipeline/operacional.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("curadoria: evidência completa e vocabulário de status", () => {
  it("toda observação tem regime, evidência e status do vocabulário", () => {
    expect(cur.observacoes.length).toBeGreaterThanOrEqual(6);
    for (const o of cur.observacoes) {
      expect(["em_revisao", "aprovado", "descartado"], o.id).toContain(o.status);
      expect(o.regime, o.id).toMatch(/BRGAAP|IFRS/);
      expect(o.trecho, o.id).toBeTruthy();
      expect(o.pagina_pdf, o.id).toBeGreaterThan(0);
      expect(typeof o.exclusivo_ti, o.id).toBe("boolean");
      expect(o.valor, o.id).toBeGreaterThan(0);
      expect(o.unidade, o.id).toMatch(/^R\$ (mil|milhões)$/);
      const doc = cur.documentos[o.documento];
      expect(doc, o.id).toBeTruthy();
      expect(doc.url, o.id).toMatch(/^https:\/\/www\.rad\.cvm\.gov\.br\//);
      expect(doc.identidade, o.id).toBeTruthy();
      // aprovado exige revisor registrado — nunca aprovação anônima
      if (o.status === "aprovado") expect(o.revisor, o.id).toBeTruthy();
    }
  });

  it("nenhum campo soma valores entre bancos e o agregado Febraban declara o conceito distinto", () => {
    for (const chave of Object.keys(cur)) {
      expect(chave).not.toMatch(/total_valor|valor_total|soma/);
    }
    const ag = cur.agregado_sistema;
    expect(ag.fonte.url).toMatch(/^https:\/\/portal\.febraban\.org\.br\//);
    expect(ag.fonte.nivel).toBe("A");
    expect(ag.conceito).toMatch(/capex \+ opex/);
    expect(ag.conceito).toMatch(/nunca se comparam/i);
    expect(ag.orcamento_2025_brl).toBeGreaterThan(ag.orcamento_2024_brl);
  });

  it("rubrica mais ampla que TI nunca passa como exclusiva", () => {
    // Itaú inclui telecom; Santander IFRS é 'tecnologia e sistemas'
    const itau = cur.observacoes.find((o: any) => o.id === "itau_ti_2025");
    const santIfrs = cur.observacoes.find((o: any) => o.id === "santander_ti_ifrs_2025");
    expect(itau.exclusivo_ti).toBe(false);
    expect(santIfrs.exclusivo_ti).toBe(false);
  });
});

describe("integração: builder, gold e SPA", () => {
  it("o builder do operacional publica só aprovado", () => {
    expect(operPy).toContain("_bloco_custos_ti");
    expect(operPy).toMatch(/"custos_ti": _bloco_custos_ti\(\)/);
    expect(operPy).toMatch(/status.*==.*"aprovado"/);
  });

  it("gold reconcilia com a curadoria quando o bloco existir (gated: pipeline diário)", () => {
    if (!("custos_ti" in OP)) return; // gold pré-rodada: nada a validar ainda
    const TI = OP.custos_ti;
    if (!TI) return;
    const aprovadas = cur.observacoes.filter((o: any) => o.status === "aprovado");
    const emRevisao = cur.observacoes.filter((o: any) => o.status === "em_revisao");
    expect(TI.observacoes.length).toBe(aprovadas.length);
    expect(TI.em_revisao).toBe(emRevisao.length);
    for (const o of TI.observacoes) {
      expect(o.trecho, o.id).toBeTruthy();
      expect(o.documento.url, o.id).toMatch(/^https:\/\//);
      expect(o.revisor, `${o.id}: aprovado exige revisor registrado`).toBeTruthy();
    }
    const cautelas = (TI.cautelas || []).join(" ");
    expect(cautelas).toMatch(/NUNCA são somados nem ranqueados/);
  });

  it("a SPA renderiza a seção com pendência declarada, nunca tabela inventada", () => {
    expect(appJs).toContain("Quanto custa a TI dos bancos");
    expect(appJs).toMatch(/aguardando revisão\s*\n?\s*editorial/);
    expect(appJs).toContain("agregado_sistema");
  });
});
