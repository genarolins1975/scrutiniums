import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "parse5";
import { conferirPainel, textoDe } from "./suporte/molde-painel";

/**
 * Painel "Desenrola Brasil" das Famílias (/divida-das-familias/desenrola), reescrito da vista `desenrola` da aplicação do Crédito.
 * Invariantes, não texto: a anatomia do molde de painel, a prova e a natureza de cada número, os valores iguais aos da gold, as
 * ausências declaradas (nunca zero), a geometria do mapa fora do HTML, os destinos existentes e a pontuação da plataforma.
 */

vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/divida-das-familias/desenrola",
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

const ROTA = "/divida-das-familias/desenrola";
const raiz = process.cwd();
const gold = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/desenrola.json"), "utf-8"));
const pulso = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/pulse.json"), "utf-8"));
const br = (v: number, casas = 0) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

type No = Parameters<typeof textoDe>[0];
function* nos(n: No): Generator<No> {
  yield n;
  for (const f of n.childNodes ?? []) yield* nos(f);
}
const attr = (n: No, nome: string) => n.attrs?.find((a) => a.name === nome)?.value;
const porId = (id: string) => [...nos(doc)].find((n) => attr(n, "id") === id)!;

let html = "";
let doc: No;
let texto = "";

beforeAll(async () => {
  const { default: Pagina } = await import("@/app/divida-das-familias/desenrola/page");
  html = renderToStaticMarkup((Pagina as () => ReactElement)());
  doc = parse(html) as unknown as No;
  texto = textoDe(doc);
}, 120_000);

describe("Desenrola Brasil no molde de painel", () => {
  it("cumpre a anatomia do molde (fatias, H1, lead, recorte, limite, figuras com tabela, proveniência e limite)", () => {
    conferirPainel(ROTA, html);
  });

  it("tem as seis figuras e os blocos de tabela da vista antiga, e o índice local aponta só para âncoras que existem", () => {
    const figuras = [...nos(doc)].filter((n) => attr(n, "data-figura-analitica") !== undefined).map((n) => attr(n, "id"));
    expect(figuras).toEqual(["alcance", "valores", "onde", "credores", "contexto", "viabilidade"]);
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined).map((n) => attr(n, "id"));
    for (const id of ["concentracao-no-tempo", "participacao-das-faixas", "lacunas-funil", "lacunas-valores", "conceitos", "lacunas-perfil", "lacunas-credores", "avaliacao", "arquitetura", "pequenos-negocios", "linha-do-tempo", "depois", "fiscal"])
      expect(blocos, id).toContain(id);
    const ids = new Set([...nos(doc)].map((n) => attr(n, "id")).filter(Boolean));
    const ancoras = [...nos(doc)].filter((n) => n.tagName === "a" && (attr(n, "href") ?? "").startsWith("#")).map((n) => attr(n, "href")!.slice(1));
    expect(ancoras.length).toBeGreaterThanOrEqual(10);
    for (const a of ancoras) expect(ids.has(a), `âncora #${a}`).toBe(true);
  });

  it("todo número de indicador traz natureza, fonte e período, e nenhum está ausente", () => {
    const numeros = [...nos(doc)].filter((n) => attr(n, "data-numero-indicador") !== undefined);
    expect(numeros.length).toBe(10);
    for (const n of numeros) {
      expect(["OBSERVADO", "CALCULADO", "ESTIMADO"]).toContain(attr(n, "data-natureza"));
      const [fonte, periodo] = (attr(n, "data-prova-numero") ?? "").split(" · ");
      expect(fonte?.length, attr(n, "aria-label")).toBeGreaterThan(3);
      expect(periodo, attr(n, "aria-label")).toMatch(/\d{4}/);
      expect(attr(n, "data-ausente"), attr(n, "aria-label")).toBeUndefined();
    }
    // os quatro números de abertura são os oficiais do programa, com o rótulo e a natureza que a gold registra (reportado = observado)
    const abertura = [...nos(doc)].find((n) => attr(n, "data-fatia") === "numeros")!;
    const rotulos = [...nos(abertura)].filter((n) => attr(n, "data-numero-indicador") !== undefined).map((n) => attr(n, "aria-label"));
    const oficial = (id: string) => gold.oficiais.find((o: { id: string }) => o.id === id);
    expect(rotulos).toEqual(["elegiveis", "renegociaram", "regularizado", "beneficiados"].map((id) => oficial(id).rotulo));
    for (const id of ["elegiveis", "renegociaram", "regularizado", "beneficiados"]) expect(oficial(id).selo).toBe("reportado");
    // a ressalva de grandeza da gold ("menos de", "mais de") acompanha o número, nunca some
    expect(textoDe(abertura)).toContain("(menos de)");
    expect(textoDe(abertura)).toContain("(mais de)");
  });

  it("mostra os valores da gold, sem recalcular", () => {
    const S = gold.totais_scr, K = gold.concentracao, PN = gold.pequenos_negocios;
    const oficial = (id: string) => gold.oficiais.find((o: { id: string }) => o.id === id).valor as number;
    const esperados = [
      `${br(oficial("elegiveis") / 1e6)} milhões`,
      `${br(oficial("renegociaram") / 1e6)} milhões`,
      `${br(oficial("beneficiados") / 1e6)} milhões`,
      `R$ ${br(oficial("regularizado") / 1e9)} bi`,
      `R$ ${br(oficial("leilao_antes") / 1e9)} bi`,
      `R$ ${br(oficial("leilao_depois") / 1e9)} bi`,
      br(S.operacoes),
      `R$ ${br(S.volume / 1e9, 2)} bi`,
      `R$ ${br(S.ticket_medio)}`,
      `${br(gold.reconciliacao.razao, 1)} vezes`,
      `${br(K.top5_operacoes, 1)}%`,
      br(K.hhi_operacoes),
      br(PN.operacoes),
      br(PN.ticket_medio),
      br(gold.linhas_base),
      br(gold.fora_do_recorte.linhas),
    ];
    for (const e of esperados) expect(texto, e).toContain(e);
    for (const c of gold.componentes.filter((x: { no_scr: boolean; contexto?: boolean }) => x.no_scr && !x.contexto)) {
      expect(texto, c.nome).toContain(br(c.operacoes));
      expect(texto, c.nome).toContain(`R$ ${br(c.ticket_medio)}`);
    }
    for (const u of gold.mapa) {
      const linha = textoDe([...nos(porId("onde"))].find((n) => n.tagName === "tr" && textoDe(n).startsWith(`${u.nome} (${u.uf})`))!);
      expect(linha, u.uf).toContain(br(u.operacoes));
      expect(linha, u.uf).toContain(br(u.part_op, 2));
      expect(linha, u.uf).toContain(br(u.ticket_medio));
      expect(linha, u.uf).toContain(br(u.op_por_mil_hab, 1));
    }
    for (const i of gold.instituicoes) {
      expect(texto, i.nome).toContain(i.nome);
      expect(texto, i.nome).toContain(br(i.operacoes));
    }
    for (const e of gold.linha_do_tempo) expect(texto, e.data).toContain(e.data.split("-").reverse().join("/"));
    expect([...nos(porId("viabilidade"))].filter((n) => n.tagName === "tr").length).toBeGreaterThanOrEqual(gold.matriz_viabilidade.length);
    for (const s of ["viavel", "parcial", "indisponivel"]) {
      const quantos = gold.matriz_viabilidade.filter((m: { status: string }) => m.status === s).length;
      expect(textoDe(porId("viabilidade")), s).toMatch(new RegExp(`\\b${quantos} (são viáveis|são parciais|estão indisponíveis)`));
    }
  });

  it("a série mensal é a da gold: uma linha por data-base, ausência como texto e nunca como zero, e o mês acumulado marcado", () => {
    const tabela = [...nos(porId("alcance"))].find((n) => attr(n, "data-tabela-equivalente") !== undefined)!;
    const linhas = [...nos(tabela)].filter((n) => n.tagName === "tr").slice(1).map(textoDe);
    expect(linhas.length).toBe(gold.serie.length);
    expect(gold.serie.length).toBe(gold.meses);
    gold.serie.forEach((m: { acumulado: boolean; faixa1?: { operacoes: number }; faixa2?: { operacoes: number } }, i: number) => {
      for (const f of [m.faixa1, m.faixa2]) if (f?.operacoes) expect(linhas[i], `mês ${i}`).toContain(br(f.operacoes));
      if (!m.faixa1) expect(linhas[i], `mês ${i} sem Faixa 1`).toContain("sem dado");
      expect(linhas[i].includes("acumulado"), `mês ${i}`).toBe(Boolean(m.acumulado));
    });
    // a divisão entre o período do programa e o depois fecha no total da base
    const conc = [...nos(porId("concentracao-no-tempo"))].filter((n) => n.tagName === "tr").slice(1);
    const numero = (tr: No, j: number) => Number(textoDe([...nos(tr)].filter((n) => n.tagName === "td")[j]).replace(/\./g, ""));
    expect(numero(conc[0], 0) + numero(conc[1], 0)).toBe(gold.totais_scr.operacoes);
  });

  it("as séries de contexto vêm do pulso, com o último valor publicado de cada uma", () => {
    const fig = textoDe(porId("contexto"));
    for (const s of gold.series_contexto) {
      const obs = pulso.series[s.chave].obs as { ref: string; v: number }[];
      const ultimo = obs[obs.length - 1];
      expect(fig, s.chave).toContain(br(ultimo.v, String(s.unidade).startsWith("R$") ? 0 : 2));
    }
    expect(fig).toContain(gold.avaliacao.autores);
    for (const r of gold.avaliacao.resultados) expect(fig).toContain(String(r.forca).slice(0, 40));
  });

  it("a geometria do mapa não entra no HTML e a página fica abaixo do teto", () => {
    expect(html.length).toBeLessThan(700_000);
    expect(html).not.toContain(String(gold.geo.paths["35"]).slice(0, 60));
    expect(html).toContain('data-mapa-por-uf="operacoes"');
    expect(html).toContain('data-comparar-credores="0"');
  });

  it("texto sem travessão, sem caixa alta de ênfase, sem data crua, sem undefined e sem NaN", () => {
    const painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
    // nomes oficiais dos grupos credores ficam na forma da fonte, que usa hífen; o resto do texto não
    const oficiais: string[] = gold.instituicoes.flatMap((i: { nome: string; consolidado?: { componentes: { nome: string }[] } }) => [i.nome, ...(i.consolidado?.componentes ?? []).map((c) => c.nome)]);
    const t = [...new Set(oficiais)].sort((x, y) => y.length - x.length).reduce((acc, nome) => acc.split(nome).join("NOME"), textoDe(painel));
    expect(t.match(/[—–]/g) ?? []).toEqual([]);
    expect(t).not.toMatch(/\s-\s/);
    expect(t.match(/\b\d{4}-\d{2}(-\d{2})?\b/g) ?? []).toEqual([]);
    expect(t).not.toMatch(/\bundefined\b|\bNaN\b|\bnull\b/);
    expect(t.match(/\b(NÃO|INDISPONÍVEL|APÓS)\b/g) ?? []).toEqual([]);
  });

  it("os destinos internos existem como rota do app e os externos são https", () => {
    const painel = [...nos(doc)].find((n) => attr(n, "data-painel") === ROTA)!;
    const hrefs = [...nos(painel)].filter((n) => n.tagName === "a").map((n) => attr(n, "href") ?? "");
    expect(hrefs.length).toBeGreaterThan(4);
    for (const h of hrefs) {
      if (h.startsWith("#")) continue;
      if (h.startsWith("/")) {
        const caminho = h.split(/[?#]/)[0];
        expect(existsSync(join(raiz, "src/app", caminho, "page.tsx")), h).toBe(true);
      } else expect(h, h).toMatch(/^https:\/\//);
    }
    expect(hrefs).toContain(gold.avaliacao.url);
    expect(hrefs).toContain(gold.url_dataset);
  });
});
