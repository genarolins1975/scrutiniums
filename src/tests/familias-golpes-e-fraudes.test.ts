import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

/**
 * Painel "Golpes e fraudes" (/divida-das-familias/golpes-e-fraudes), reescrito da vista `fraudes` da aplicação do Crédito.
 * Invariantes, não texto: a anatomia do molde de painel, a prova e a natureza de cada número, o grau de evidência (A a E) e a situação
 * de cada indicador da síntese, os valores iguais aos das golds (fraudes.json, pulse.json), os destinos existentes e a pontuação da
 * plataforma.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/divida-das-familias/golpes-e-fraudes",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/golpes-e-fraudes";
const raiz = process.cwd();
const ler = (nome: string) => JSON.parse(readFileSync(join(raiz, "public/obs/data/gold", nome), "utf-8"));
const F = ler("fraudes.json");
const pulse = ler("pulse.json");
const abas = readFileSync(join(raiz, "src/lib/data/observatorioAbas.ts"), "utf-8");
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const SITUACAO: Record<string, string> = { oficial: "Fonte primária", calculado: "Calculado", estimativa: "Estimativa", imprensa: "Imprensa, aguarda fonte primária" };
const NATUREZA: Record<string, string> = { oficial: "OBSERVADO", calculado: "CALCULADO", estimativa: "ESTIMADO" };

type No = Parameters<typeof textoDe>[0];
function* nos(n: No): Generator<No> {
  yield n;
  for (const f of n.childNodes ?? []) yield* nos(f);
}
const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;

let html = "";
let doc: No;
let painel: No;
let texto = "";

beforeAll(async () => {
  const { default: Pagina } = await import("@/app/divida-das-familias/golpes-e-fraudes/page");
  html = renderToStaticMarkup((Pagina as () => ReactElement)());
  doc = parse(html) as unknown as No;
  painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
  texto = textoDe(painel);
}, 120_000);

describe("Golpes e fraudes no molde de painel", () => {
  it("cumpre a anatomia do molde (fatias, H1, lead, recorte, limite, figuras com tabela, proveniência e limite)", () => {
    conferirPainel(ROTA, html);
  });

  it("tem as duas figuras e os capítulos da vista antiga, na ordem dela", () => {
    const figuras = [...nos(doc)].filter((n) => attr(n, "data-figura-analitica") !== undefined).map((n) => attr(n, "id"));
    expect(figuras).toEqual(["dimensao", "credito"]);
    const capitulos = [...nos(doc)].filter((n) => attr(n, "data-recolhido") !== undefined).map((n) => attr(n, "id"));
    expect(capitulos).toEqual(["sintese", "canais", "tipos", "quem-sofre", "mitigacao", "evidencias", "linha-do-tempo"]);
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined).map((n) => attr(n, "id"));
    for (const id of ["perdas-bancos", "tentativas", "incidentes", "subnotificacao"]) expect(blocos, id).toContain(id);
  });

  it("os números de abertura são da síntese da gold, com natureza coerente com a situação, fonte, período e grau de evidência; nenhum é de imprensa", () => {
    const faixa = [...nos(painel)].find((n) => attr(n, "data-fatia") === "numeros")!;
    const numeros = [...nos(faixa)].filter((n) => attr(n, "data-numero-indicador") !== undefined);
    expect(numeros.length).toBeGreaterThanOrEqual(1);
    expect(numeros.length).toBeLessThanOrEqual(4);
    for (const n of numeros) {
      const k = (F.sintese as Record<string, string>[]).find((x) => x.rotulo === attr(n, "aria-label"));
      expect(k, attr(n, "aria-label")).toBeDefined();
      expect(k!.status).not.toBe("imprensa");
      expect(attr(n, "data-natureza")).toBe(NATUREZA[k!.status]);
      expect(attr(n, "data-prova-numero")).toBe(`${k!.fonte} · ${k!.data_ref}`);
      expect(attr(n, "data-ausente")).toBeUndefined();
      expect(textoDe(n)).toContain(k!.exibir);
      const grau = [...nos(n)].find((x) => attr(x, "data-grau-evidencia") !== undefined);
      expect(attr(grau!, "data-grau-evidencia")).toBe(k!.nivel);
    }
  });

  it("a síntese traz os oito indicadores com valor, período, grau de evidência e situação da gold", () => {
    expect(F.sintese.length).toBe(8);
    const sintese = [...nos(doc)].find((n) => attr(n, "id") === "sintese")!;
    const linhas = [...nos(sintese)].filter((n) => n.tagName === "tr").map(textoDe);
    for (const k of F.sintese) {
      const linha = linhas.find((l) => l.startsWith(k.rotulo));
      expect(linha, k.rotulo).toBeDefined();
      expect(linha).toContain(k.exibir);
      expect(linha).toContain(k.data_ref);
      expect(linha).toContain(`${k.nivel} · ${F.niveis[k.nivel].rotulo}`);
      expect(linha).toContain(SITUACAO[k.status]);
      expect(linha).toContain(k.fonte);
    }
    const legenda = [...nos(painel)].find((n) => attr(n, "data-legenda-graus") !== undefined)!;
    for (const n of ["A", "B", "C", "D", "E"]) expect(textoDe(legenda)).toContain(F.niveis[n].rotulo);
  });

  it("mostra os valores das golds, sem recalcular nem somar fontes", () => {
    const S = F.series;
    for (const o of S.estelionato.obs) expect(texto, o.ref).toContain(br(o.v));
    for (const o of S.perdas_febraban.obs) expect(texto, o.ref).toContain(br(o.v, 1));
    for (const o of S.serasa_tentativas.obs) expect(texto, o.ref).toContain(br(o.v, 3));
    for (const o of S.incidentes_ciberneticos.obs) expect(texto, o.ref).toContain(String(o.v));
    const taxa = S.med.obs.find((o: { metrica: string }) => o.metrica === "taxa_recuperacao");
    expect(texto).toContain(`${br(taxa.v, 1)}% do valor contestado`);
    const contestado = S.med.obs.find((o: { metrica: string }) => o.metrica === "valor_contestado");
    expect(texto).toContain(`R$ ${br(contestado.v, 1)} bi contestados`);
    for (const e of F.cadeia.elos) expect(texto, e.de).toContain(`${e.de} → ${e.para}`);
    for (const t of F.tipos.itens) expect(texto, t.tipo).toContain(t.tipo);
    for (const c of F.subnotificacao.camadas) expect(texto, c.rotulo).toContain(c.valor);
    for (const m of F.mitigacao.itens) expect(texto, m.rotulo).toContain(m.rotulo);
    for (const e of F.estudos) expect(texto, e.id).toContain(e.titulo);
    expect([...nos(doc)].filter((n) => attr(n, "data-linha-do-tempo") !== undefined).flatMap((n) => [...nos(n)].filter((x) => x.tagName === "li")).length).toBe(F.timeline.length);
    for (const d of F.metodologia.descartados) expect(texto, d.item).toContain(d.item);
    for (const c of F.metodologia.conceitos) expect(texto, c.termo).toContain(c.termo);
    const credito = [...nos(doc)].find((n) => attr(n, "id") === "credito")!;
    const tabela = textoDe(credito);
    for (const i of F.explorador.indicadores) {
      const s = pulse.series[i.key];
      expect(s, i.key).toBeDefined();
      expect(tabela, i.key).toContain(i.rotulo);
      expect(tabela, i.key).toContain(br(s.obs.at(-1).v, 2).replace("-", "−"));
    }
  });

  it("a página fica abaixo do teto de HTML", () => {
    expect(html.length).toBeLessThan(700_000);
  });

  it("texto sem travessão, sem hífen como pontuação, sem data crua, sem undefined e sem NaN", () => {
    expect(texto.match(/[—–]/g) ?? []).toEqual([]);
    expect(texto.match(/\s-\s/g) ?? []).toEqual([]);
    expect(texto.match(/\b\d{4}-\d{2}(-\d{2})?\b/g) ?? []).toEqual([]);
    expect(texto).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/);
  });

  it("os destinos internos existem (rota do app, vista da aplicação do Crédito ou arquivo publicado) e os externos são http", () => {
    const hrefs = [...nos(painel)].filter((n) => n.tagName === "a").map((n) => attr(n, "href") ?? "");
    expect(hrefs.length).toBeGreaterThan(20);
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
