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

  // Auditoria de 10/11/2026, achados 1, 8, 12 e 13: invariantes das correções, não o texto delas.
  it("o gráfico do saldo leva no máximo quatro marcos, numerados e espaçados, e a lista abaixo dele diz o que é cada número", async () => {
    const figura = [...nos(doc)].find((n) => attr(n, "data-figura-analitica") === "saldo" || attr(n, "id") === "saldo")!;
    const noGrafico = [...nos(figura)].filter((n) => attr(n, "data-marco") !== undefined).map(textoDe);
    expect(noGrafico.length).toBeGreaterThanOrEqual(1);
    expect(noGrafico.length).toBeLessThanOrEqual(4);
    // no gráfico só o número de ordem: rótulo de texto é o que se sobrepunha a 1440 px e ficava ilegível a 390 px
    expect(noGrafico).toEqual(noGrafico.map((_, i) => String(i + 1)));
    const lista = [...nos(figura)].find((n) => attr(n, "data-marcos-do-grafico") !== undefined)!;
    const itens = [...nos(lista)].filter((n) => n.tagName === "li").map(textoDe);
    expect(itens.length).toBe(noGrafico.length);
    // cada marco da lista é um evento de margem da gold (ou uma norma do painel de regulação), com o mês
    const margem = gold.linha_do_tempo.filter((e: { tipo: string }) => e.tipo === "margem").map((e: { t: string }) => e.t);
    expect(itens.filter((i) => margem.some((t: string) => i.includes(t))).length).toBeGreaterThanOrEqual(1);
    for (const i of itens) expect(i).toMatch(/^\d\.\s+[a-z]{3}\/\d{4}: \S/);
    // a regra de escolha: nunca dois marcos a menos de um oitavo do período um do outro, e os que ficam de fora seguem no método
    const { marcosNoGrafico } = await import("@/lib/familias/consignado");
    const serie = gold.sgs.series.saldo as { d: string }[];
    const todos = gold.linha_do_tempo.map((e: { d: string; t: string }) => ({ x: e.d.slice(0, 7), rotulo: e.t }));
    const escolhidos = marcosNoGrafico(todos, serie[0].d, serie[serie.length - 1].d);
    const meses = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
    expect(escolhidos.length).toBeLessThanOrEqual(4);
    for (let i = 1; i < escolhidos.length; i++) expect(meses(escolhidos[i - 1].x, escolhidos[i].x)).toBeGreaterThanOrEqual(Math.ceil(meses(serie[0].d, serie[serie.length - 1].d) / 8));
    for (const e of gold.linha_do_tempo) expect(textoDe([...nos(doc)].find((n) => attr(n, "data-linha-do-tempo") !== undefined)!), e.t).toContain(e.t);
  });

  it("o período das reclamações diz quantos meses estão publicados e nomeia cada mês ausente da gold", () => {
    const R = gold.reclamacoes;
    const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    const esperados: string[] = [];
    for (let [a, m] = [Number(R.de.slice(0, 4)), Number(R.de.slice(5, 7))]; `${a}-${String(m).padStart(2, "0")}` <= R.ate; m === 12 ? ((a += 1), (m = 1)) : (m += 1)) esperados.push(`${a}-${String(m).padStart(2, "0")}`);
    const ausentes = esperados.filter((x) => !R.competencias.includes(x)).map((x) => `${MESES[Number(x.slice(5, 7)) - 1]}/${x.slice(0, 4)}`);
    const numero = [...nos(doc)].find((n) => attr(n, "data-numero-indicador") !== undefined && textoDe(n).includes(br(R.total)))!;
    const bloco = [...nos(doc)].find((n) => attr(n, "id") === "reclamacoes")!;
    for (const lugar of [textoDe(numero), textoDe(bloco)]) {
      if (ausentes.length) expect(lugar).toContain(`${R.competencias.length} dos ${esperados.length} meses`);
      for (const mes of ausentes) expect(lugar, mes).toContain(mes);
    }
    // o período na prova do número também não esconde o mês ausente
    for (const mes of ausentes) expect(attr(numero, "data-prova-numero")).toContain(mes);
  });

  it("os municípios acima de 50% aparecem com o universo de cada contagem: o total da gold e o do recorte do gráfico", () => {
    const base = mun.filter((m) => m.sel !== "baixa");
    const noGrafico = base.filter((m) => m.peso != null && (m.peso as number) >= 50).length;
    const total = gold.totais.dependencia_acima_50 as number;
    expect(noGrafico).not.toBe(total);
    const figura = [...nos(doc)].find((n) => attr(n, "id") === "previdencia")!;
    const leitura = textoDe([...nos(figura)].find((n) => textoDe(n).startsWith("Em ") && n.tagName === "p") ?? figura);
    const frase = textoDe(figura).split(/(?<=\.)\s+/).filter((f) => f.includes(br(total)) && f.includes(br(noGrafico)));
    expect(leitura.length).toBeGreaterThan(0);
    // os dois números na mesma frase, com o universo de cada um, na leitura guiada e na nota do número
    expect(frase.length).toBeGreaterThanOrEqual(1);
    expect(frase.join(" ")).toContain(`${br(base.length)} municípios sem confiabilidade baixa`);
    const numero = [...nos(figura)].find((n) => attr(n, "data-numero-indicador") !== undefined && attr(n, "aria-label") === "Municípios de alta dependência")!;
    expect(textoDe(numero)).toContain(br(noGrafico));
    expect(textoDe(numero)).toMatch(/confiabilidade baixa/);
  });

  it("toda tabela à vista leva o aviso de rolagem do kit (a âncora que mede a largura no navegador)", () => {
    const blocos = [...nos(doc)].filter((n) => attr(n, "data-bloco-tabela") !== undefined);
    expect(blocos.length).toBeGreaterThanOrEqual(8);
    for (const b of blocos) {
      expect([...nos(b)].some((n) => attr(n, "data-dica-rolagem-ancora") !== undefined), attr(b, "id")).toBe(true);
      expect([...nos(b)].some((n) => (attr(n, "class") ?? "").split(" ").includes("tabela-scroll")), attr(b, "id")).toBe(true);
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
