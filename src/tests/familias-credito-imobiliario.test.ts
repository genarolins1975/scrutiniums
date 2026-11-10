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

const ROTA = "/credito-imobiliario";
/* eslint-disable @typescript-eslint/no-explicit-any -- gold JSON sem tipos gerados */
const gold: any = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/moradia.json"), "utf-8"));
const mun: any = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/moradia_mun.json"), "utf-8"));
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Painel Crédito imobiliário e moradia das Famílias (/credito-imobiliario), reescrita da vista /observatorio/housing-credit.
 * Invariantes, não texto: a anatomia do molde de painel (conferirPainel), os valores iguais aos da gold moradia.json, o arquivo por
 * município fora do HTML, a aritmética do simulador Price e SAC, destinos e âncoras existentes e nenhum undefined, NaN, data crua ou
 * travessão.
 */
describe("Crédito imobiliário e moradia das Famílias", () => {
  it("a gold está disponível e o arquivo por município é servido à parte", async () => {
    expect(gold.ok).toBe(true);
    expect(gold.municipios, "o corpo da gold não embute os municípios").toBeUndefined();
    const { ARQUIVO_MUNICIPIOS } = await import("@/lib/familias/credito-imobiliario");
    expect(existsSync(join(raiz, "public", ARQUIVO_MUNICIPIOS))).toBe(true);
    expect(mun.municipios.length).toBe(5570);
  });

  it("segue o molde de painel e não traz texto cru", async () => {
    const html = await renderizar(() => import("@/app/credito-imobiliario/page"));
    conferirPainel(ROTA, html);
    conferirTextoEDestinos(html);
    const faixa = html.slice(html.indexOf('data-fatia="numeros"'), html.indexOf("data-achados"));
    expect((faixa.match(/data-numero-indicador/g) ?? []).length).toBe(4);
    for (const id of ["como-mora", "carteira-origem"]) expect(html).toContain(`data-figura-analitica="${id}"`);
    for (const id of ["municipios", "onde-esta", "quem-financia", "peso", "simulador", "potencial"]) expect(html, id).toMatch(new RegExp(`<details id="${id}"[^>]*open`));
    // todo número fora da faixa também declara natureza e prova (as duas lacunas são estimativas)
    const estimados = [...html.matchAll(/data-natureza="ESTIMADO"/g)].length;
    expect(estimados).toBeGreaterThanOrEqual(2);
  }, 60_000);

  it("o arquivo por município não entra no HTML", async () => {
    const html = await renderizar(() => import("@/app/credito-imobiliario/page"));
    expect(html.length).toBeLessThan(400_000);
    // municípios que só existem no arquivo municipal (fora dos rankings e das demais listas da gold) não aparecem
    const corpo = JSON.stringify(gold);
    const soNoArquivo = mun.municipios.filter((m: { n: string }) => !corpo.includes(`"${m.n}"`)).slice(0, 400);
    expect(soNoArquivo.length).toBe(400);
    const { texto } = partes(html);
    const vazados = soNoArquivo.filter((m: { n: string }) => m.n.length > 9 && texto.includes(m.n));
    expect(vazados.map((m: { n: string }) => m.n)).toEqual([]);
    expect(html).toContain('data-consulta-municipal="espera"');
  }, 60_000);

  it("mostra os valores da gold, sem recalcular", async () => {
    const html = await renderizar(() => import("@/app/credito-imobiliario/page"));
    const { texto } = partes(html);
    const C = gold.censo;
    expect(texto).toContain(n(C.total / 1e6, 2));
    for (const c of C.categorias) {
      expect(texto, c.rot).toContain(c.rot);
      expect(texto, `${c.rot}: domicílios`).toContain(n(c.n));
    }
    for (const x of C.nao_coletado) expect(texto, x).toContain(x);
    // instituições, UFs, rankings, matriz, dicionário e limitações, todos presentes
    for (const i of gold.instituicoes) expect(texto, i.nome).toContain(i.nome);
    for (const e of gold.estados) expect(texto, e.nome).toContain(e.nome);
    for (const r of [...gold.rankings.maior_lacuna_saldo, ...gold.rankings.maior_lacuna_domicilios]) {
      expect(texto, r.n).toContain(r.n);
      expect(html, `perfil de ${r.n}`).toContain(`municipio=${r.c}#municipios`);
    }
    for (const m of gold.matriz_viabilidade) expect(texto, m.pergunta).toContain(m.pergunta);
    for (const d of gold.dicionario) expect(texto, d.t).toContain(d.t);
    // Auditoria de 10/11/2026, achados 2 e 9: os achados continuam na página (um por achado da gold), mas fração por extenso só aparece
    // se conferir com o número, e superlativo e advérbio de juízo não saem da gold para a tela. O título de quem não tem defeito é o da gold.
    const itens = html.match(/data-achados[\s\S]*?<\/ul>/)?.[0] ?? "";
    expect((itens.match(/<li/g) ?? []).length).toBe(gold.achados.length);
    const fracao = /\b(um|uma|dois|duas|três)\s+(terços?|quartos?|quintos?|sextos?|décimos?)\b|\bmetade\b/i;
    const juizo = /\bapenas\s+\d|\bquase nunca\b|\b(menor|maior|melhor|pior)\b[^.]*\bdo país\b/i;
    for (const a of gold.achados) if (!fracao.test(a.t) && !juizo.test(a.t)) expect(texto, a.t).toContain(a.t);
    expect(texto.match(new RegExp(fracao.source, "gi")) ?? [], "fração por extenso na página").toEqual([]);
    expect(texto.match(new RegExp(juizo.source, "gi")) ?? [], "juízo de valor vindo da gold").toEqual([]);
    // a frase da concentração cita o percentual que a gold publica, nos dois lugares em que aparece (achado e seção do verbete 169)
    const frase = `${n(gold.concentracao_contabil.part_dessas, 1)}% do saldo está escriturado em um ou dois municípios`;
    expect(texto.split(frase).length - 1, frase).toBe(2);
    // a inadimplência do achado é a dos dois segmentos que a gold publica
    expect(texto).toContain(`Inadimplência de ${n(gold.brasil.inad.sfh, 2)}% no SFH e de ${n(gold.brasil.inad.livre, 2)}% nas taxas de mercado`);
    expect((html.match(/data-limitacoes[\s\S]*?<\/ul>/)?.[0].match(/<li/g) ?? []).length).toBe(gold.limitacoes.length);
    // por segmento: a taxa e a prestação publicadas
    for (const k of ["sfh", "fgts", "livre", "home_equity", "comercial"]) {
      expect(texto, `taxa ${k}`).toContain(n(gold.brasil.taxa[k], 2));
      expect(texto, `prestação ${k}`).toContain(n(gold.brasil.parcela[k], 0));
    }
    // as duas estimativas
    expect(texto).toContain(n(gold.modelos.penetracao.lacuna_domicilios));
    expect(texto).toContain(n(gold.modelos.saldo.lacuna_total / 1e9, 1));
    // a série inteira da carteira está na tabela equivalente
    const figura = html.slice(html.indexOf('data-figura-analitica="carteira-origem"'), html.indexOf('id="quem-financia"'));
    expect((figura.match(/<tr/g) ?? []).length).toBe(gold.brasil.series.carteira.length + 1);
  }, 60_000);

  it("o simulador calcula Price e SAC pela taxa mensal composta e é identificado como cálculo", async () => {
    const { price, sac } = await import("@/components/familias/credito-imobiliario/SimuladorPrestacao");
    const pv = 177_498;
    const aoAno = 13.85;
    const prazo = 360;
    const i = Math.pow(1 + aoAno / 100, 1 / 12) - 1;
    const p = price(pv, aoAno, prazo);
    expect(p.i).toBeCloseTo(i, 12);
    expect(p.primeira).toBeCloseTo((pv * i) / (1 - Math.pow(1 + i, -prazo)), 6);
    expect(p.ultima).toBe(p.primeira);
    // a prestação constante quita o saldo: o valor presente das prestações é o valor financiado
    let saldo = pv;
    for (let k = 0; k < prazo; k++) saldo = saldo * (1 + i) - p.primeira;
    expect(Math.abs(saldo)).toBeLessThan(0.01);
    const s = sac(pv, aoAno, prazo);
    expect(s.primeira).toBeCloseTo(pv / prazo + pv * i, 6);
    expect(s.ultima).toBeCloseTo((pv / prazo) * (1 + i), 6);
    expect(s.primeira).toBeGreaterThan(p.primeira);
    // taxa zero: o valor dividido pelo prazo, sem divisão por zero
    expect(price(120_000, 0, 120).primeira).toBe(1000);

    // na página: o envelope de modelo didático, os avisos da gold e o resultado de partida calculado dos valores da gold
    const html = await renderizar(() => import("@/app/credito-imobiliario/page"));
    const bloco = html.slice(html.indexOf('<details id="simulador"'), html.indexOf('<details id="potencial"'));
    expect(bloco).toContain("data-simulador-prestacao");
    expect(bloco).toMatch(/Modelo didático/i);
    const { texto } = partes(bloco.replace("<details", "<details data-painel="));
    for (const a of gold.simulador.avisos) expect(texto, a).toContain(a.replace(/\s+[—–]\s+/g, ", "));
    const partida = gold.simulador.partida;
    const financiado = Math.round((partida.valor_imovel * partida.ltv_pct) / 100);
    const esperado = price(financiado, partida.taxa_aa_pct, partida.prazo_meses).primeira;
    expect(texto).toContain(`R$ ${n(esperado, 0)}`);
    expect(texto).toMatch(/não (é )?(uma )?previsão/);
  }, 60_000);
});
