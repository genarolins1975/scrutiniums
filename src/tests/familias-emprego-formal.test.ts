import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";

// O Next instala o AsyncLocalStorage global no servidor dele; o teste faz o mesmo antes dos imports (como painel-molde-gas-saneamento-credito.test.ts)
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => ROTA,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const raiz = process.cwd();
const n = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const rotasDoApp: string[] = JSON.parse(readFileSync(join(raiz, "src/lib/uso/rotas-do-app.json"), "utf-8"));

/** O destino interno existe: página de src/app (estática ou padrão dinâmico) ou a aplicação do Crédito (/observatorio/...). */
function destinoExiste(href: string): boolean {
  const rota = href.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (rota === ROTA) return existsSync(join(raiz, "src/app", ROTA, "page.tsx"));
  if (rota.startsWith("/observatorio/")) return existsSync(join(raiz, "src/app/observatorio/[[...rota]]"));
  if (existsSync(join(raiz, "src/app", rota, "page.tsx"))) return true;
  return rotasDoApp.some((p) =>
    new RegExp(`^${p.replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(?:/.+)?").replace(/\/\[\.\.\.[^\]]+\]/g, "/.+").replace(/\/\[[^\]]+\]/g, "/[^/]+")}$`).test(rota),
  );
}

/** HTML do molde (do elemento data-painel em diante) e o texto visível dele, sem marcação. */
function partes(html: string): { painel: string; texto: string } {
  const painel = html.slice(html.indexOf("data-painel="));
  const texto = painel.replace(/<(script|style)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
  return { painel, texto };
}

/** Invariantes de texto e de navegação comuns: nada de undefined, NaN, data crua ou travessão; âncoras e destinos internos existem. */
function conferirTextoEDestinos(html: string): void {
  const { painel, texto } = partes(html);
  expect(texto).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/);
  expect(texto.match(/\b(?:19|20)\d{2}-\d{2}(?:-\d{2})?\b/g) ?? [], "data crua no texto").toEqual([]);
  expect(texto.match(/[—–]/g) ?? [], "travessão no texto exibido").toEqual([]);
  expect(texto.match(/\s-\s/g) ?? [], "hífen como pontuação no texto exibido").toEqual([]);
  const hrefs = [...painel.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  expect(hrefs.length).toBeGreaterThan(3);
  for (const h of hrefs) {
    if (h.startsWith("#")) expect(html.includes(`id="${h.slice(1)}"`), `âncora ${h}`).toBe(true);
    else if (h.startsWith("/")) expect(destinoExiste(h), `destino ${h}`).toBe(true);
    else expect(h, `link externo ${h}`).toMatch(/^https?:\/\//);
  }
}

async function renderizar(carregar: () => Promise<{ default: () => unknown }>): Promise<string> {
  const { default: Pagina } = await carregar();
  let el = Pagina();
  if (el instanceof Promise) el = await el;
  return renderToStaticMarkup(el as ReactElement);
}

const ROTA = "/emprego-formal";
/* eslint-disable @typescript-eslint/no-explicit-any -- gold JSON sem tipos gerados */
const gold: any = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/emprego.json"), "utf-8"));
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Painel Emprego formal das Famílias (/emprego-formal), reescrita da vista /observatorio/formal-employment. Invariantes, não texto:
 * a anatomia do molde de painel (conferirPainel: natureza, período e fonte de cada número; tabela, proveniência e limite de cada
 * figura), os valores iguais aos da gold emprego.json, destinos e âncoras existentes e nenhum undefined, NaN, data crua ou travessão.
 */
describe("Emprego formal das Famílias", () => {
  it("a gold está disponível e tem o que a página lê", () => {
    expect(gold.disponivel).toBe(true);
    expect(gold.setores.some((s: { key: string }) => s.key === "total")).toBe(true);
    expect(gold.ufs.length).toBe(27);
  });

  it("segue o molde de painel e não traz texto cru", async () => {
    const html = await renderizar(() => import("@/app/emprego-formal/page"));
    conferirPainel(ROTA, html);
    conferirTextoEDestinos(html);
    // quatro números na faixa, todos com natureza declarada
    const faixa = html.slice(html.indexOf('data-fatia="numeros"'), html.indexOf("data-sintese"));
    expect((faixa.match(/data-numero-indicador/g) ?? []).length).toBe(4);
    // cinco figuras, cada uma com âncora própria
    for (const id of ["brasil-saldo", "brasil-estoque", "secoes", "ufs", "risco-setorial"]) expect(html).toContain(`data-figura-analitica="${id}"`);
  }, 60_000);

  it("mostra os valores da gold, sem recalcular", async () => {
    const html = await renderizar(() => import("@/app/emprego-formal/page"));
    const { texto } = partes(html);
    const B = gold.brasil;
    const sinal = (v: number) => (v > 0 ? `+${n(v)}` : v < 0 ? `−${n(Math.abs(v))}` : n(v));
    // os números da abertura e a nota da faixa
    for (const v of [n(B.estoque), sinal(B.saldo_mes), sinal(B.saldo_mes_sa), sinal(B.saldo_12m), sinal(B.saldo_12m_anterior), n(B.admissoes_mes), n(B.desligamentos_mes)]) expect(texto, v).toContain(v);
    const total = gold.setores.find((s: { key: string }) => s.key === "total");
    expect(texto).toContain(`${total.yoy_pct > 0 ? "+" : "−"}${n(Math.abs(total.yoy_pct), 2)}%`);
    // toda seção e toda UF aparecem com o estoque e o saldo publicados
    for (const s of gold.setores.filter((x: { key: string }) => x.key !== "total")) {
      expect(texto, s.nome).toContain(s.nome);
      expect(texto, `${s.nome}: estoque`).toContain(n(s.estoque));
    }
    for (const u of gold.ufs) {
      expect(texto, u.nome).toContain(`${u.nome} (${u.uf})`);
      expect(texto, `${u.nome}: admissões`).toContain(n(u.admissoes_12m));
      expect(html, `${u.uf}: página do estado`).toContain(`href="/observatorio/states/${u.uf}"`);
    }
    // a série mensal inteira está na tabela equivalente da primeira figura
    const figura = html.slice(html.indexOf('data-figura-analitica="brasil-saldo"'), html.indexOf('data-figura-analitica="brasil-estoque"'));
    expect((figura.match(/<tr/g) ?? []).length).toBe(gold.serie.length + 1);
    // catálogo e cautelas do método
    const { textoDaGold } = await import("@/lib/familias/emprego-formal");
    for (const c of gold.catalogo) expect(texto, c.nome).toContain(textoDaGold(c.nome));
    expect((html.slice(html.indexOf('data-fatia="metodo"')).match(/<li/g) ?? []).length).toBeGreaterThanOrEqual(gold.cautelas.length);
  }, 60_000);

  it("ausência não vira zero: seção sem parte do total sai como texto", async () => {
    const html = await renderizar(() => import("@/app/emprego-formal/page"));
    const semParte = gold.setores.filter((s: { key: string; share_pct: number | null }) => s.key !== "total" && s.share_pct === null).length;
    const tabela = html.slice(html.indexOf('data-figura-analitica="secoes"'), html.indexOf('data-figura-analitica="ufs"'));
    expect((tabela.match(/sem dado/g) ?? []).length).toBeGreaterThanOrEqual(semParte);
  }, 60_000);

  it("o texto da gold sai na forma da página", async () => {
    const { textoDaGold } = await import("@/lib/familias/emprego-formal");
    expect(textoDaGold("até 2026-08 (z -0,8, +1,9% a/a) — fim")).toBe("até ago/2026 (desvio −0,8, +1,9% em 12 meses), fim");
    expect(textoDaGold("data-base 2026-07-31")).toBe("data-base 31/07/2026");
    expect(textoDaGold("SGS 28763 a 28804")).toBe("SGS 28763 a 28804");
  });
});
