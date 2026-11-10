import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

/**
 * Painel "Sanções e reclamações" (/divida-das-familias/sancoes-e-reclamacoes), reescrito da vista de conduta da aplicação do Crédito.
 * Invariantes, não texto: a anatomia do molde de painel, a prova e a natureza de cada número, os valores iguais aos da gold
 * (conduta.json), a regra editorial (listas nominais em ordem cronológica e não ordenáveis), os destinos existentes e a pontuação da
 * plataforma.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/divida-das-familias/sancoes-e-reclamacoes",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/sancoes-e-reclamacoes";
const raiz = process.cwd();
const D = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/conduta.json"), "utf-8"));
const abas = readFileSync(join(raiz, "src/lib/data/observatorioAbas.ts"), "utf-8");
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const dataBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

type No = Parameters<typeof textoDe>[0];
function* nos(n: No): Generator<No> {
  yield n;
  for (const f of n.childNodes ?? []) yield* nos(f);
}
const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;
const porId = (id: string) => [...nos(doc)].find((n) => attr(n, "id") === id)!;
const linhasDe = (n: No) => [...nos(n)].filter((x) => x.tagName === "tr").map((tr) => (tr.childNodes ?? []).filter((c) => c.tagName === "td" || c.tagName === "th").map(textoDe));

let html = "";
let doc: No;
let painel: No;
let texto = "";

beforeAll(async () => {
  const { default: Pagina } = await import("@/app/divida-das-familias/sancoes-e-reclamacoes/page");
  html = renderToStaticMarkup((Pagina as () => ReactElement)());
  doc = parse(html) as unknown as No;
  painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
  texto = textoDe(painel);
}, 120_000);

describe("Sanções e reclamações no molde de painel", () => {
  it("a gold tem as três réguas disponíveis (senão a página mostra a ausência declarada, e este teste precisa ser revisto)", () => {
    expect(D.disponivel && D.bcb.disponivel && D.cvm.disponivel && D.reclamacoes.disponivel).toBe(true);
  });

  it("cumpre a anatomia do molde (fatias, H1, lead, recorte, limite, figuras com tabela, proveniência e limite)", () => {
    conferirPainel(ROTA, html);
  });

  it("tem as cinco figuras das três réguas e o capítulo das listas recentes", () => {
    const figuras = [...nos(doc)].filter((n) => attr(n, "data-figura-analitica") !== undefined).map((n) => attr(n, "id"));
    expect(figuras).toEqual(["bcb", "bcb-multas", "bcb-12-meses", "cvm", "reclamacoes"]);
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined).map((n) => attr(n, "id"));
    for (const id of ["cobranca", "cvm-por-ano", "recentes-bcb", "recentes-cvm"]) expect(blocos, id).toContain(id);
  });

  it("os números de abertura trazem natureza, fonte e período, e os valores são os da janela de 12 meses da gold", () => {
    const faixa = [...nos(painel)].find((n) => attr(n, "data-fatia") === "numeros")!;
    const numeros = [...nos(faixa)].filter((n) => attr(n, "data-numero-indicador") !== undefined);
    expect(numeros.length).toBe(4);
    for (const n of numeros) {
      expect(["OBSERVADO", "CALCULADO"]).toContain(attr(n, "data-natureza"));
      const [fonte, periodo] = (attr(n, "data-prova-numero") ?? "").split(" · ");
      expect(fonte?.length, attr(n, "aria-label")).toBeGreaterThan(3);
      expect(periodo, attr(n, "aria-label")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
      expect(attr(n, "data-ausente")).toBeUndefined();
    }
    const t = textoDe(faixa);
    const j = D.bcb.janela_12m;
    for (const e of [br(j.processos), br(j.decisoes), `R$ ${br(j.multas_valor / 1e6, 1)} mi`, br(j.multas_n), br(D.bcb.inabilitados.vigentes), br(D.cvm.abertos_12m.processos), br(D.cvm.acervo.em_curso), br(D.bcb.janela_12m_anterior.processos)])
      expect(t, e).toContain(e);
  });

  it("mostra os valores da gold, sem recalcular", () => {
    const B = D.bcb, C = D.cvm, R = D.reclamacoes;
    const anual = linhasDe(porId("bcb"));
    for (const a of B.anual) {
      const linha = anual.find((l) => l[0]?.startsWith(a.ano));
      expect(linha, a.ano).toBeDefined();
      expect(linha!.slice(1, 4), a.ano).toEqual([br(a.processos), br(a.decisoes), br(a.multas_n)]);
      expect(linha![4], a.ano).toBe(br(a.multas_valor / 1e6, 1));
      expect(linha![5], a.ano).toBe(br(a.inabilitacoes));
      expect(linha![0].includes("parcial"), a.ano).toBe(Boolean(a.incompleto));
    }
    const doze = textoDe(porId("bcb-12-meses"));
    for (const p of B.penas_12m) expect(doze, p.pena).toContain(br(p.n));
    for (const c of B.cobranca_multas) expect(doze, c.situacao).toContain(br(c.share, 1));
    expect(doze).toContain(`mediana de ${br(B.tempo_citacao_decisao_meses.mediana)} meses`);
    for (const p of B.inabilitados.por_prazo) expect(linhasDe(porId("bcb-12-meses")).some((l) => l[1] === br(p.n) && l[2] === br(p.encerram_12m)), String(p.prazo_anos)).toBe(true);
    const cvm = textoDe(porId("cvm"));
    for (const f of C.fases) expect(cvm, f.fase).toContain(f.fase);
    for (const a of C.areas) expect(cvm, a.area).toContain(a.area);
    const porAno = linhasDe(porId("cvm-por-ano"));
    for (const a of C.anual) expect(porAno.some((l) => l[0]?.startsWith(a.ano) && l[1] === br(a.processos) && l[2] === br(a.acusados)), a.ano).toBe(true);
    const rec = linhasDe(porId("reclamacoes"));
    for (const p of R.serie) expect(rec.some((l) => l[1] === br(p.mediana, 1) && l[2] === br(p.p90, 1) && l[3] === br(p.n_instituicoes)), p.periodo).toBe(true);
    for (const c of D.catalogo) expect(texto, c.id).toContain(c.unidade);
  });

  it("as listas nominais seguem a ordem da gold (cronológica, da mais recente para a mais antiga) e não são ordenáveis", () => {
    const B = D.bcb, C = D.cvm;
    const bcb = linhasDe(porId("recentes-bcb")).slice(1);
    expect(bcb.map((l) => l[0])).toEqual(B.recentes.map((x: { decisao: string }) => dataBr(x.decisao)));
    expect(bcb.map((l) => l[1])).toEqual(B.recentes.map((x: { nome: string }) => x.nome));
    const datas = B.recentes.map((x: { decisao: string }) => x.decisao);
    expect([...datas].sort().reverse()).toEqual(datas);
    const cvm = linhasDe(porId("recentes-cvm")).slice(1);
    expect(cvm.map((l) => l[0])).toEqual(C.recentes.map((x: { abertura: string }) => dataBr(x.abertura)));
    const recentes = porId("recentes");
    expect([...nos(recentes)].filter((n) => attr(n, "data-tabela-ordenavel") !== undefined || attr(n, "aria-sort") !== undefined).length).toBe(0);
    // nenhuma tabela da página ordena instituição, multa ou nome
    expect([...nos(painel)].filter((n) => attr(n, "data-tabela-ordenavel") !== undefined).length).toBe(0);
  });

  it("a página fica abaixo do teto de HTML", () => {
    expect(html.length).toBeLessThan(700_000);
  });

  it("texto sem travessão, sem hífen como pontuação, sem data crua, sem undefined e sem NaN", () => {
    expect(texto.match(/[—–]/g) ?? []).toEqual([]);
    expect(texto.match(/\s-\s/g) ?? []).toEqual([]);
    expect(texto.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).toEqual([]);
    expect(texto.match(/\b20\d{2}-\d\b/g) ?? []).toEqual([]);
    expect(texto).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/);
  });

  it("os destinos internos existem (rota do app, vista da aplicação do Crédito ou arquivo publicado) e os externos são http", () => {
    const hrefs = [...nos(painel)].filter((n) => n.tagName === "a").map((n) => attr(n, "href") ?? "");
    expect(hrefs.length).toBeGreaterThan(4);
    for (const h of hrefs) {
      if (h.startsWith("#")) continue;
      if (h.startsWith("/observatorio/")) {
        expect(abas, h).toContain(`caminho: "${h.replace("/observatorio", "").split(/[?#]/)[0]}"`);
      } else if (h.startsWith("/")) {
        const caminho = h.split(/[?#]/)[0];
        expect(existsSync(join(raiz, "src/app", caminho, "page.tsx")) || existsSync(join(raiz, "public", caminho)), h).toBe(true);
      } else expect(h, h).toMatch(/^https?:\/\//);
    }
  });
});
