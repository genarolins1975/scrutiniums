import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { describe, expect, it, vi } from "vitest";
import { GASES_PRINCIPAIS, SETORES, balancaPorAno, lerEmissoes, serieGas } from "@/lib/territorio/emissoes";
import { donoDaRota } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { cartoesTerritorio } from "@/lib/observatorios/entradas/territorio";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/territorio/emissoes",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

type No = Parameters<typeof textoDe>[0] & { attrs?: { name: string; value: string }[]; childNodes?: No[] };
const nos = (raiz: No, f: (n: No) => boolean): No[] => {
  const fora: No[] = [];
  const ir = (n: No) => {
    if (f(n)) fora.push(n);
    for (const c of n.childNodes ?? []) ir(c);
  };
  ir(raiz);
  return fora;
};
const tem = (n: No, nome: string) => (n.attrs ?? []).some((a) => a.name === nome);

/**
 * Painel de emissões (/territorio/emissoes), no molde de painel desde 24/11/2026. Invariantes, não texto: a anatomia do molde, a gold
 * (setores que somam o total, 2005 na série, variação calculada da própria série), a balança (categorias que somam o total, lado negativo
 * só com categorias de saldo negativo), a unidade dos gases (massa do gás; CO2e é conversão declarada que reconcilia com o total), o
 * modelo didático no envelope com a lista do que deixa de fora, e o acesso.
 */
describe("emissões do Território e Clima", () => {
  const g = lerEmissoes();

  it("inventário oficial desde 1990, com 2005, setores que somam o total e métrica declarada", () => {
    expect(g.anoInicial).toBe(1990);
    expect(g.anos.map((a) => a.ano)).toContain(2005);
    expect(g.metrica).toMatch(/GWP AR5/);
    for (const a of g.anos) {
      const soma = SETORES.reduce((s, k) => s + a.setores[k], 0);
      expect(Math.abs(soma - a.totalLiquido), String(a.ano)).toBeLessThan(1);
      expect(Math.abs(a.totalLiquido - a.setores.lulucf - a.totalSemLulucf), String(a.ano)).toBeLessThan(1);
    }
    for (const o of g.originais) expect(o.sha256, o.setor).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a variação desde 2005 é a calculada da própria série", () => {
    const u = g.anos.at(-1)!;
    const r = g.anos.find((a) => a.ano === 2005)!;
    expect(g.derivados.variacaoDesde2005Pct.totalLiquido).toBeCloseTo(100 * (u.totalLiquido / r.totalLiquido - 1), 1);
  });

  it("a balança: as categorias somam o total publicado e o lado negativo só tem categorias com saldo abaixo de zero", () => {
    const b = balancaPorAno(g);
    expect(b.map((a) => a.ano)).toEqual(g.anos.map((a) => a.ano));
    for (const [i, a] of b.entries()) {
      expect(Math.abs(a.liquido - g.anos[i].totalLiquido), String(a.ano)).toBeLessThan(1);
      expect(a.positivo, String(a.ano)).toBeGreaterThan(0);
      expect(a.negativo, String(a.ano)).toBeLessThanOrEqual(0);
      expect(Math.abs(a.categoriasNegativas.reduce((s, c) => s + c.valor, 0) - a.negativo)).toBeLessThan(1e-6);
      for (const c of a.categoriasNegativas) expect(c.valor, `${a.ano} ${c.codigo}`).toBeLessThan(0);
      expect(Math.abs(SETORES.reduce((s, k) => s + a.positivoPorSetor[k], 0) - a.positivo)).toBeLessThan(1e-6);
    }
    // a fonte publica o uso da terra só como saldo: a ressalva que sustenta o nome "categorias com saldo negativo" está na gold
    expect(g.ressalvas.join(" ")).toMatch(/saldo/);
  });

  it("gases: a unidade publicada é a massa do gás, e o CO2e por gás é conversão pelo GWP AR5 que reconcilia com o total", () => {
    expect(g.gases.unidade).toMatch(/kt do gás/);
    for (const gas of GASES_PRINCIPAIS) {
      const s = serieGas(g, gas)!;
      expect(s, gas).toBeDefined();
      expect(s.unidade, gas).toBe("kt do gás");
      for (const a of g.anos) {
        const ano = String(a.ano);
        expect(s.totalCo2eAr5Derivado[ano], `${gas} ${ano}`).toBeCloseTo(s.total[ano] * s.gwpAr5, 3);
      }
    }
    for (const a of g.anos) {
      const ano = String(a.ano);
      const soma = g.gases.series.reduce((x, s) => x + s.totalCo2eAr5Derivado[ano], 0);
      expect(Math.abs(soma / a.totalLiquido - 1), ano).toBeLessThan(0.002);
    }
  });

  it("o painel segue o molde, com o modelo didático no envelope e sem rótulo de modelo escrito à mão", async () => {
    const { default: Pagina } = await import("@/app/territorio/emissoes/page");
    const html = renderToStaticMarkup(createElement(Pagina));
    conferirPainel("/territorio/emissoes", html);
    const doc = parse(html) as unknown as No;
    const modelos = nos(doc, (n) => tem(n, "data-modelo-didatico"));
    expect(modelos.length, "um modelo didático").toBe(1);
    expect(nos(modelos[0], (n) => tem(n, "data-deixa-de-fora")).length).toBe(1);
    expect(nos(doc, (n) => tem(n, "data-modelo-rotulo")).length, "o rótulo vem só do envelope").toBe(1);
    // três figuras: série por setor, balança e gases
    expect(nos(doc, (n) => tem(n, "data-figura-analitica")).length).toBe(3);
    // toda região rolável é focável e nomeada (axe scrollable-region-focusable)
    for (const r of nos(doc, (n) => (n.attrs ?? []).some((a) => a.name === "class" && /overflow-(x-)?auto|tabela-scroll/.test(a.value)))) {
      const nome = (k: string) => (r.attrs ?? []).find((a) => a.name === k)?.value;
      expect(nome("tabindex"), "região rolável com tabindex").toBe("0");
      expect(nome("aria-label") ?? nome("aria-labelledby"), "região rolável com nome").toBeTruthy();
    }
    // o aviso da defasagem e do SEEG acompanha os números
    const faixa = nos(doc, (n) => (n.attrs ?? []).some((a) => a.name === "data-fatia" && a.value === "numeros"))[0];
    expect(textoDe(faixa)).toContain(String(g.anoFinal));
    expect(nos(faixa, (n) => (n.attrs ?? []).some((a) => a.name === "href" && a.value === "/agronegocio/ambiente")).length).toBe(1);
  });

  it("o painel é fechado, fica na coleção Desmatamento e emissões e não traz a meta da NDC sem a fonte", () => {
    expect(ehRotaPublica("/territorio/emissoes")).toBe(false);
    expect(donoDaRota("/territorio/emissoes")).toMatchObject({ observatorio: "territorio-e-clima", colecao: "desmatamento", origem: null });
    expect(cartoesTerritorio().map((c) => c.href)).toContain("/territorio/emissoes");
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "emissoes", "page.tsx"), "utf-8");
    expect(fonte).not.toMatch(/\bNDC\b.*\d+\s*%|meta de \d/);
  });
});
