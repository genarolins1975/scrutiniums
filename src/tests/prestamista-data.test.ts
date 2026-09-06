/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Seguro prestamista (SUSEP SES), camada da aba Juros por instituição. O que se trava:
 * - coletor lê o zip da SUSEP por HTTP Range e só os três membros necessários; idempotente por Last-Modified;
 * - gold: prêmio de 12 meses na casa das dezenas de bilhões, comissão e sinistralidade em faixas plausíveis,
 *   shares de grupos e ramos coerentes, série mensal ordenada com parciais marcados, razão sobre concessões PF;
 * - SPA: aba Juros carrega o gold, declara a fonte e mostra a seção; método e cautelas dizem que não é CET.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("prestamista.json") ?? { disponivel: false };
const app = read("public/obs/app.js");

describe.skipIf(!D.disponivel)("prestamista.json: magnitudes, razões e composição", () => {
  it("prêmio de 12 meses entre R$ 10 bi e R$ 100 bi, comissão entre 10% e 60%, sinistralidade entre 5% e 80%", () => {
    const K = D.kpis;
    expect(K.premio_12m).toBeGreaterThan(1e10);
    expect(K.premio_12m).toBeLessThan(1e11);
    expect(K.comissao_12m_pct).toBeGreaterThan(10);
    expect(K.comissao_12m_pct).toBeLessThan(60);
    expect(K.sinistralidade_12m_pct).toBeGreaterThan(5);
    expect(K.sinistralidade_12m_pct).toBeLessThan(80);
    expect(K.premio_sobre_concessoes_pct).toBeGreaterThan(0.1);
    expect(K.premio_sobre_concessoes_pct).toBeLessThan(5);
    expect(K.n_empresas).toBeGreaterThan(20);
  });
  it("ramos somam 100%, grupos ordenados com shares que somam menos de 100% e sem grupo declarado como tal", () => {
    expect(D.ramos.reduce((s: number, r: any) => s + r.share_pct, 0)).toBeCloseTo(100, 0);
    expect(D.ramos.map((r: any) => r.id).sort()).toEqual(["0977", "1061", "1377"]);
    for (let i = 1; i < D.grupos.length; i++) expect(D.grupos[i].premio).toBeLessThanOrEqual(D.grupos[i - 1].premio);
    expect(D.grupos.reduce((s: number, g: any) => s + g.share_pct, 0)).toBeLessThanOrEqual(100.5);
    const semGrupo = D.grupos.find((g: any) => g.cogrupo === "sem_grupo");
    if (semGrupo) expect(semGrupo.nome).toMatch(/Sem grupo econômico/);
    expect(D.kpis.top5_grupos_share_pct).toBeGreaterThan(20);
    expect(D.kpis.top5_grupos_share_pct).toBeLessThan(100);
    for (const e of D.empresas) { expect(e.nome).toBeTruthy(); expect(e.premio).toBeGreaterThan(0); }
  });
  it("série mensal ordenada, último mês fechado igual ao KPI, parciais só depois do mês publicado", () => {
    const S = D.serie;
    for (let i = 1; i < S.length; i++) expect(S[i].mes > S[i - 1].mes, S[i].mes).toBe(true);
    const fech = S.filter((x: any) => !x.parcial);
    expect(fech[fech.length - 1].mes).toBe(D.mes);
    expect(fech[fech.length - 1].premio).toBe(D.kpis.premio_mes);
    for (const m of D.meses_parciais) expect(m > D.mes).toBe(true);
    expect(fech.filter((x: any) => x.premio_sobre_concessoes_pct != null).length).toBeGreaterThan(12);
  });
  it("método e cautelas: sinistro direto fora, razão é ordem de grandeza, não é CET", () => {
    expect(D.metodo).toMatch(/sinistro ocorrido ÷ prêmio ganho/);
    expect(D.limitacoes).toMatch(/Sinistro direto/);
    expect(D.cautelas.join(" ")).toMatch(/fora do juro/);
    expect(D.catalogo.find((c: any) => c.nome === "Prêmio sobre concessões PF").limitacoes).toMatch(/ordem de grandeza/);
  });
});

describe("coletor SUSEP: leitura parcial do zip e idempotência", () => {
  it("lê por HTTP Range só os três membros, filtra os ramos prestamista e pula quando o Last-Modified não mudou", () => {
    const c = read("pipeline/sources/susep_ses.py");
    expect(c).toContain('headers={"Range": f"bytes={self.pos}-{self.pos + n - 1}"}');
    expect(c).toContain('RAMOS = {"0977"');
    for (const m of ["Ses_seguros.csv", "Ses_cias.csv", "Ses_grupos_economicos.csv"]) expect(c).toContain(`_membro(zf, "${m}")`);
    expect(c).toContain("base inalterada desde");
    expect(c).toContain("servidor da SUSEP não aceita Range");
    expect(read("pipeline/run.py")).toContain('("susep_ses", susep_ses)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("prestamista.json", r_pm)');
    expect(gold).toContain('"susep": _vg("SELECT MAX(mes) FROM susep_prestamista")');
    expect(read("scripts/vigilancia.py")).toContain('"susep": 120');
  });
});

describe("SPA: camada na aba Juros", () => {
  it("a aba carrega o gold, declara a fonte, tem a seção com placar e síntese, e o glossário explica prestamista", () => {
    expect(app).toContain('juros: ["juros", "prestamista"]');
    expect(app).toContain('juros: ["txjuros", "susep_ses"]');
    expect(app).toContain('susep_ses: "SUSEP/SES (seguro prestamista)"');
    const k = app.indexOf("function renderJuros(");
    const corpo = app.slice(k, app.indexOf("\nfunction ", k + 10));
    expect(corpo).toContain('secWrap("ju-prestamista"');
    expect(corpo).toContain("O custo que fica fora da taxa: seguro prestamista");
    expect(corpo).toContain('<p class="pan-sintese">${P.sintese}</p>');
    expect(app).toContain('{ t: "prestamista", re: "[Pp]restamista"');
  });
});
