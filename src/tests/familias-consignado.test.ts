import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

/**
 * Painel "Consignado e aposentados" das Famílias (/divida-das-familias/consignado), reescrito da vista `consignado` da aplicação do
 * Crédito. Invariantes, não texto: a anatomia do molde de painel, a prova e a natureza de cada número, os valores iguais aos da gold,
 * o arquivo municipal fora do HTML, os destinos existentes e a pontuação da plataforma.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/divida-das-familias/consignado",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/consignado";
const raiz = process.cwd();
const gold = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/consignado.json"), "utf-8"));
const mun = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/consignado_mun.json"), "utf-8")).municipios as Record<string, unknown>[];
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type No = Parameters<typeof textoDe>[0];
function* nos(n: No): Generator<No> {
  yield n;
  for (const f of n.childNodes ?? []) yield* nos(f);
}
const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;

let html = "";
let doc: No;
let texto = "";

beforeAll(async () => {
  const { default: Pagina } = await import("@/app/divida-das-familias/consignado/page");
  html = renderToStaticMarkup((Pagina as () => ReactElement)());
  doc = parse(html) as unknown as No;
  texto = textoDe(doc);
}, 120_000);

describe("Consignado e aposentados no molde de painel", () => {
  it("cumpre a anatomia do molde (fatias, H1, lead, recorte, limite, figuras com tabela, proveniência e limite)", () => {
    conferirPainel(ROTA, html);
  });

  it("tem as sete figuras e as duas tabelas da vista antiga, cada figura com gráfico ou mapa", () => {
    const figuras = [...nos(doc)].filter((n) => attr(n, "data-figura-analitica") !== undefined).map((n) => attr(n, "id"));
    expect(figuras).toEqual(["saldo", "idade", "previdencia", "municipios", "relacao", "saturacao", "instituicoes"]);
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined).map((n) => attr(n, "id"));
    for (const id of ["vinculo", "indicadores-nacionais", "especificacoes", "controles", "mecanismo", "criterios", "sensibilidade", "reclamacoes"]) expect(blocos, id).toContain(id);
  });

  it("todo número de indicador traz natureza, fonte e período, e nenhum está ausente", () => {
    const numeros = [...nos(doc)].filter((n) => attr(n, "data-numero-indicador") !== undefined);
    expect(numeros.length).toBeGreaterThanOrEqual(13);
    for (const n of numeros) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO", "CENARIO"]).toContain(attr(n, "data-natureza"));
      const [fonte, periodo] = (attr(n, "data-prova-numero") ?? "").split(" · ");
      expect(fonte?.length, attr(n, "aria-label")).toBeGreaterThan(3);
      expect(periodo, attr(n, "aria-label")).toMatch(/\d{4}/);
      expect(attr(n, "data-ausente"), attr(n, "aria-label")).toBeUndefined();
    }
  });

  it("mostra os valores da gold, sem recalcular", () => {
    const a = gold.sgs.atual, B = gold.brasil, T = gold.totais, C = gold.circularidade, I = gold.instituicoes;
    const esperados = [
      `${br(a.inss.inad, 2)}%`,
      `${br(a.privado.inad, 2)}%`,
      br(gold.reclamacoes.total),
      `R$ ${br(a.total.saldo / 1000, 1)} bi`,
      `R$ ${br(a.inss.saldo / 1000, 1)} bi`,
      `R$ ${br(gold.scr.aposentados_nacional / 1e9, 1)} bi`,
      `${br(B.a60 / 1e6, 2)} milhões`,
      `${br(B.beneficios / 1e6, 2)} mi`,
      `${br(B.peso, 1)}%`,
      br(T.dependencia_acima_50),
      br(T.incoerentes),
      br(T.selos.alta),
      br(T.saturacao.possivel_saturacao),
      `${br(I.stats.mediana, 2)}%`,
      br(C.correlacao_mecanica, 3).replace("-", "−"),
    ];
    for (const e of esperados) expect(texto, e).toContain(e);
    for (const e of C.especificacoes) expect(texto, e.rotulo).toContain(br(e.r, 3).replace("-", "−"));
    for (const r of I.ranking) expect(texto, r.nome).toContain(r.nome);
    for (const e of gold.estados) expect(texto, e.uf).toContain(`${e.nome} (${e.uf})`);
    for (const e of gold.linha_do_tempo) expect(texto, e.d).toContain(e.d.split("-").reverse().join("/"));
  });

  it("o resumo municipal do servidor é o recorte padrão da gold municipal, com as regras da vista antiga", () => {
    const base = mun.filter((m) => m.sel !== "baixa");
    const maior = base.filter((m) => m.p60 != null).sort((x, y) => (y.p60 as number) - (x.p60 as number))[0];
    expect(texto).toContain(String(maior.n));
    const sensivel = base.filter((m) => m.indice != null && ((m.pop as number) || 0) >= 20000).sort((x, y) => (y.indice as number) - (x.indice as number))[0];
    expect(texto).toContain(String(sensivel.n));
    const acima50 = base.filter((m) => m.peso != null && (m.peso as number) >= 50).length;
    expect(texto).toContain(br(acima50));
    expect(texto).toContain(`${br(base.length)} municípios sem confiabilidade baixa`);
  });

  it("o arquivo municipal não entra no HTML: só o resumo, e a página fica abaixo do teto", () => {
    expect(html.length).toBeLessThan(700_000);
    const nomes = new Set(mun.map((m) => String(m.n)));
    // o HTML cita no máximo os municípios dos dois resumos (25 e 15), nunca a base inteira
    const citados = [...nomes].filter((nome) => nome.length > 12 && html.includes(`>${nome}<`)).length;
    expect(citados).toBeLessThanOrEqual(40);
    expect(html).toContain('data-explorador-municipios="parado"');
    expect(html).not.toContain("consignado_mun.json");
  });

  it("texto sem travessão, sem data crua, sem undefined e sem NaN", () => {
    const painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
    // nomes oficiais (instituições e a modalidade do Banco Central) ficam na forma da fonte, que usa hífen; o resto do texto não
    const oficiais: string[] = [gold.instituicoes.modalidade, ...gold.instituicoes.ranking.map((r: { nome: string }) => r.nome), ...gold.reclamacoes.instituicoes.map((r: { nome: string }) => r.nome)];
    const t = oficiais.sort((x, y) => y.length - x.length).reduce((acc, nome) => acc.split(nome).join("NOME"), textoDe(painel));
    expect(t.match(/[—–]/g) ?? []).toEqual([]);
    expect(t).not.toMatch(/\s-\s/);
    expect(t.match(/\b\d{4}-\d{2}(-\d{2})?\b/g) ?? []).toEqual([]);
    expect(t).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/);
  });

  it("os destinos internos existem como rota do app e os externos são https", () => {
    const painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
    const hrefs = [...nos(painel)].filter((n) => n.tagName === "a").map((n) => attr(n, "href") ?? "");
    expect(hrefs.length).toBeGreaterThan(2);
    for (const h of hrefs) {
      if (h.startsWith("#")) continue;
      if (h.startsWith("/")) {
        const caminho = h.split(/[?#]/)[0];
        expect(existsSync(join(raiz, "src/app", caminho, "page.tsx")), h).toBe(true);
      } else expect(h, h).toMatch(/^https:\/\//);
    }
  });
});
