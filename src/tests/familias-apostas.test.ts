import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

/**
 * Painel "Apostas e crédito das famílias" (/divida-das-familias/apostas), reescrito da vista `bets` da aplicação do Crédito.
 * Invariantes, não texto: a anatomia do molde de painel, a prova e a natureza de cada número, o grau de evidência (A a E) e a situação
 * de cada indicador da síntese, os valores iguais aos das golds (bets.json, epae.json, pulse.json), os destinos existentes e a
 * pontuação da plataforma.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/divida-das-familias/apostas",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/apostas";
const raiz = process.cwd();
const ler = (nome: string) => JSON.parse(readFileSync(join(raiz, "public/obs/data/gold", nome), "utf-8"));
const B = ler("bets.json");
const E = ler("epae.json");
const pulse = ler("pulse.json");
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mesAno = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(0, 4)}`;
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
  const { default: Pagina } = await import("@/app/divida-das-familias/apostas/page");
  html = renderToStaticMarkup((Pagina as () => ReactElement)());
  doc = parse(html) as unknown as No;
  painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
  texto = textoDe(painel);
}, 120_000);

describe("Apostas e crédito das famílias no molde de painel", () => {
  it("cumpre a anatomia do molde (fatias, H1, lead, recorte, limite, figuras com tabela, proveniência e limite)", () => {
    conferirPainel(ROTA, html);
  });

  it("tem as quatro figuras e os capítulos da vista antiga, na ordem dela", () => {
    const figuras = [...nos(doc)].filter((n) => attr(n, "data-figura-analitica") !== undefined).map((n) => attr(n, "id"));
    expect(figuras).toEqual(["mercado-regulado", "credito", "autoexclusao", "pix-da-secao"]);
    const capitulos = [...nos(doc)].filter((n) => attr(n, "data-recolhido") !== undefined).map((n) => attr(n, "id"));
    expect(capitulos).toEqual(["sintese", "canais", "quem-aposta", "vulnerabilidade", "mercado-ilegal", "evidencias", "linha-do-tempo"]);
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined).map((n) => attr(n, "id"));
    for (const id of ["quantos-apostam", "arrecadacao", "bloqueios", "perfil-sigap", "perfil-datasenado", "gasto-declarado", "regioes", "pesquisas-privadas", "grupos-expostos", "motivos", "pix-por-ano", "observado-e-atribuido"])
      expect(blocos, id).toContain(id);
  });

  it("os números de abertura são da síntese da gold, com natureza coerente com a situação, fonte, período e grau de evidência; nenhum é de imprensa", () => {
    const faixa = [...nos(painel)].find((n) => attr(n, "data-fatia") === "numeros")!;
    const numeros = [...nos(faixa)].filter((n) => attr(n, "data-numero-indicador") !== undefined);
    expect(numeros.length).toBeGreaterThanOrEqual(1);
    expect(numeros.length).toBeLessThanOrEqual(4);
    for (const n of numeros) {
      const k = (B.sintese as Record<string, string>[]).find((x) => x.rotulo === attr(n, "aria-label"));
      expect(k, attr(n, "aria-label")).toBeDefined();
      expect(k!.status).not.toBe("imprensa");
      expect(attr(n, "data-natureza")).toBe(NATUREZA[k!.status]);
      expect(attr(n, "data-prova-numero")).toBe(`${k!.fonte} · ${k!.data_ref}`);
      expect(attr(n, "data-ausente")).toBeUndefined();
      const t = textoDe(n);
      expect(t).toContain(k!.exibir);
      const grau = [...nos(n)].find((x) => attr(x, "data-grau-evidencia") !== undefined);
      expect(attr(grau!, "data-grau-evidencia")).toBe(k!.nivel);
    }
  });

  it("a síntese traz os oito indicadores com valor, período, grau de evidência e situação da gold", () => {
    expect(B.sintese.length).toBe(8);
    const sintese = [...nos(doc)].find((n) => attr(n, "id") === "sintese")!;
    const linhas = [...nos(sintese)].filter((n) => n.tagName === "tr").map(textoDe);
    for (const k of B.sintese) {
      const linha = linhas.find((l) => l.startsWith(k.rotulo));
      expect(linha, k.rotulo).toBeDefined();
      expect(linha).toContain(k.exibir);
      expect(linha).toContain(k.data_ref);
      expect(linha).toContain(`${k.nivel} · ${B.niveis[k.nivel].rotulo}`);
      expect(linha).toContain(SITUACAO[k.status]);
      expect(linha).toContain(k.fonte);
    }
    // a escala de A a E fica junto dos números, com o rótulo de cada grau
    const legenda = [...nos(painel)].find((n) => attr(n, "data-legenda-graus") !== undefined)!;
    for (const n of ["A", "B", "C", "D", "E"]) expect(textoDe(legenda)).toContain(B.niveis[n].rotulo);
  });

  it("mostra os valores das golds, sem recalcular", () => {
    const S = B.series;
    for (const o of S.ggr_regulado.obs) expect(texto, o.ref).toContain(`R$ ${br(o.v, 1)} bi`);
    for (const o of S.apostadores.obs) expect(texto, o.ref).toContain(br(o.v, 1));
    const arr = S.arrecadacao.obs.find((o: { ref: string }) => o.ref === "2025");
    for (const c of ["tributos", "destinacoes", "outorgas", "taxa_fiscalizacao"]) expect(texto, c).toContain(br(arr[c], 2));
    for (const o of S.autoexclusao.obs) expect(texto, o.ref).toContain(o.ref.split("-").reverse().join("/"));
    for (const o of S.bloqueios_ilegais.obs) expect(texto, o.ref).toContain(o.ref.split("-").reverse().join("/"));
    for (const e of B.cadeia.elos) expect(texto, e.de).toContain(`${e.de} → ${e.para}`);
    for (const e of B.estudos) expect(texto, e.id).toContain(e.titulo);
    expect([...nos(doc)].filter((n) => attr(n, "data-linha-do-tempo") !== undefined).flatMap((n) => [...nos(n)].filter((x) => x.tagName === "li")).length).toBe(B.timeline.length);
    for (const d of B.metodologia.descartados) expect(texto, d.item).toContain(d.item);
    for (const c of B.metodologia.conceitos) expect(texto, c.termo).toContain(c.termo);
    // Pix da seção: último mês, anos civis e a comparação entre observado e atribuído
    const ult = E.serie.obs.at(-1);
    expect(texto).toContain(`Em ${mesAno(ult.ref)}, último mês publicado, as pessoas pagaram R$ ${br(ult.pf_para_secao, 1)} bi`);
    for (const a of E.anuais) expect(texto, String(a.ano)).toContain(br(a.liquido, 1).replace("-", "−"));
    expect(texto).toContain(br(E.comparacao.observado.valor, 1));
    expect(texto).toContain(br(E.comparacao.atribuido_estudo.valor, 1));
    // explorador: a tabela equivalente traz o último valor publicado de cada indicador que a gold de crédito tem
    const credito = [...nos(doc)].find((n) => attr(n, "id") === "credito")!;
    const tabela = textoDe(credito);
    for (const i of B.explorador.indicadores) {
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

  it("os destinos internos existem (rota do app ou arquivo publicado) e os externos são http", () => {
    const hrefs = [...nos(painel)].filter((n) => n.tagName === "a").map((n) => attr(n, "href") ?? "");
    expect(hrefs.length).toBeGreaterThan(20);
    for (const h of hrefs) {
      if (h.startsWith("#")) continue;
      if (h.startsWith("/")) {
        const caminho = h.split(/[?#]/)[0];
        expect(existsSync(join(raiz, "src/app", caminho, "page.tsx")) || existsSync(join(raiz, "public", caminho)), h).toBe(true);
      } else expect(h, h).toMatch(/^https?:\/\//);
    }
  });
});
