import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Resiliência do gold — as lições de 07-08/08/2026, quando a pane dupla
 * (cache do Actions perdido + fontes do BCB fora do ar) derrubou o painel
 * Pix inteiro com o workflow terminando verde:
 * 1. build de painel não pode virar stub de erro por fonte em pane — blocos
 *    sem fonte carregam a última publicação íntegra, com cautela declarada;
 * 2. regressão de gold (íntegro → stub, ou arquivo não gerado) mantém a
 *    última publicação no ar e vira issue — nunca silêncio.
 */

const raiz = process.cwd();
const pixPy = readFileSync(join(raiz, "pipeline/pix.py"), "utf-8");
const workflow = readFileSync(join(raiz, ".github/workflows/atualizar-dados.yml"), "utf-8");
const sentinela = readFileSync(join(raiz, "scripts/sanidade_gold.py"), "utf-8");

describe("carry-forward de fonte em pane (pipeline/pix.py)", () => {
  it("o build lê a última publicação íntegra e recusa stub como base", () => {
    expect(pixPy).toContain("def _gold_publicado");
    expect(pixPy).toContain('g.get("disponivel") is not False');
  });

  it("trimestral e MED carregam a publicação anterior quando a fonte falha", () => {
    expect(pixPy).toContain("tri_carregado");
    expect(pixPy).toContain("med_carregado");
    // e a cautela correspondente acompanha o dado carregado
    expect(pixPy).toContain("mantém a última posição publicada até a fonte voltar");
  });

  it("listas vazias não estouram mais o build (o IndexError de 08/08)", () => {
    // sem base transacional: stub com motivo, não IndexError
    expect(pixPy).toContain('"error": "sem pix_tx"');
    // sem trimestre nem publicação anterior: ausência declarada
    expect(pixPy).toMatch(/tri0, part_pix_q = None, None/);
    // o rótulo do trimestre nunca indexa tri0 nulo
    expect(pixPy).toContain('if tri0 else None');
  });

  it("a SPA declara a ausência do capítulo trimestral em vez de quebrar", () => {
    const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
    expect(appJs).toContain("!tris.length");
    expect(appJs).toContain("X.tri.dados[X.tri.tri0] || {}");
  });
});

describe("sentinela de regressão do gold", () => {
  it("o script existe com o contrato documentado", () => {
    expect(sentinela).toContain("stub de erro");
    expect(sentinela).toContain("não gerado");
    expect(sentinela).toContain("GITHUB_OUTPUT");
    // publica o restante mesmo em regressão: o alerta é a issue
    expect(sentinela).toContain("return 0");
  });

  it("o workflow diário roda o sentinela antes de publicar e alerta por issue", () => {
    const antesDe = workflow.indexOf("Sentinela de regressão do gold");
    const publicar = workflow.indexOf("Publicar gold no site");
    expect(antesDe).toBeGreaterThan(-1);
    expect(antesDe).toBeLessThan(publicar);
    expect(workflow).toContain("scripts/sanidade_gold.py");
    expect(workflow).toContain("steps.sanidade.outputs.regressoes != ''");
    expect(workflow).toContain("Gold regrediu para stub de erro");
  });
});

describe("o gold publicado do Pix está íntegro", () => {
  const pix = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/pix.json"), "utf-8"));

  it("não é stub e traz os capítulos que a pane derrubou", () => {
    expect(pix.disponivel).toBe(true);
    expect(pix.tri.periodos.length).toBeGreaterThan(30);
    expect(pix.tri.dados[pix.tri.tri0]).toBeTruthy();
    expect(pix.med.length).toBeGreaterThan(24);
    expect(pix.kpis.part_tri.v).toBeGreaterThan(0);
  });

  it("pix_mun.json voltou à publicação (o rsync --delete o tinha apagado)", () => {
    const mun = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/pix_mun.json"), "utf-8"));
    expect(mun.municipios.length).toBeGreaterThan(1000);
    expect(mun.mes).toMatch(/^\d{4}-\d{2}$/);
  });
});
