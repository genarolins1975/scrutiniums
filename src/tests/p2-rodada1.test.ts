/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * P2 rodada 1 da auditoria de 12/08: pontes entre painéis irmãos (o produto
 * tinha as pontas, faltavam as pontes), bump chart de posições nos Juros e a
 * Tendências que se auto-resume (3 anomalias no topo, resto colapsado).
 * O que se trava: toda ponte declara a mudança de universo — nunca é um "ver
 * mais" solto; o bump nunca interpola janela ausente; a anomalia declara a
 * régua (z da própria história, mês parcial fora).
 */
const read = (rel: string) => readFileSync(join(process.cwd(), rel), "utf-8");
const app = read("public/obs/app.js");
const juros = read("pipeline/juros.py");

describe("pontes entre painéis irmãos", () => {
  it("o helper navega e desce à âncora, e o texto declara a mudança de universo", () => {
    expect(app).toContain("window.ponteIr");
    expect(app).toContain("const ponte = (texto, view, anchor, nota)");
  });

  it("as cinco pontes existem, cada uma com a cautela do próprio par", () => {
    // Panorama → Penetração e a volta: SCR por UF ≠ ESTBAN por município
    expect(app).toContain('ponte("Os mesmos lugares no nível municipal — Penetração & Gap", "penetracao"');
    expect(app).toContain('ponte("A visão por UF, produto e perfil de renda — Quem toma crédito e onde", "panorama"');
    // RJ e PGFN → exposições setoriais (destino ancorado)
    expect(app).toContain('"sectors", "sec-exposicoes"');
    expect(app).toContain('<section id="sec-exposicoes">');
    expect(app).toMatch(/RJs por setor não implicam perda nos credores/);
    expect(app).toMatch(/dívida TRIBUTÁRIA com a União; lá, crédito BANCÁRIO/);
    // Fraudes → série do MED no Pix
    expect(app).toContain('ponte("A série completa do MED, mês a mês, no painel do Pix", "pix", "px-med"');
    expect(app).toMatch(/contestação ≠ fraude confirmada, lá como aqui/);
  });
});

describe("juros: bump de posições e CSV por modalidade", () => {
  it("o pipeline emite bump por modalidade sem interpolar ausência", () => {
    expect(juros).toContain('"bump": bump');
    expect(juros).toContain("ausência nunca vira posição interpolada");
    expect(juros).toMatch(/ranks\.append\(None\)/);
    expect(juros).toMatch(/meses_bump = sorted\(por_mes\.items\(\)\)\[-12:\]/);
  });

  it("a SPA renderiza o bump quando existe (graceful sem o campo) e exporta a modalidade", () => {
    expect(app).toContain("M.bump && M.bump.itens && M.bump.itens.length >= 2");
    expect(app).toContain("bumpChart(M.bump.itens.map((it, i) => ({ ...it, color: i })), M.bump.periodos)");
    expect(app).toContain("window.jurosModCSV");
    expect(app).toContain('onclick="jurosModCSV()"');
  });
});

describe("tendências: anomalias primeiro, resto colapsado", () => {
  it("as 3 anomalias abrem a página com a régua declarada", () => {
    expect(app).toContain('sechead("As 3 anomalias do mês"');
    expect(app).toMatch(/Math\.abs\(b\.z\) - Math\.abs\(a\.z\)/);
    expect(app).toMatch(/Régua declarada:.*z-score.*PRÓPRIO termo/);
    expect(app).toMatch(/mês parcial excluído/);
  });

  it("as seções pesadas ficam sob details e o essencial permanece aberto", () => {
    expect(app).toContain("const dobra = (titulo, sub, html)");
    for (const t of ["Mapa de calor — 36 meses", "Termo a termo — 2011 a hoje", "Variação em 12 meses",
      "Nível × aceleração", "Sazonalidade", "Catálogo, qualidade e limitações"]) {
      expect(app).toContain(`dobra("${t}"`);
    }
    // as defasagens (a ponte com o crédito) seguem abertas — não são detalhe
    expect(app).toMatch(/\+ lags\n/);
  });
});
