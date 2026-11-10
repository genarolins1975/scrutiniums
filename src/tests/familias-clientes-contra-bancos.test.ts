import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ABAS_OBSERVATORIO, PREFIXOS_DINAMICOS } from "@/lib/data/observatorioAbas";
import { conferirPainel } from "./suporte/molde-painel";

/**
 * Painel "Clientes contra bancos na Justiça" (/divida-das-familias/clientes-contra-bancos), reescrita em página Next da vista
 * `judicial` da aplicação do Crédito. A página é renderizada direto pelo componente e conferida por invariantes: a anatomia do molde
 * de painel, a natureza, o período e a fonte de cada número, os valores iguais aos da gold (public/obs/data/gold/judicial.json), a data
 * real da base (a coleta está retida desde 24/09/2026 e a página não pode aparentar atualidade), os destinos dos links e a ausência de
 * `undefined`, `NaN`, data crua e travessão. Nenhum texto literal além dos que identificam estrutura.
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

const ROTA = "/divida-das-familias/clientes-contra-bancos";
const raiz = process.cwd();
/* eslint-disable @typescript-eslint/no-explicit-any -- gold JSON sem tipos gerados */
const gold: any = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/judicial.json"), "utf-8"));
/* eslint-enable @typescript-eslint/no-explicit-any */
const n0 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const n = (v: number, casas: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const diaBr = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

async function html(ramo?: string): Promise<string> {
  caminho.atual = ROTA;
  const { default: Pagina } = await import("@/app/divida-das-familias/clientes-contra-bancos/page");
  return renderToStaticMarkup(Pagina({ searchParams: ramo ? { ramo } : {} }) as ReactElement);
}

/** O trecho do molde (o <main data-painel>), sem o cabeçalho da plataforma. */
const painel = (h: string) => h.slice(h.indexOf("data-painel="));
const texto = (h: string) => painel(h).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

/** Um destino interno existe: página do app, vista da aplicação do Crédito ou rota dinâmica dela. */
function existe(href: string): boolean {
  const c = href.split(/[?#]/)[0];
  if (c.startsWith("/observatorio/")) {
    const resto = c.slice("/observatorio".length);
    return ABAS_OBSERVATORIO.some((a) => a.caminho === resto) || PREFIXOS_DINAMICOS.some((p) => resto.startsWith(p.prefixo) && resto.length > p.prefixo.length);
  }
  return existsSync(join(raiz, "src/app", c, "page.tsx"));
}

describe("Clientes contra bancos na Justiça: molde e invariantes", () => {
  it.each(["civel", "trabalhista"])("o ramo %s segue o molde de painel", async (ramo) => {
    conferirPainel(ROTA, await html(ramo));
  });

  it("sem parâmetro, ou com parâmetro inválido, vale o ramo cível", async () => {
    const padrao = await html();
    expect(await html("qualquer-coisa")).toBe(padrao);
    expect(padrao).toBe(await html("civel"));
  });

  it("a página diz a data real da base, a que a gold declara, e não aparenta atualidade", async () => {
    const h = await html();
    const coleta = diaBr(gold.coletado_em);
    const aviso = h.match(/data-data-da-base="">([\s\S]*?)<\/p>/)?.[1] ?? "";
    expect(aviso, "aviso com a data da coleta").toContain(coleta);
    // a data da coleta acompanha a abertura, a faixa de números e cada figura da base nacional
    expect(h.match(/data-recorte="">[\s\S]*?<\/div>/)?.[0] ?? "").toContain(coleta);
    for (const prova of [...h.matchAll(/data-prova-numero="([^"]+)"/g)].map((m) => m[1])) expect(prova, "período do número").toContain(coleta);
    for (const id of ["natureza", "assuntos", "tribunais"]) {
      const figura = h.slice(h.indexOf(`data-figura-analitica="${id}"`));
      expect(figura.slice(0, figura.indexOf("</header>")), `figura ${id}`).toContain(coleta);
    }
    // nenhuma data do dia da renderização, nem palavra de atualidade
    const hoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
    if (hoje !== coleta) expect(texto(h)).not.toContain(hoje);
    expect(texto(h)).not.toMatch(/\b(hoje|atualizado diariamente|tempo real|dados atuais)\b/i);
    // a competência do TST é a publicada
    expect(texto(h).toLowerCase()).toContain(String(gold.camada_nominal.competencia).toLowerCase());
  });

  it.each(["civel", "trabalhista"] as const)("os números do ramo %s são os da gold", async (ramo) => {
    const h = await html(ramo);
    const N = gold.camada_nacional;
    const cats = N.categorias.filter((c: { ramo: string }) => c.ramo === ramo);
    const total = ramo === "civel" ? N.total_civel_casos : N.total_trabalhista_casos;
    const registros = cats.reduce((s: number, c: { registros: number }) => s + c.registros, 0);
    const faixa = h.slice(h.indexOf('data-fatia="numeros"'), h.indexOf('data-fatia="figuras"'));
    expect((faixa.match(/data-numero-indicador=""/g) ?? []).length).toBe(4);
    for (const esperado of [n0(total), n0(registros), n(registros / total, 2), n0(N.tribunais.filter((t: { ramo: string }) => t.ramo === ramo).length)]) expect(faixa, esperado).toContain(`>${esperado}<`);
    // cada categoria, cada assunto e cada tribunal do ramo está na página com o valor da gold
    const t = texto(h);
    for (const c of cats) expect(t, c.rotulo).toContain(n0(c.casos_unicos));
    for (const a of N.assuntos.filter((x: { ramo: string }) => x.ramo === ramo)) {
      expect(t, a.nome).toContain(n0(a.casos_unicos));
      expect(t, a.nome).toContain(String(a.codigo));
    }
    for (const tr of N.tribunais.filter((x: { ramo: string }) => x.ramo === ramo)) {
      expect(t, tr.tribunal).toContain(n0(tr.casos_unicos));
      for (const v of Object.values(tr.por_categoria as Record<string, number>)) expect(t, tr.tribunal).toContain(n0(v));
    }
    // o outro ramo não entra na faixa
    const outro = ramo === "civel" ? N.total_trabalhista_casos : N.total_civel_casos;
    expect(faixa).not.toContain(`>${n0(outro)}<`);
  });

  it("a base nominal traz os dez litigantes do TST, a marca de instituição financeira e a razão por tamanho da gold", async () => {
    const t = texto(await html());
    for (const l of gold.camada_nominal.linhas) {
      expect(t, l.parte).toContain(l.parte);
      expect(t, l.parte).toContain(n0(l.processos));
      if (l.eh_if) expect(t, l.parte).toContain(n(l.por_100bi_ativo, 1));
    }
    // as medidas declaradas indisponíveis seguem declaradas, sem número no lugar
    for (const d of gold.denominadores_indisponiveis) expect(t).toContain(d.metrica);
    for (const c of gold.catalogo) expect(t).toContain(c.nome);
  });

  it("toda natureza, período e fonte estão escritos em cada número e em cada figura", async () => {
    const h = await html();
    const numeros = [...h.matchAll(/data-natureza="([A-Z]+)"[^>]*data-prova-numero="([^"]+)"/g)];
    expect(numeros.length).toBeGreaterThanOrEqual(4);
    for (const [, natureza, prova] of numeros) {
      expect(["OBSERVADO", "CALCULADO"]).toContain(natureza);
      const [fonte, periodo] = prova.split(" · ");
      expect(fonte.length).toBeGreaterThan(3);
      expect(periodo).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    }
    const figuras = [...h.matchAll(/data-figura-analitica="([^"]+)"/g)].map((m) => m[1]);
    expect(figuras).toEqual(["natureza", "assuntos", "tribunais", "litigantes", "por-escala"]);
    expect((h.match(/data-proveniencia=""/g) ?? []).length).toBe(figuras.length);
  });

  it("os links internos levam a destinos que existem e o texto não tem valor cru", async () => {
    for (const ramo of ["civel", "trabalhista"]) {
      const h = await html(ramo);
      const internos = [...painel(h).matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
      expect(internos.length).toBeGreaterThan(3);
      // a página irmã (Bancos cobrando na Justiça) nasce na mesma leva: o arquivo dela tem de existir
      for (const href of internos) expect(existe(href), href).toBe(true);
      const t = texto(h);
      expect(t).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b|Infinity/);
      expect(t.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).toEqual([]);
      expect(t.match(/\d{4}-\d{2}T\d{2}/g) ?? []).toEqual([]);
      expect(t, "travessão ou meia-risca no texto").not.toMatch(/[—–]/);
    }
  });

  it("o HTML cabe no teto e o arquivo dos assuntos tem as linhas da gold", async () => {
    const h = await html();
    expect(Buffer.byteLength(h, "utf-8")).toBeLessThan(400_000);
    const { csvAssuntos, goldJudicial } = await import("@/lib/familias/clientes-contra-bancos");
    const g = goldJudicial();
    expect(g.disponivel).toBe(true);
    if (!g.disponivel) return;
    const linhas = csvAssuntos(g).split("\n");
    expect(linhas.length).toBe(gold.camada_nacional.assuntos.length + 1);
    expect(linhas[0].replace("﻿", "")).toBe("ramo;categoria;codigo_tpu;assunto;casos_unicos;registros");
  });
});
