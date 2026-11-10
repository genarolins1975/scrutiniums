import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ABAS_OBSERVATORIO, PREFIXOS_DINAMICOS } from "@/lib/data/observatorioAbas";
import { conferirPainel } from "./suporte/molde-painel";

/**
 * Painel "Bancos cobrando na Justiça" (/divida-das-familias/bancos-cobrando-na-justica), reescrita em página Next da vista `cobranca`
 * da aplicação do Crédito. A página é renderizada direto pelo componente e conferida por invariantes: a anatomia do molde de painel, a
 * natureza, o período e a fonte de cada número, os valores iguais aos da gold (public/obs/data/gold/cobranca.json), os meses parciais
 * fora dos números e dos gráficos, os recortes de classe e de medida por UF, os destinos dos links e a ausência de `undefined`, `NaN`,
 * data crua e travessão.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/bancos-cobrando-na-justica";
const raiz = process.cwd();
/* eslint-disable @typescript-eslint/no-explicit-any -- gold JSON sem tipos gerados */
const gold: any = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/cobranca.json"), "utf-8"));
/* eslint-enable @typescript-eslint/no-explicit-any */
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const n = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;

async function html(params: Record<string, string> = {}): Promise<string> {
  caminho.atual = ROTA;
  const { default: Pagina } = await import("@/app/divida-das-familias/bancos-cobrando-na-justica/page");
  return renderToStaticMarkup(Pagina({ searchParams: params }) as ReactElement);
}

const painel = (h: string) => h.slice(h.indexOf("data-painel="));
const texto = (h: string) => painel(h).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
/** A tabela equivalente de uma figura (o <table> dentro dela). */
const tabelaDa = (h: string, id: string) => {
  const figura = h.slice(h.indexOf(`data-figura-analitica="${id}"`));
  return figura.slice(figura.indexOf("<table"), figura.indexOf("</table>")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
};

function existe(href: string): boolean {
  const c = href.split(/[?#]/)[0];
  if (c.startsWith("/observatorio/")) {
    const resto = c.slice("/observatorio".length);
    return ABAS_OBSERVATORIO.some((a) => a.caminho === resto) || PREFIXOS_DINAMICOS.some((p) => resto.startsWith(p.prefixo) && resto.length > p.prefixo.length);
  }
  return existsSync(join(raiz, "src/app", c, "page.tsx"));
}

describe("Bancos cobrando na Justiça: molde e invariantes", () => {
  it("segue o molde de painel no recorte padrão e em cada recorte da URL", async () => {
    conferirPainel(ROTA, await html());
    for (const g of gold.grupos) conferirPainel(ROTA, await html({ classe: g.id }));
    for (const medida of ["por_bi_carteira", "casos_12m", "var_12m_pct"]) conferirPainel(ROTA, await html({ medida }));
  });

  it("parâmetro inválido não quebra a página: vale o recorte padrão", async () => {
    expect(await html({ classe: "x", medida: "y" })).toBe(await html());
  });

  it("os quatro números de abertura são os da gold, com janela, fonte e natureza", async () => {
    const h = await html();
    const B = gold.brasil;
    const faixa = h.slice(h.indexOf('data-fatia="numeros"'), h.indexOf('data-fatia="figuras"'));
    expect((faixa.match(/data-numero-indicador=""/g) ?? []).length).toBe(4);
    for (const esperado of [n0(B.casos_12m), n0(B.casos_12m_todos), n(B.por_mil_hab, 2), n(B.por_bi_carteira, 1)]) expect(faixa, esperado).toContain(`>${esperado}<`);
    const fim = mesAno(gold.janela_12m.fim);
    for (const [, natureza, prova] of faixa.matchAll(/data-natureza="([A-Z]+)"[^>]*data-prova-numero="([^"]+)"/g)) {
      expect(natureza).toBe("CALCULADO");
      const [fonte, periodo] = prova.split(" · ");
      expect(fonte).toContain("DataJud");
      expect(periodo).toContain(fim);
    }
    // as variações de 12 meses são as publicadas, em palavras
    const t = faixa.replace(/<[^>]+>/g, " ");
    expect(t).toContain(n(Math.abs(B.var_12m_pct), 1));
    expect(t).toContain(n(Math.abs(B.var_12m_todos_pct), 1));
  });

  it("os meses parciais ficam fora da série e são nomeados na página", async () => {
    const h = await html();
    const tabela = tabelaDa(h, "serie");
    const fechados = gold.serie.filter((p: { parcial: boolean }) => !p.parcial);
    for (const p of fechados.slice(-3)) {
      expect(tabela).toContain(mesAno(p.mes));
      expect(tabela).toContain(n0(p.bancario));
      expect(tabela).toContain(n0(p.todos));
    }
    for (const m of gold.meses_parciais) {
      expect(tabela, `mês parcial ${m} na série`).not.toContain(mesAno(m));
      expect(texto(h), `mês parcial ${m} nomeado`).toContain(mesAno(m));
    }
    expect((tabela.match(/\b[a-z]{3}\/\d{4}\b/g) ?? []).length).toBe(fechados.length);
  });

  it("a classe escolhida na URL troca a série pela da gold", async () => {
    for (const g of gold.grupos) {
      const tabela = tabelaDa(await html({ classe: g.id }), "serie");
      const ult = g.serie.filter((p: { parcial: boolean }) => !p.parcial).at(-1);
      expect(tabela, g.id).toContain(`${mesAno(ult.mes)} ${n0(ult.bancario)} ${n0(ult.todos)}`);
    }
  });

  it("as quatro vias e as 27 UFs trazem os valores da gold, na medida escolhida", async () => {
    const h = await html();
    const vias = tabelaDa(h, "vias-12-meses");
    for (const g of gold.grupos) {
      expect(vias).toContain(g.nome);
      for (const v of [g.bancario.casos_12m, g.bancario.casos_12m_anterior, g.todos.casos_12m]) expect(vias, g.id).toContain(n0(v));
    }
    const casas: Record<string, number> = { por_mil_hab: 2, por_bi_carteira: 1, casos_12m: 0, var_12m_pct: 1 };
    for (const medida of Object.keys(casas)) {
      const tabela = tabelaDa(await html({ medida }), "estados");
      for (const u of gold.ufs) {
        expect(tabela, u.uf).toContain(u.nome);
        if (u[medida] == null) continue;
        expect(tabela, `${u.uf} ${medida}`).toContain(n(Math.abs(u[medida]), casas[medida]));
      }
      // a primeira linha é a de maior valor na medida (a ordem da vista antiga)
      const maior = [...gold.ufs].filter((u) => u[medida] != null).sort((a, b) => b[medida] - a[medida])[0];
      expect(tabela.indexOf(maior.nome)).toBe(Math.min(...gold.ufs.map((u: { nome: string }) => tabela.indexOf(` ${u.nome} `)).filter((i: number) => i >= 0)) + 1);
    }
  });

  it("os links internos levam a destinos que existem e o texto não tem valor cru", async () => {
    const h = await html();
    const internos = [...painel(h).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
    expect(internos.length).toBeGreaterThan(8);
    for (const href of internos) expect(existe(href), href).toBe(true);
    const t = texto(h);
    expect(t).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b|Infinity/);
    expect(t.match(/\b\d{4}-\d{2}(-\d{2})?\b/g) ?? [], "data crua").toEqual([]);
    expect(t, "travessão ou meia-risca no texto").not.toMatch(/[—–]/);
    expect(t).not.toMatch(/\bUTC\b/);
  });

  it("o HTML cabe no teto e o arquivo da série tem todos os meses, com os parciais marcados", async () => {
    expect(Buffer.byteLength(await html(), "utf-8")).toBeLessThan(600_000);
    const { csvSerie, goldCobranca } = await import("@/lib/familias/bancos-cobrando-na-justica");
    const g = goldCobranca();
    expect(g.disponivel).toBe(true);
    if (!g.disponivel) return;
    const linhas = csvSerie(g).split("\n").filter((l) => !l.startsWith("#"));
    expect(linhas[0]).toBe("mes;parcial;bancario;todos;execucao;busca_apreensao;monitoria;exec_hipotecaria");
    expect(linhas.length).toBe(gold.serie.length + 1);
    expect(linhas.filter((l) => l.split(";")[1] === "true").length).toBe(gold.meses_parciais.length);
  });
});
