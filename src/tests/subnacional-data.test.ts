/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Crédito a estados e municípios (Sadipem PVL, Tesouro Nacional). O que se trava:
 * - coletor pagina a API ORDS sem filtro de ano, substitui a tabela inteira e recusa base truncada;
 * - gold: mês de referência é o último fechado; liberado = deferido + manifestação favorável à PGFN;
 *   estados e municípios somam o total; renegociação com a União fora da série de mercado; moeda
 *   estrangeira contada e nunca somada; 27 UFs com posições; taxa de deferimento entre 50% e 100%;
 * - SPA: aba registrada em todos os mapas, no menu "Território e pessoas" e no catálogo público.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("subnacional.json") ?? { disponivel: false };
const app = read("public/obs/app.js");

describe.skipIf(!D.disponivel)("subnacional.json: magnitudes, composição e coerência", () => {
  it("12 meses fechados: liberado entre R$ 10 bi e R$ 300 bi, estados + municípios = total, PGFN dentro do total", () => {
    const K = D.kpis;
    expect(D.mes).toMatch(/^\d{4}-\d{2}$/);
    expect(D.janela_12m.fim).toBe(D.mes);
    if (D.mes_parcial) expect(D.mes_parcial > D.mes).toBe(true);
    expect(K.deferidos_12m_valor).toBeGreaterThan(1e10);
    expect(K.deferidos_12m_valor).toBeLessThan(3e11);
    expect(K.municipios_12m_valor + K.estados_12m_valor).toBeCloseTo(K.deferidos_12m_valor, 0);
    expect(K.municipios_12m_n + K.estados_12m_n).toBe(K.deferidos_12m_n);
    expect(K.pgfn_12m_valor).toBeLessThanOrEqual(K.deferidos_12m_valor);
    expect(K.pgfn_12m_n).toBe(K.garantia_uniao_12m_n);
    expect(K.taxa_deferimento_12m_pct).toBeGreaterThan(50);
    expect(K.taxa_deferimento_12m_pct).toBeLessThanOrEqual(100);
    expect(K.entes_12m).toBeGreaterThan(300);
    expect(K.entes_12m).toBeLessThanOrEqual(K.deferidos_12m_n);
    expect(K.em_tramitacao_desde).toMatch(/^\d{4}-\d{2}$/);
  });
  it("credores e finalidades ordenados por valor com shares que somam até 100%; moeda estrangeira só contada", () => {
    for (const lista of [D.credores_12m, D.credores_60m, D.finalidades_12m, D.tipos_credor_12m]) {
      for (let i = 1; i < lista.length; i++) expect(lista[i].valor).toBeLessThanOrEqual(lista[i - 1].valor);
      expect(lista.reduce((s: number, x: any) => s + x.share_valor_pct, 0)).toBeLessThanOrEqual(100.5);
    }
    expect(D.credores_12m[0].share_valor_pct).toBeGreaterThan(15);
    expect(D.moedas_12m.reduce((s: number, m: any) => s + m.n, 0)).toBe(D.kpis.moeda_estrangeira_12m_n);
    for (const m of D.moedas_12m) expect(m.moeda).not.toBe("Real");
  });
  it("série anual desde 2008 com o ano corrente parcial; renegociação com a União fora do valor de mercado", () => {
    const S = D.serie_anual;
    expect(S[0].ano).toBe("2008");
    for (let i = 1; i < S.length; i++) expect(S[i].ano > S[i - 1].ano).toBe(true);
    expect(S.filter((a: any) => a.parcial).length).toBeLessThanOrEqual(1);
    for (const a of S) {
      expect(a.municipios_valor + a.estados_valor).toBeCloseTo(a.deferidos_valor, 0);
      expect(a.garantia_uniao_valor).toBeLessThanOrEqual(a.deferidos_valor + 1);
    }
    const sp2017 = S.find((a: any) => a.ano === "2017");
    expect(sp2017.renegociacao_uniao_valor).toBeGreaterThan(1e11);
    expect(sp2017.deferidos_valor).toBeLessThan(1e11);
  });
  it("série mensal de 36 meses fechados ordenada, parcial só depois do mês de referência", () => {
    const M = D.serie_mensal;
    for (let i = 1; i < M.length; i++) expect(M[i].mes > M[i - 1].mes).toBe(true);
    const fech = M.filter((p: any) => !p.parcial);
    expect(fech.length).toBe(36);
    expect(fech[fech.length - 1].mes).toBe(D.mes);
    for (const p of M.filter((x: any) => x.parcial)) expect(p.mes > D.mes).toBe(true);
    expect(fech.reduce((s: number, p: any) => s + p.valor, 0)).toBeGreaterThan(D.kpis.deferidos_12m_valor);
  });
  it("27 UFs com posições 1 a 27 em valor, valor por habitante e operações; shares somam 100%", () => {
    expect(D.ufs.length).toBe(27);
    for (const k of ["valor", "valor_hab", "n"]) expect(D.ufs.map((u: any) => u.posicoes[k]).sort((a: number, b: number) => a - b)).toEqual(Array.from({ length: 27 }, (_, i) => i + 1));
    expect(D.ufs.reduce((s: number, u: any) => s + u.share_valor_pct, 0)).toBeCloseTo(100, 0);
    for (const u of D.ufs) { expect(u.regiao).toBeTruthy(); expect(u.estado_valor).toBeLessThanOrEqual(u.valor + 1); }
    const top = D.ufs.find((u: any) => u.posicoes.valor === 1);
    expect(top.credor_principal).toBeTruthy();
    expect(D.maiores_12m.length).toBe(12);
    expect(D.maiores_12m[0].valor).toBeGreaterThanOrEqual(D.maiores_12m[11].valor);
  });
  it("síntese e método: PGFN explicado, deferido não é contratação, tramitação limitada a 36 meses", () => {
    expect(D.sintese).toMatch(/liberou .* operações de crédito de mercado/);
    expect(D.metodo).toMatch(/Encaminhado à PGFN com manifestação técnica favorável/);
    expect(D.metodo).toMatch(/último mês fechado/);
    expect(D.limitacoes).toMatch(/Deferimento não é contratação/);
    expect(D.catalogo.find((c: any) => c.nome === "Em tramitação").definicao).toMatch(/36 meses/);
    expect(D.fonte.api).toBe("https://apidatalake.tesouro.gov.br/ords/sadipem/tt/pvl");
  });
});

describe("coletor Sadipem: paginação, substituição e piso", () => {
  it("pagina por limit/offset, recusa base truncada, registra a coleta e está no pipeline com vintage e vigilância", () => {
    const c = read("pipeline/sources/sadipem.py");
    expect(c).toContain("PAGINA = 5000");
    expect(c).toContain('f"{URL}?limit={PAGINA}&offset={off}"');
    expect(c).toContain("menos que o piso de 10 mil");
    expect(c).toContain('con.execute("DELETE FROM sadipem_pvl")');
    expect(read("pipeline/run.py")).toContain('("sadipem", sadipem)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('common.write_gold("subnacional.json", r_sn)');
    expect(gold).toContain('"sadipem": _vg("SELECT MAX(data_status) FROM sadipem_pvl")');
    expect(read("scripts/vigilancia.py")).toContain('"sadipem": 60');
    const b = read("pipeline/subnacional.py");
    expect(b).toContain('PGFN_FAVORAVEL = "Encaminhado à PGFN com manifestação técnica favorável"');
    expect(b).toContain("TRAMITACAO_MESES = 36");
    expect(b).toContain("ult_mes = _mes_menos(mes_max, 1)");
  });
});

describe("SPA: aba Crédito a estados e municípios", () => {
  it("registrada em rotas, deps, mapa, fontes, vintage, guia, render, chunk e títulos; menu e catálogo", () => {
    expect(app).toContain('subnacional: "/subnational-credit"');
    expect(app).toContain('subnacional: ["subnacional"]');
    expect(app).toContain('"consignado", "emprego", "subnacional"]');
    expect(app).toContain('sadipem: "Tesouro Nacional/Sadipem');
    expect(app).toContain('subnacional: "sadipem"');
    expect(app).toContain('subnacional: ["sadipem"]');
    expect(app).toContain('subnacional: "renderSubnacional"');
    expect(app).toContain('subnacional: "emergentes"');
    expect(app).toContain('subnacional: "Crédito a estados e municípios"');
    expect(app).toContain("subnacional: { q: ");
    expect(app).toContain('{ t: "PVL", re: "PVLs?"');
    const k = app.indexOf("function renderSubnacional(");
    const corpo = app.slice(k, app.indexOf("\nwindow.snCSV", k));
    for (const id of ["sn-anual", "sn-credores", "sn-ufs", "sn-maiores", "sn-funil", "sn-mensal", "sn-metodo"]) expect(corpo).toContain(`secWrap("${id}"`);
    expect(corpo).toContain("Encaminhado à PGFN com manifestação técnica favorável");
    expect(corpo).toContain("ufNav('${u.uf}')");
    const ini = app.indexOf("/* @chunk:emergentes:ini */"), fim = app.indexOf("/* @chunk:emergentes:fim */");
    expect(k).toBeGreaterThan(ini);
    expect(k).toBeLessThan(fim);
    expect(read("public/obs/index.html")).toContain('<button data-view="subnacional">Crédito a estados e municípios</button>');
    expect(read("public/obs/index.html")).toContain('<section class="view" id="view-subnacional"></section>');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('caminho: "/subnational-credit"');
    expect(read("src/lib/telemetry.ts")).toContain('"obs:subnacional"');
  });
});
