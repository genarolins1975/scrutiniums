/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Segunda camada do painel Crédito a estados e municípios: dívida consolidada dos estados (Siconfi, RGF
 * Anexo 02) e garantias da União (contratos internos e externos). O que se trava:
 * - coletor do RGF pede só o Anexo 02 do Executivo, tenta 3º, 2º e 1º quadrimestre e não refaz exercícios fechados;
 * - coletor de garantias resolve UF por nome de estado, sufixo e cadastro do IBGE; recusa base truncada;
 * - gold: 27 UFs com posições, DCL ÷ RCL em faixa plausível, agregado com pelo menos 20 UFs, limite do Senado
 *   respeitado no cálculo de "acima", garantias com entes separados de estatais, honras declaradas ausentes;
 * - SPA: duas seções na aba, bloco nas páginas por UF, placar com a dívida.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const D = lerGold("subnacional.json") ?? { disponivel: false };
const DV = D.divida ?? { disponivel: false };
const G = D.garantias ?? { disponivel: false };
const app = read("public/obs/app.js");

describe.skipIf(!DV.disponivel)("subnacional.json › divida: RGF Anexo 02 dos 27 estados", () => {
  it("agregado: DCL entre R$ 500 bi e R$ 2 tri, DCL ÷ RCL entre 40% e 150%, parte com a União entre 30% e 90%", () => {
    const K = DV.kpis;
    expect(K.n_ufs).toBeGreaterThanOrEqual(20);
    expect(K.dcl).toBeGreaterThan(5e11);
    expect(K.dcl).toBeLessThan(2e12);
    expect(K.dcl_rcl_pct).toBeGreaterThan(40);
    expect(K.dcl_rcl_pct).toBeLessThan(150);
    expect(K.uniao_share_pct).toBeGreaterThan(30);
    expect(K.uniao_share_pct).toBeLessThan(90);
    expect(K.periodo).toMatch(/^\d{4} · \dº quadrimestre$/);
    expect(K.ufs_acima_limite_lista.length).toBe(K.ufs_acima_limite);
    expect(K.ufs_acima_alerta).toBeGreaterThanOrEqual(K.ufs_acima_limite);
  });
  it("27 UFs, posições 1 a 27 nas três réguas, 'acima do limite' coerente com o limite declarado, série por UF desde 2015", () => {
    expect(DV.ufs.length).toBe(27);
    const disp = DV.ufs.filter((u: any) => u.disponivel);
    expect(disp.length).toBeGreaterThanOrEqual(20);
    for (const k of ["dcl_rcl_pct", "dcl_hab", "dcl"]) expect(disp.map((u: any) => u.posicoes[k]).sort((a: number, b: number) => a - b)).toEqual(Array.from({ length: disp.length }, (_, i) => i + 1));
    for (const u of disp) {
      expect(u.periodo).toMatch(/quadrimestre|saldo/);
      if (u.limite_senado) expect(u.acima_limite).toBe(u.dcl > u.limite_senado);
      if (u.rcl) expect(Math.abs(u.dcl_rcl_pct - u.dcl / u.rcl * 100)).toBeLessThan(15);
      expect(u.serie.length).toBeGreaterThanOrEqual(8);
      expect(u.serie[0].ano).toBeLessThanOrEqual(2016);
    }
    expect(disp.find((u: any) => u.uf === "RJ").dcl_rcl_pct).toBeGreaterThan(150);
    expect(disp.find((u: any) => u.uf === "SP").posicoes.dcl).toBe(1);
  });
  it("série anual do agregado desde 2015, pelo menos 20 UFs por ano, só o último ano parcial, União zerada antes de 2017", () => {
    const S = DV.serie_anual;
    expect(S[0].ano).toBe(2015);
    for (let i = 1; i < S.length; i++) expect(S[i].ano).toBeGreaterThan(S[i - 1].ano);
    for (const a of S) { expect(a.n_ufs).toBeGreaterThanOrEqual(20); expect(a.dcl).toBeLessThanOrEqual(a.dc); }
    expect(S.filter((a: any) => a.parcial).length).toBeLessThanOrEqual(1);
    if (S.some((a: any) => a.parcial)) expect(S[S.length - 1].parcial).toBe(true);
    expect(S.find((a: any) => a.ano === 2016).reestruturacao_uniao).toBe(0);
    expect(S.find((a: any) => a.ano === 2024).reestruturacao_uniao).toBeGreaterThan(5e11);
    expect(DV.nota).toMatch(/desde 2017/);
  });
});

describe.skipIf(!G.disponivel)("subnacional.json › garantias: contratos com garantia da União", () => {
  it("mais de 1.000 contratos desde 2010, entes separados de estatais, moedas externas listadas, honras declaradas ausentes", () => {
    const K = G.kpis;
    expect(K.posicao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(K.contratos).toBeGreaterThan(1000);
    expect(K.internas_n + K.externas_n).toBe(K.contratos);
    expect(K.entes_internas_valor + K.outros_internas_valor).toBeCloseTo(K.internas_valor, 0);
    expect(K.entes_internas_valor).toBeGreaterThan(1e11);
    expect(K.entes_internas_valor).toBeLessThan(1e12);
    expect(K.entes_n).toBeLessThan(K.contratos);
    expect(K.externas_usd).toBeGreaterThan(1e10);
    expect(G.moedas_externas.map((m: any) => m.moeda)).toContain("USD");
    expect(G.moedas_externas.reduce((s: number, m: any) => s + m.n, 0)).toBe(K.externas_n);
    expect(G.nota).toMatch(/garantias honradas/);
    expect(G.tipos.map((t: any) => t.tipo)).toEqual(["Estado", "DF", "Município", "Outros"]);
    expect(G.tipos.reduce((s: number, t: any) => s + t.n, 0)).toBe(K.contratos);
  });
  it("série anual desde 2010 com estados + municípios dentro do total interno; credores e maiores só de entes; UF resolvida para quase todos", () => {
    const S = G.serie_anual;
    expect(S[0].ano).toBe(2010);
    for (const a of S) expect(a.estados_valor + a.municipios_valor).toBeLessThanOrEqual(a.internas_valor + 1);
    expect(S.filter((a: any) => a.parcial).length).toBeLessThanOrEqual(1);
    for (let i = 1; i < G.credores_internas.length; i++) expect(G.credores_internas[i].valor).toBeLessThanOrEqual(G.credores_internas[i - 1].valor);
    expect(G.credores_internas.map((c: any) => c.nome)).toContain("CAIXA");
    for (const m of G.maiores_internas) expect(m.mutuario).not.toMatch(/CORREIOS|BNDES|CAIXA|SABESP/);
    expect(G.ufs.length).toBe(27);
    expect(G.ufs.reduce((s: number, u: any) => s + u.n, 0)).toBeGreaterThan(K(G) * 0.9);
    expect(G.kpis.municipios_sem_uf).toBeLessThan(100);
    function K(g: any) { return g.kpis.entes_n; }
  });
});

describe("coletores do Tesouro: RGF e garantias", () => {
  it("RGF: só Anexo 02 do Executivo, tenta 3º, 2º e 1º quadrimestre, não refaz exercício fechado; garantias: piso, UF por IBGE; registros no pipeline", () => {
    const c = read("pipeline/sources/siconfi_rgf.py");
    expect(c).toContain("no_anexo=RGF-Anexo%2002&co_poder=E");
    expect(c).toContain("for per in (3, 2, 1):");
    expect(c).toContain("if feitos.get((cod, ex)) == 3 and ex < ano - 1:");
    expect(c).toContain("EXERCICIO_INICIAL = 2015");
    const g = read("pipeline/sources/tesouro_garantias.py");
    expect(g).toContain("abaixo do piso de 200");
    expect(g).toContain("def _municipios_unicos(con):");
    expect(g).toContain("difflib.get_close_matches(resto, list(_UF_POR_NOME), n=1, cutoff=0.85)");
    expect(read("pipeline/run.py")).toContain('("siconfi_rgf", siconfi_rgf), ("tesouro_garantias", tesouro_garantias)');
    const gold = read("pipeline/gold.py");
    expect(gold).toContain('"siconfi": _vg(');
    expect(gold).toContain('"tesouro_garantias": _vg("SELECT MAX(posicao) FROM tesouro_garantias_coleta")');
    expect(read("scripts/vigilancia.py")).toContain('"siconfi": 200, "tesouro_garantias": 200');
    const b = read("pipeline/subnacional.py");
    expect(b).toContain("def _divida(con, pop):");
    expect(b).toContain("def _garantias(con, ult_mes):");
    expect(b).toContain('ENTES = ("Estado", "DF", "Município")');
  });
});

describe("SPA: seções de dívida e garantias, bloco por UF", () => {
  it("aba tem as duas seções na subnav e no corpo, placar mostra a dívida, página por UF ganha o bloco Setor público", () => {
    const k = app.indexOf("function renderSubnacional(");
    const corpo = app.slice(k, app.indexOf("\nwindow.snCSV", k));
    expect(corpo).toContain('secWrap("sn-divida"');
    expect(corpo).toContain('secWrap("sn-garantias"');
    expect(corpo).toContain('["#sn-divida", "Dívida"], ["#sn-garantias", "Garantias"]');
    expect(corpo).toContain('l: "Dívida líquida dos estados"');
    expect(corpo).toContain("⚠ acima do limite do Senado");
    expect(corpo).toContain("snSet('dv', this.value)");
    expect(app).toContain('state.sn = { cred: "12m", uf: "valor", serie: "valor", dv: "dcl_rcl_pct" };');
    expect(app).toContain('bloco("uf-subnacional", "Crédito ao estado e aos municípios"');
    expect(app).toContain('["#uf-subnacional", "Setor público"]');
    expect(app).toContain("+ pgB + snB");
    const ufs = read("pipeline/ufs.py");
    expect(ufs).toContain('"subnacional": {"mes": snc.get("mes")');
    expect(ufs).toContain('("subnacional", "valor_hab"), ("subnacional", "dcl_rcl_pct")');
  });
  it("ufs.json publicado: bloco subnacional presente quando o painel já rodou antes das páginas por UF", () => {
    const U = lerGold("ufs.json");
    if (!U || !U.ufs || !U.ufs[0].subnacional) return; // recorte aparece após a próxima execução diária
    for (const u of U.ufs) { expect(u.subnacional.liberado_12m_valor).not.toBeUndefined(); expect(u.posicoes["subnacional.dcl_rcl_pct"]).toBeGreaterThanOrEqual(1); }
  });
});
