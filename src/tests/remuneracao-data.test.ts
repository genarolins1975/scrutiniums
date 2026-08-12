/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Remuneração da administração (FRE item 8, dataset estruturado da CVM).
 * O coração: realizado ≠ previsto, nunca misturados; o nº de membros viaja
 * junto de toda média; média não é mediana (a maior individual acompanha
 * quando divulgada); ausência estrutural (não listados) não é zero.
 */

const raiz = process.cwd();
const OP = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/operacional.json"), "utf-8"));
const coletorPy = readFileSync(join(raiz, "pipeline/sources/remuneracao.py"), "utf-8");
const operPy = readFileSync(join(raiz, "pipeline/operacional.py"), "utf-8");
const runPy = readFileSync(join(raiz, "pipeline/run.py"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");

describe("estático: coletor e builder", () => {
  it("roda no pipeline diário e no bloco do operacional", () => {
    expect(runPy).toContain('("remuneracao", remuneracao)');
    expect(operPy).toMatch(/"remuneracao": _bloco_remuneracao\(con\)/);
  });

  it("nunca coleta sem filtro e vence a maior versão da reapresentação", () => {
    expect(coletorPy).toMatch(/nunca coletar sem filtro/);
    expect(coletorPy).toMatch(/atual\[0\] >= versao/);
  });

  it("a SPA renderiza a seção com previsto marcado como proposta", () => {
    expect(appJs).toContain("Quanto ganha a administração");
    expect(appJs).toMatch(/proposta aprovada em assembleia/);
    expect(appJs).toMatch(/não é mediana|não mediana/);
  });
});

describe("gold operacional.json → bloco remuneracao", () => {
  const REM = OP.remuneracao;

  it("empresas com diretoria realizada, média consistente e membros sempre juntos", () => {
    if (!REM) return; // gold pré-rodada (CI regenera no ciclo diário)
    expect(REM.empresas.length).toBeGreaterThanOrEqual(10);
    for (const e of REM.empresas) {
      const r = e.orgaos["Diretoria Estatutária"].realizado;
      expect(r, e.nome).toBeTruthy();
      expect(r.total_brl, e.nome).toBeGreaterThan(0);
      expect(r.membros, e.nome).toBeGreaterThan(0);
      // média recomputável: total ÷ membros (tolerância de arredondamento)
      expect(Math.abs(r.media_por_membro_brl - r.total_brl / r.membros), e.nome).toBeLessThan(1);
      // realizado nunca é do ano do FRE em diante
      expect(Number(r.exercicio), e.nome).toBeLessThan(Number(e.fre_ano));
      const p = e.orgaos["Diretoria Estatutária"].previsto;
      if (p) expect(Number(p.exercicio), e.nome).toBeGreaterThanOrEqual(Number(e.fre_ano));
      // quadro 8.3 tem base própria (exclui encargos/desligamentos): NUNCA
      // comparado com total ÷ membros do 8.2 — só plausibilidade própria
      if (r.maior != null) expect(r.maior, e.nome).toBeGreaterThan(0);
    }
    // ordenado por total realizado da diretoria
    for (let k = 1; k < REM.empresas.length; k++) {
      const a = REM.empresas[k - 1].orgaos["Diretoria Estatutária"].realizado.total_brl;
      const b = REM.empresas[k].orgaos["Diretoria Estatutária"].realizado.total_brl;
      expect(a >= b).toBe(true);
    }
  });

  it("cautelas centrais acompanham o dado", () => {
    if (!REM) return;
    const c = (REM.cautelas || []).join(" ");
    expect(c).toMatch(/nº de membros/);
    expect(c).toMatch(/não é mediana/);
    expect(c).toMatch(/ausência estrutural/);
    expect(c).toMatch(/SEST/);
    expect(c).toMatch(/base PRÓPRIA da CVM/);
    expect(REM.fonte.url).toMatch(/^https:\/\/dados\.cvm\.gov\.br\//);
  });
});
