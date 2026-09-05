/* eslint-disable @typescript-eslint/no-explicit-any -- validação de JSON gold sem tipos gerados */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolverMeta } from "@/lib/observatorioHead";

/**
 * Páginas por UF. O que se trava:
 * - 27 UFs, cada uma com sigla, nome, região e síntese; blocos com data-base própria;
 * - a carteira do SCR por UF fecha com o total nacional do Panorama; participações somam 100;
 * - posições são permutações de 1..27 dentro de cada régua;
 * - a rota /states/{UF} resolve título e canônico; sigla desconhecida é 404/noindex;
 * - o sitemap lista as 27 rotas e a SPA registra índice e página.
 */
const raiz = process.cwd();
const read = (p: string) => readFileSync(join(raiz, p), "utf-8");
const lerGold = (n: string) => (existsSync(join(raiz, "public/obs/data/gold", n)) ? JSON.parse(read("public/obs/data/gold/" + n)) : null);
const U = lerGold("ufs.json") ?? { disponivel: false };
const app = read("public/obs/app.js");
const html = read("public/obs/index.html");
const comDado = !!U.disponivel;
const soma = (xs: any[], k: string) => xs.reduce((s, x) => s + (x[k] || 0), 0);

describe.skipIf(!comDado)("ufs.json: 27 UFs com blocos coerentes", () => {
  it("27 siglas únicas, nome, região, população e síntese com a posição entre as UFs", () => {
    expect(U.ufs.length).toBe(27);
    expect(new Set(U.ufs.map((u: any) => u.uf)).size).toBe(27);
    for (const u of U.ufs) {
      expect(u.nome.length).toBeGreaterThan(3);
      expect(["Norte", "Nordeste", "Sudeste", "Sul", "Centro-Oeste"]).toContain(u.regiao);
      expect(u.pop).toBeGreaterThan(400000);
      expect(u.sintese).toMatch(/entre as 27 UFs/);
      expect(u.sintese).not.toMatch(/undefined|None|NaN/);
    }
  });
  it("a carteira do SCR por UF fecha com o total nacional e as participações somam 100", () => {
    const scr = U.ufs.map((u: any) => u.scr);
    expect(Math.abs(soma(scr, "saldo") - U.brasil.saldo) / U.brasil.saldo).toBeLessThan(0.001);
    expect(soma(scr, "part_br")).toBeCloseTo(100, 0);
    const pgfn = U.ufs.map((u: any) => u.pgfn).filter(Boolean);
    if (pgfn.length === 27) expect(soma(pgfn, "part_br")).toBeCloseTo(100, 0);
  });
  it("posições são permutações de 1..27 em cada régua com dado completo", () => {
    for (const k of ["scr.saldo", "scr.inad", "scr.per_capita", "penetracao.penetracao"]) {
      const ps = U.ufs.map((u: any) => u.posicoes[k]).filter((p: any) => p != null).sort((a: number, b: number) => a - b);
      expect(ps, k).toEqual(Array.from({ length: 27 }, (_v, i) => i + 1));
    }
    const sp = U.ufs.find((u: any) => u.uf === "SP");
    expect(sp.posicoes["scr.saldo"]).toBe(1);
  });
  it("penetração agregada do municipal: municípios somam 5.570 e a penetração nacional reconcilia", () => {
    const pen = U.ufs.map((u: any) => u.penetracao);
    expect(soma(pen, "municipios")).toBe(5570);
    const total = soma(pen, "credito") / soma(pen, "renda_anual") * 100;
    expect(Math.abs(total - U.brasil.penetracao)).toBeLessThan(1);
  });
});

describe.skipIf(!comDado)("rotas por UF: head, sitemap e SPA", () => {
  it("/states/SP resolve título, canônico e gold; sigla desconhecida e minúscula não viram página", () => {
    const m = resolverMeta("/states/SP");
    expect(m.status).toBe(200);
    expect(m.indexavel).toBe(true);
    expect(m.titulo).toMatch(/^Crédito em São Paulo \(SP\)/);
    expect(m.canonico).toBe("https://scrutiniums.com/observatorio/states/SP");
    expect(m.gold).toBe("ufs.json");
    expect(m.descricao).toMatch(/entre as 27 UFs/);
    expect(resolverMeta("/states/XX").status).toBe(404);
    expect(resolverMeta("/states/sp").status).toBe(404);
  });
  it("o sitemap lista as rotas por UF e a SPA registra índice e página", () => {
    const sitemap = read("src/app/sitemap.ts");
    expect(sitemap).toContain("ufs.json");
    expect(sitemap).toContain("/observatorio/states/");
    expect(app).toContain('estados: "/states", estado: "/states/"');
    expect(app).toContain('estados: ["ufs"], estado: ["ufs"]');
    expect(app).toContain('estados: "renderEstados", estado: "renderEstados"');
    expect(app).toContain('if (p.startsWith("/states/") && p.length > 8) return "estado";');
    expect(app).toContain("window.ufNav = uf =>");
    expect(html).toContain('data-view="estados">Estados</button>');
    expect(html).toContain('id="view-estados"');
    expect(html).toContain('id="view-estado"');
    expect(read("src/lib/data/observatorioAbas.ts")).toContain('{ prefixo: "/states/", view: "estado", rotulo: "Estados" }');
  });
  it("a página de UF aponta o painel de origem de cada bloco e o Panorama aponta a página", () => {
    for (const v of ['"panorama"', '"penetracao"', '"operacional"', '"pix"', '"moradia"', '"consignado"', '"rural", "ru-onde"', '"bndes", "bn-onde"', '"pgfn"']) {
      expect(app, v).toMatch(new RegExp(`bloco\\("uf-[a-z]+", "[^"]+", \`[^\`]*\`, [^]*?,\\s*${v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    }
    expect(app).toContain("página do estado →");
    expect(read("pipeline/gold.py")).toContain('common.write_gold("ufs.json", r_uf)');
  });
});
