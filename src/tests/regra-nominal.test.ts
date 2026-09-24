/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Regra editorial das instituições nomeadas (docs/CONSTITUICAO.md, art. 5; avaliação de
 * 24/09/2026, seção 3b): nome nunca acompanha score, faixa verbal de risco, variação ou
 * histórico de score; dado de fonte sem CNPJ não é atribuído por semelhança de nome.
 * Travas estáticas (código) e travas gated no gold publicado, que mordem assim que o
 * pipeline publica a primeira gold com a marca `regra_editorial`.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const app = ler("public/obs/app.js");
const goldPy = ler("pipeline/gold.py");
const paginasPy = ler("pipeline/inst_pages_all.py");
const pilotosPy = ler("pipeline/inst_pages.py");
const relatorioPy = ler("pipeline/report.py");
const GOLD = join(raiz, "public/obs/data/gold");
const CAMPOS = ["score", "score_anterior", "score_delta", "faixa", "historico_score"];

describe("estático: a SPA não exibe score nem faixa por instituição", () => {
  it("a aba Instituições não conta nem ordena por faixa de risco", () => {
    expect(app).not.toMatch(/Em risco elevado ou muito elevado/);
    expect(app).not.toMatch(/\["score", "por score"\]/);
    expect(app).not.toMatch(/i\.score_delta|i\.historico_score|\$\{i\.faixa\}/);
  });

  it("a ficha lê comparacao_pares e nunca o score_ref de golds antigos", () => {
    expect(app).toContain("pg.comparacao_pares");
    expect(app).not.toMatch(/pg\.score_ref/);
    expect(app).not.toMatch(/sc\.faixa|sc\.score_delta|sc\.historico_score/);
  });

  it("Open Finance e RJ casados por nome saíram da ficha", () => {
    expect(app).not.toMatch(/pg\.rj_citacoes|pg\.openfinance/);
    expect(app).not.toMatch(/participante_open_finance/);
  });

  it("a decomposição mostra percentil nos pares, sem componente de risco", () => {
    expect(app).not.toMatch(/d\.risco/);
  });
});

describe("estático: o pipeline só publica pela regra", () => {
  it("institutions.json passa pela regra nominal", () => {
    expect(goldPy).toMatch(/write_gold\("institutions\.json", regra_nominal\.institutions_publicavel\(inst\)\)/);
  });

  it("fichas sem score_ref, sem casamento por palavras e sem recomendação a instituição", () => {
    for (const py of [paginasPy, pilotosPy]) {
      expect(py).not.toMatch(/"score_ref"/);
      expect(py).not.toMatch(/apetite de risco/);
    }
    expect(paginasPy).not.toMatch(/_match_nome\(toks/);
    expect(paginasPy).toMatch(/casamento_reclamacao\(/);
  });

  it("o relatório não lista score de instituição nem credores de RJ por nome", () => {
    expect(relatorioPy).not.toMatch(/score_delta/);
    expect(relatorioPy).not.toMatch(/b\['banco'\]/);
    expect(relatorioPy).not.toMatch(/LIMITACOES\.md/);
  });
});

describe("gated: gold publicado com a marca da regra", () => {
  const inst = JSON.parse(readFileSync(join(GOLD, "institutions.json"), "utf-8"));
  const comRegra = inst.regra_editorial === "regra_nominal_v1";

  it("institutions.json: nenhum campo de score ao lado do nome", () => {
    if (!comRegra) return; // gold anterior à regra: a próxima execução do pipeline a aplica
    for (const i of inst.instituicoes as any[]) {
      for (const c of CAMPOS) expect(i, `${i.nome}: ${c}`).not.toHaveProperty(c);
      for (const [k, d] of Object.entries(i.dimensoes || {}) as [string, any][]) {
        expect(d, `${i.nome}/${k}`).not.toHaveProperty("risco");
      }
    }
    const dist = inst.score_distribuicao_anonima;
    expect(dist).toBeTruthy();
    expect(JSON.stringify(dist)).not.toMatch(/C00\d{5}/);
    for (const g of Object.values(dist.grupos) as any[]) expect(g.n).toBeGreaterThanOrEqual(dist.minimo_membros);
  });

  it("fichas inst/*.json: sem score_ref, Open Finance ou RJ por nome", () => {
    const dir = join(GOLD, "inst");
    if (!existsSync(dir)) return;
    const arquivos = readdirSync(dir).filter(f => f.endsWith(".json"));
    const amostra = arquivos.map(f => JSON.parse(readFileSync(join(dir, f), "utf-8")));
    if (!amostra.some(p => p.comparacao_pares)) return; // gold anterior à regra
    for (const p of amostra) {
      expect(p, p.cod_inst).not.toHaveProperty("score_ref");
      expect(p, p.cod_inst).not.toHaveProperty("score_meta");
      expect(p, p.cod_inst).not.toHaveProperty("openfinance");
      expect(p, p.cod_inst).not.toHaveProperty("rj_citacoes");
      for (const r of p.reclamacoes || []) {
        expect(["cnpj", "nome_identico_bcb", "mapa_curado"], `${p.cod_inst}: ${r.nome_fonte}`).toContain(r.casamento);
      }
      expect(p.cabecalho.data_base, p.cod_inst).toMatch(/^\d{4}-T[1-4]$/);
    }
  });
});
