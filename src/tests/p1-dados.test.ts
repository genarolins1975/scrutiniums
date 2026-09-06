/**
 * Travas do bloco P1 de dados da avaliação de 06/09/2026 (docs/AVALIACAO_PAINEIS_2026-09-06.md §7):
 * D5 coletores em pane com causa nomeada, D6 sem conteúdo demonstrativo residual,
 * D7 população única por UF e verbetes de carteira e de contagem de instituições.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(RAIZ, p), "utf8");
const py = (linhas: string[]) => execFileSync("python3", ["-c", ["import sys, json; sys.path.insert(0, '.')", ...linhas].join("\n")], { cwd: RAIZ, encoding: "utf8" }).trim().split("\n").pop() as string;

describe("D5: pane com causa nomeada, nunca diagnóstico genérico", () => {
  it("Desenrola distingue página HTML de esquema mudado e informa o cabeçalho recebido", () => {
    const src = read("pipeline/sources/desenrola.py");
    expect(src).toContain("resposta HTML no lugar do CSV");
    expect(src).toContain("cabeçalho recebido");
    expect(src).toContain('texto = body.decode("latin-1")');
  });
  it("DJEN nomeia o bloqueio da CDN; TST nomeia o desafio WAF", () => {
    expect(read("pipeline/sources/djen.py")).toContain("HTTP 403 da CDN (CloudFront)");
    expect(read("pipeline/sources/judicial.py")).toContain("x-amzn-waf-action");
  });
  it("Pilar 3 lê percentuais com %, vírgula decimal e trimestre em quatro grafias", () => {
    const out = py([
      "from pipeline.sources import pilar3",
      "print(json.dumps([[pilar3._norm('indice_basileia', x) for x in ('34.56%', '7,68', '0.1423', 'abc')], [pilar3._trimestre_referencia({'km1_trimestreReferencia': v}) for v in ('2026-2', '2T2026', '2026T2', '2º trimestre de 2026', '')]]))",
    ]);
    const [normas, tris] = JSON.parse(out);
    expect(normas).toEqual([34.56, 7.68, 14.23, null]);
    expect(tris).toEqual(["2026-2", "2026-2", "2026-2", "2026-2", ""]);
  });
});

describe("D6: nada demonstrativo sobra no rj.json e os textos de método derivam de sectors.json", () => {
  it("o bloco de RJ em gold.py não monta fichas fictícias nem exposição estimada", () => {
    const gold = read("pipeline/gold.py");
    expect(gold).not.toContain('rj["casos"] = casos');
    expect(gold).not.toContain("exposicao_total_rmi");
    expect(gold).toContain('rj = {"demo": False, "selo": "DADO OBSERVADO"');
    expect(gold).toContain("ov.dicionario_indicadores(sectors)");
    expect(gold).toContain("ov.score_cards(sectors)");
  });
  it("demo_componentes conta pelo status em sectors.json e a frase acompanha", () => {
    const out = py([
      "from pipeline import overview as ov",
      "s1 = {'setores': [{'componentes': {'a': {'status': 'observado'}, 'b': {'status': 'demonstrativo'}}}]}",
      "s0 = {'setores': [{'componentes': {'a': {'status': 'observado'}, 'b': {'status': 'observado'}}}]}",
      "print(json.dumps([ov.demo_componentes(s1), ov._frase_demo(s1), ov._frase_demo(s0), [e['limitacoes'] for e in ov.dicionario_indicadores(s0) if e['nome'] == 'Score de estresse setorial'][0]]))",
    ]);
    const [d1, f1, f0, lim] = JSON.parse(out);
    expect(d1).toEqual([1, 2, ["b"]]);
    expect(f1).toMatch(/^1 de 2 componentes demonstrativo/);
    expect(f0).toBe("todos os 2 componentes observados");
    expect(lim).toContain("todos os 2 componentes observados");
    expect(read("pipeline/overview.py")).not.toContain("2 de 4 componentes demonstrativos");
  });
});

describe("D7: uma população por UF e verbetes únicos", () => {
  it("rural usa geo_uf (SIDRA 6579) por UF e declara a fonte; consignado e ufs declaram a sua", () => {
    const rural = read("pipeline/rural.py");
    expect(rural).toContain("SELECT uf, populacao, pop_ano FROM geo_uf");
    expect(rural).toContain('"populacao_fonte": {"ufs": populacao_fonte_uf');
    expect(read("pipeline/consignado.py")).toContain('"populacao_fonte": "IBGE Censo 2022');
    expect(read("pipeline/ufs.py")).toContain('"populacao_fonte": "IBGE SIDRA 6579');
  });
  it("meta.json publica carteira_conceitos e if_contagens e a SPA os exibe em Metodologia e no Mapa", () => {
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('"carteira_conceitos": _carteira_conceitos(con)');
    expect(gold).toContain('"if_contagens": _if_contagens(con)');
    for (const k of ['"sgs"', '"scr"', '"ampliado"', '"estban"']) expect(gold, k).toContain(`out[${k}] = {`);
    const app = read("public/obs/app.js");
    expect(app).toContain("function verbetesCarteiraIF(meta, compacto)");
    expect((app.match(/verbetesCarteiraIF\(meta, (true|false)\)/g) || []).length).toBe(2);
  });
});
