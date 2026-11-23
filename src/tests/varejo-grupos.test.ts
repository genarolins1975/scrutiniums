/**
 * Contratos das páginas de grupos, da ficha de grupo e do comparador da coleção Varejo (ranking do IRTT e fichas na curadoria;
 * demonstrações das companhias abertas na gold da CVM). Invariantes, sem texto literal: 20 grupos e 21 fichas com as chaves do
 * contrato, natureza e fonte em cada número do ranking, a busca por marca devolve o grupo, toda ficha com companhia resolve na
 * gold, a ponte de R$ 100 reconcilia com o lucro em toda empresa e exercício, o recorte volta da ficha para o ranking, a
 * ausência é estado dito (nunca zero), e as três páginas seguem o molde de painel sem `undefined`, `NaN` nem data crua.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ComparadorPage from "@/app/varejo/comparador/page";
import GruposPage from "@/app/varejo/grupos/page";
import FichaPage from "@/app/varejo/grupos/[slug]/page";
import SegmentosPage from "@/app/varejo/segmentos/page";
import { valorNaUnidade } from "@/components/varejo/FichaGrupo";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { paineis } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { SECTION_LABELS, VIEW_SECTIONS } from "@/lib/telemetry";
import * as cmp from "@/lib/varejo/comparador";
import { csvGrupos } from "@/lib/varejo/csv";
import * as dados from "@/lib/varejo/dados";
import { diaBr, mesDaData, num, por100, reais, reaisDeMilhoes, textoCurado } from "@/lib/varejo/formato";
import * as gr from "@/lib/varejo/grupos";
import { paginaVarejo } from "@/lib/varejo/paginas";
import type { CuradoriaVarejo, Demonstracao } from "@/lib/varejo/tipos";
import { conferirPainel } from "./suporte/molde-painel";

vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/varejo/grupos",
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

// a curadoria pode faltar: o teste liga a ausência dela sem tocar nos arquivos
const semCuradoria = vi.hoisted(() => ({ ligado: false }));
vi.mock("@/lib/varejo/dados", async () => {
  const real = await vi.importActual<typeof import("@/lib/varejo/dados")>("@/lib/varejo/dados");
  const vazia: CuradoriaVarejo = { gerado_em: null, ranking: null, segmentos: null, fichas: {}, recusados: [] };
  return { ...real, curadoria: () => (semCuradoria.ligado ? vazia : real.curadoria()) };
});

vi.setConfig({ testTimeout: 60_000 });

const raiz = process.cwd();
const c = dados.curadoria();
const e = dados.goldEmpresas();
const anos = gr.exerciciosDaGold(e);
const texto = (html: string) => html.replace(/<(script|style|template)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");
const render = (no: unknown) => renderToStaticMarkup(no as ReturnType<typeof createElement>);
const rotasDoApp: string[] = JSON.parse(readFileSync(join(raiz, "src/lib/uso/rotas-do-app.json"), "utf-8"));

function existe(href: string): boolean {
  const caminho = href.split(/[?#]/)[0] || "/";
  if (existsSync(join(raiz, "src/app", caminho, "route.ts")) || existsSync(join(raiz, "src/app", caminho, "page.tsx"))) return true;
  if (paineis().some((p) => p.rota.split(/[?#]/)[0] === caminho)) return true;
  return rotasDoApp.some((p) => p === caminho || new RegExp(`^${p.replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(?:/.+)?").replace(/\/\[[^\]]+\]/g, "/[^/]+")}$`).test(caminho));
}

const hrefs = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
const internos = (html: string) => hrefs(html).filter((h) => h.startsWith("/"));

/** Link interno existe; link de ficha aponta para uma ficha que a curadoria tem (o padrão dinâmico sozinho aceitaria qualquer slug). */
function linksValidos(rota: string, html: string) {
  for (const h of internos(html)) {
    expect(existe(h), `${rota}: ${h}`).toBe(true);
    const m = /^\/varejo\/grupos\/([^/?#]+)/.exec(h);
    if (m) expect(Object.keys(c.fichas), `${rota}: ficha ${m[1]}`).toContain(decodeURIComponent(m[1]));
    const q = /^\/varejo\/comparador\?(.*?)(#|$)/.exec(h);
    if (q) for (const s of (new URLSearchParams(q[1]).get("e") ?? "").split(",").filter(Boolean)) expect(Object.keys(e.empresas), `${rota}: companhia ${s}`).toContain(s);
  }
  for (const h of hrefs(html).filter((x) => /^[a-z]+:/i.test(x))) expect(h, `${rota}: link externo`).toMatch(/^https?:\/\/[^\s"]+$/);
}

function semLixo(rota: string, html: string) {
  const t = texto(html);
  expect(t, `${rota}: undefined, NaN ou objeto no texto`).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bInfinity\b|\bnull\b/);
  expect(t.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [], `${rota}: data ISO no texto`).toEqual([]);
  expect(t, `${rota}: hora em UTC`).not.toMatch(/\bUTC\b|T\d{2}:\d{2}:\d{2}Z/);
  expect(t, `${rota}: travessão no texto`).not.toContain("—");
}

const blocos = (html: string, atributo: string) => [...html.matchAll(new RegExp(`${atributo}="([^"]*)"`, "g"))].map((m) => m[1]);

describe("catálogo, navegação e acesso", () => {
  it("grupos, ficha e comparador estão publicados, com seção de telemetria; a navegação traz grupos e comparador e nunca o padrão dinâmico", () => {
    for (const id of ["grupos", "grupo", "comparador"] as const) {
      const p = paginaVarejo(id);
      expect(p.publicada, id).toBe(true);
      expect(VIEW_SECTIONS, p.secao).toContain(p.secao);
      expect((SECTION_LABELS as Record<string, string>)[p.secao], p.secao).toBeTruthy();
      expect(existsSync(join(raiz, "src/app", ...p.href.split("/").filter(Boolean), "page.tsx")), p.href).toBe(true);
    }
    const nav = navegacaoDaColecao("varejo").itens.map((i) => i.href);
    expect(nav).toContain(gr.ROTA_GRUPOS);
    expect(nav).toContain(gr.ROTA_COMPARADOR);
    expect(nav.some((h) => h.includes("["))).toBe(false);
    expect(paineis().some((p) => p.rota.includes("[slug]"))).toBe(false);
    expect(rotasDoApp).toContain("/varejo/grupos/[slug]");
  });

  it("os painéis, as fichas, o CSV do ranking e a curadoria exigem conta", () => {
    for (const r of [gr.ROTA_GRUPOS, gr.ROTA_COMPARADOR, gr.ROTA_GRUPOS_CSV, ...gr.slugsDasFichas(c).map((s) => gr.hrefFicha(s)), "/varejo/gold/curadoria.json"]) expect(ehRotaPublica(r), r).toBe(false);
    expect(existsSync(join(raiz, "src/app", gr.ROTA_GRUPOS_CSV, "route.ts"))).toBe(true);
  });
});

describe("curadoria: ranking e fichas", () => {
  const grupos = c.ranking?.grupos ?? [];

  it("o ranking tem 20 grupos, nas posições de 1 a 20, cada um com venda, natureza, exercício e página da fonte", () => {
    expect(grupos).toHaveLength(20);
    expect(grupos.map((g) => g.posicao).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(new Set(grupos.map((g) => g.slug)).size).toBe(20);
    expect(c.ranking?.fonte.exercicio).toBeGreaterThan(2000);
    expect(gr.urlSegura(c.ranking?.fonte.url)).not.toBeNull();
    expect(c.ranking?.fonte.consultado_em).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect((c.ranking?.fonte.conceito_venda ?? "").length).toBeGreaterThan(40);
    for (const g of grupos) {
      expect(typeof g.vendas_milhoes, g.slug).toBe("number");
      expect(["divulgado", "estimado_pela_fonte"], g.slug).toContain(gr.naturezaCurada(g.natureza));
      expect(g.pagina, `${g.slug}: página da fonte`).toBeTruthy();
      expect((g.bandeiras ?? []).length, `${g.slug}: bandeiras`).toBeGreaterThan(0);
      expect(g.segmento, g.slug).toBeTruthy();
    }
    // a ordem publicada é a das vendas: a página não reordena o que a fonte publicou
    const porPosicao = gr.linhasDoRanking(c);
    for (let i = 1; i < porPosicao.length; i++) expect(porPosicao[i - 1].vendas_milhoes as number, `posição ${i}`).toBeGreaterThanOrEqual(porPosicao[i].vendas_milhoes as number);
  });

  it("há 21 fichas (os 20 do ranking e um operador digital fora dele), todas com as chaves do contrato", () => {
    const slugs = gr.slugsDasFichas(c);
    expect(slugs).toHaveLength(21);
    for (const g of grupos) expect(slugs, g.slug).toContain(g.slug);
    expect(slugs.filter((s) => !grupos.some((g) => g.slug === s))).toHaveLength(1);
    const chaves = ["slug", "grupo", "resumo", "controlador", "capital", "bandeiras", "formatos", "regioes", "canais", "clientes", "fontes_de_receita", "concorrentes", "operacionais", "eventos", "alcance_do_dado", "analise", "campos_sem_divulgacao", "fontes"];
    for (const s of slugs) {
      const bruta = c.fichas[s] as Record<string, unknown>;
      for (const k of chaves) expect(bruta, `${s}: ${k}`).toHaveProperty(k);
      const f = gr.fichaDoGrupo(c, s)!;
      expect(f.slug).toBe(s);
      expect((f.resumo ?? "").length, `${s}: resumo`).toBeGreaterThan(20);
      expect((f.resumo ?? "").length, `${s}: resumo cabe no lead do molde`).toBeLessThanOrEqual(220);
      expect(f.grupo.length, `${s}: nome cabe no H1`).toBeLessThanOrEqual(60);
      expect(f.fontes.length, `${s}: fontes`).toBeGreaterThan(0);
      for (const fonte of f.fontes) expect(gr.urlSegura(fonte.url), `${s}: fonte sem endereço`).not.toBeNull();
      expect((f.analise?.crescimento ?? "").length, `${s}: análise de crescimento`).toBeGreaterThan(80);
      expect((f.analise?.rentabilidade_caixa ?? "").length, `${s}: análise de rentabilidade e caixa`).toBeGreaterThan(80);
      expect(f.analise?.acompanhar?.indicador, `${s}: indicador a acompanhar`).toBeTruthy();
      expect((f.alcance_do_dado ?? "").length, `${s}: alcance do dado`).toBeGreaterThan(40);
      // todo número operacional tem período e natureza; valor ausente é null, com o campo listado como não divulgado
      for (const o of f.operacionais) {
        expect(gr.tituloDaFonte(o.fonte), `${s}: fonte de ${o.indicador}`).toBeTruthy();
        for (const v of o.valores ?? []) {
          expect(v.periodo, `${s}: período em ${o.indicador}`).toBeTruthy();
          expect(["divulgado", "estimado_pela_fonte", "calculado"], `${s}: natureza em ${o.indicador}`).toContain(gr.naturezaCurada(v.natureza));
        }
      }
      for (const ev of f.eventos) {
        expect(ev.data, `${s}: data do evento`).toMatch(/^\d{4}-\d{2}/);
        expect(gr.tituloDaFonte(ev.fonte), `${s}: fonte do evento`).toBeTruthy();
      }
    }
    expect(gr.fichaDoGrupo(c, "nao-existe")).toBeNull();
    expect(gr.fichaDoGrupo(c, "constructor")).toBeNull();
  });

  it("toda ficha e todo grupo do ranking com companhia aberta resolvem na gold da CVM, e os dois concordam", () => {
    let comGold = 0;
    for (const s of gr.slugsDasFichas(c)) {
      const f = gr.fichaDoGrupo(c, s)!;
      const noRanking = grupos.find((g) => g.slug === s);
      if (noRanking) expect(f.empresa_gold ?? null, `${s}: ficha e ranking`).toBe(noRanking.empresa_gold ?? null);
      if (!f.empresa_gold) {
        expect(gr.empresaDaFicha(e, f), s).toBeNull();
        continue;
      }
      comGold++;
      const emp = gr.empresaDaFicha(e, f);
      expect(emp, `${s}: ${f.empresa_gold} fora da gold`).not.toBeNull();
      expect(emp!.anuais.length, s).toBeGreaterThan(0);
      for (const a of emp!.anuais) expect(gr.urlSegura(a.documento?.link), `${s} ${a.exercicio}: documento na CVM`).not.toBeNull();
    }
    expect(comGold).toBeGreaterThan(0);
    // concorrente com slug aponta para ficha ou para companhia da gold (senão o link da ficha levaria a lugar nenhum)
    for (const s of gr.slugsDasFichas(c)) for (const x of gr.fichaDoGrupo(c, s)!.concorrentes) if (x.slug) expect(Boolean(c.fichas[x.slug] || e.empresas[x.slug]), `${s}: concorrente ${x.slug}`).toBe(true);
  });

  it("participação na amostra: o denominador é a soma dos grupos listados, fecha em 100% e separa o que é estimativa da fonte", () => {
    const a = gr.amostraDoRanking(c);
    const linhas = gr.linhasDoRanking(c);
    expect(a.n).toBe(grupos.length);
    expect(a.total_milhoes).toBe(grupos.reduce((s, g) => s + (g.vendas_milhoes ?? 0), 0));
    expect(a.estimados).toBe(grupos.filter((g) => g.natureza === "estimado_pela_fonte").length);
    expect(a.divulgados + a.estimados + a.sem_valor).toBe(a.n);
    expect(a.estimado_milhoes).toBe(grupos.filter((g) => g.natureza === "estimado_pela_fonte").reduce((s, g) => s + (g.vendas_milhoes ?? 0), 0));
    expect(linhas.reduce((s, l) => s + (l.participacao_na_amostra ?? 0), 0)).toBeCloseTo(100, 6);
    // sem valor, a participação é ausência, não zero
    const semValor = structuredClone(c);
    semValor.ranking!.grupos[0].vendas_milhoes = null;
    expect(gr.linhasDoRanking(semValor).find((l) => l.posicao === semValor.ranking!.grupos[0].posicao)!.participacao_na_amostra).toBeNull();
    expect(gr.amostraDoRanking(semValor).sem_valor).toBe(1);
  });

  it("ordenar não altera a posição publicada, e valor ausente vai para o fim", () => {
    const linhas = gr.linhasDoRanking(c);
    for (const o of gr.ORDENS) {
      const ordenadas = gr.ordenarRanking(linhas, o);
      expect(ordenadas).toHaveLength(linhas.length);
      expect(new Set(ordenadas.map((l) => `${l.slug}:${l.posicao}`))).toEqual(new Set(linhas.map((l) => `${l.slug}:${l.posicao}`)));
    }
    const semLojas = linhas.map((l, i) => (i === 0 ? { ...l, lojas: null } : l));
    const porLojas = gr.ordenarRanking(semLojas, "lojas");
    expect(porLojas.findIndex((l) => l.slug === linhas[0].slug)).toBeGreaterThanOrEqual(semLojas.filter((l) => typeof l.lojas === "number").length);
    expect(porLojas.slice(0, semLojas.filter((l) => typeof l.lojas === "number").length).every((l) => typeof l.lojas === "number")).toBe(true);
  });
});

describe("busca por marca ou grupo", () => {
  it("toda bandeira do ranking e da ficha devolve o grupo que a opera, com e sem acento e em qualquer caixa", () => {
    for (const s of gr.slugsDasFichas(c)) {
      for (const b of gr.bandeirasDoGrupo(c, s)) {
        for (const forma of [b, b.toUpperCase(), b.normalize("NFD").replace(/[̀-ͯ]/g, "")]) {
          const r = gr.buscarGrupos(c, e, forma);
          expect(r, forma).not.toBeNull();
          expect(r!.grupos.map((x) => x.slug), `${forma} → ${s}`).toContain(s);
        }
      }
    }
  });

  it("o achado traz a posição no ranking e o controlador da ficha (ou a ausência dele); marca dividida devolve mais de um grupo", () => {
    const primeiro = c.ranking!.grupos.find((g) => g.posicao === 1)!;
    const r = gr.buscarGrupos(c, e, primeiro.bandeiras![1] ?? primeiro.bandeiras![0])!;
    const achado = r.grupos.find((x) => x.slug === primeiro.slug)!;
    expect(achado.posicao).toBe(1);
    expect(achado.bandeiras.length).toBeGreaterThan(0);
    expect(achado.controlador).toBe(c.fichas[primeiro.slug].controlador?.nome?.trim() || null);
    // uma palavra que aparece em bandeiras de dois grupos devolve os dois
    const contagem = new Map<string, Set<string>>();
    for (const s of gr.slugsDasFichas(c)) for (const b of gr.bandeirasDoGrupo(c, s)) for (const palavra of b.toLowerCase().split(/[^a-zà-ú]+/).filter((p) => p.length >= 5)) contagem.set(palavra, (contagem.get(palavra) ?? new Set()).add(s));
    const dividida = [...contagem.entries()].find(([, donos]) => donos.size >= 2);
    if (dividida) expect(gr.buscarGrupos(c, e, dividida[0])!.grupos.length).toBeGreaterThanOrEqual(2);
    // grupo com ficha e fora do ranking aparece sem posição
    const fora = gr.slugsDasFichas(c).find((s) => !c.ranking!.grupos.some((g) => g.slug === s))!;
    expect(gr.buscarGrupos(c, e, c.fichas[fora].grupo)!.grupos.find((x) => x.slug === fora)!.posicao).toBeNull();
  });

  it("termo vazio ou curto não busca; termo sem correspondência devolve listas vazias; companhia aberta sem ficha vem à parte", () => {
    expect(gr.buscarGrupos(c, e, null)).toBeNull();
    expect(gr.buscarGrupos(c, e, " a ")).toBeNull();
    const nada = gr.buscarGrupos(c, e, "zzzxqy")!;
    expect([nada.grupos, nada.companhias]).toEqual([[], []]);
    const comFicha = new Set(Object.values(c.fichas).map((f) => f.empresa_gold).filter(Boolean));
    const semFicha = Object.entries(e.empresas).filter(([s]) => !comFicha.has(s));
    expect(semFicha.length).toBeGreaterThan(0);
    for (const [slug, emp] of semFicha) expect(gr.buscarGrupos(c, e, emp.nome)!.companhias.map((x) => x.slug), emp.nome).toContain(slug);
    for (const [slug, emp] of Object.entries(e.empresas).filter(([s]) => comFicha.has(s))) expect(gr.buscarGrupos(c, e, emp.nome)?.companhias.map((x) => x.slug) ?? [], emp.nome).not.toContain(slug);
  });

  it("o recorte do ranking viaja no ?de= e volta inteiro; parâmetro estranho não passa", () => {
    const de = gr.recorteParaLevar({ q: "atacadão", segmento: "alimentar", ordem: "lojas" });
    const volta = gr.voltaAoRanking(de);
    const q = new URLSearchParams(volta.split("?")[1].split("#")[0]);
    expect([q.get("q"), q.get("segmento"), q.get("ordem")]).toEqual(["atacadão", "alimentar", "lojas"]);
    expect(volta.startsWith(`${gr.ROTA_GRUPOS}?`)).toBe(true);
    expect(gr.voltaAoRanking(null)).toBe(`${gr.ROTA_GRUPOS}#ranking`);
    expect(gr.voltaAoRanking("ordem=xyz&segmento=<b>&outro=1&q=")).toBe(`${gr.ROTA_GRUPOS}#ranking`);
    expect(gr.hrefFicha("assai", de)).toContain(`de=${encodeURIComponent(de)}`.replace(/%20/g, "+").slice(0, 6));
    expect(new URLSearchParams(gr.hrefFicha("assai", de).split("?")[1]).get("de")).toBe(de);
  });
});

describe("gold das companhias: ponte de R$ 100 e caixa", () => {
  const periodos: { rotulo: string; d: Demonstracao }[] = Object.entries(e.empresas).flatMap(([slug, emp]) => [
    ...emp.anuais.map((a) => ({ rotulo: `${slug} ${a.exercicio}`, d: a as Demonstracao })),
    ...(emp.ultimo_trimestre?.atual ? [{ rotulo: `${slug} trimestre`, d: emp.ultimo_trimestre.atual }] : []),
    ...(emp.ultimo_trimestre?.mesmo_periodo_ano_anterior ? [{ rotulo: `${slug} trimestre anterior`, d: emp.ultimo_trimestre.mesmo_periodo_ano_anterior }] : []),
  ]);

  it("a ponte reconcilia com o lucro em todas as empresas, exercícios e trimestres: R$ 100 mais as parcelas dá o lucro por R$ 100, que é o lucro divulgado sobre a receita", () => {
    expect(periodos.length).toBeGreaterThan(Object.keys(e.empresas).length * 3);
    for (const { rotulo, d } of periodos) {
      const r = cmp.reconciliacao(d);
      expect(r, `${rotulo}: sem ponte`).not.toBeNull();
      expect(Math.abs(r!.soma - r!.lucroPor100), `${rotulo}: soma das parcelas`).toBeLessThanOrEqual(cmp.TOLERANCIA_PONTE);
      expect(Math.abs((r!.lucroDivulgadoPor100 as number) - r!.lucroPor100), `${rotulo}: lucro divulgado`).toBeLessThanOrEqual(cmp.TOLERANCIA_PONTE);
      expect(r!.fecha, rotulo).toBe(true);
      // as parcelas mostradas são as da gold, com o mesmo sinal, e são seis
      const partes = cmp.partesDaPonte(d.ponte_100!);
      expect(partes.map((p) => p.id)).toEqual(["custo", "despesas", "financeiro", "impostos", "outros", "lucro"]);
      expect(100 + partes.filter((p) => p.id !== "lucro").reduce((s, p) => s + p.valor, 0)).toBeCloseTo(r!.soma, 8);
    }
    expect(cmp.TOLERANCIA_PONTE).toBe(0.05);
  });

  it("uma ponte que não fecha é dita como tal, e sem ponte não há conta", () => {
    const a = structuredClone(e.empresas.assai.anuais.at(-1)!);
    a.ponte_100!.custo += 1;
    expect(cmp.reconciliacao(a)!.fecha).toBe(false);
    expect(cmp.reconciliacao({ ponte_100: null, lucro_liquido: 1, receita_liquida: 1 })).toBeNull();
  });

  it("o caixa depois do convênio é o declarado mais os pagamentos de convênio, e só existe quando a companhia apresenta a linha", () => {
    let comConvenio = 0;
    for (const { rotulo, d } of periodos) {
      const cx = cmp.caixaDe(d);
      if (cx.convenio === null) {
        expect(cx.aposConvenio, `${rotulo}: ajuste sem convênio`).toBeNull();
        continue;
      }
      comConvenio++;
      expect(cx.aposConvenio, rotulo).toBeCloseTo((cx.operacional as number) + cx.convenio, 0);
    }
    expect(comConvenio).toBeGreaterThan(0);
    expect(cmp.caixaDe(null)).toEqual({ operacional: null, estoques: null, fornecedores: null, recebiveis: null, investimentos: null, convenio: null, aposConvenio: null });
  });

  it("seleção e exercício da URL: só slugs da gold, sem repetir, de duas a quatro; exercício fora da base vale o último", () => {
    const todos = Object.keys(e.empresas);
    expect(cmp.selecaoDaUrl(e, `${todos[0]},nao-existe,${todos[0]},${todos[1]}`)).toEqual([todos[0], todos[1]]);
    expect(cmp.selecaoDaUrl(e, [todos[2], todos[3]])).toEqual([todos[2], todos[3]]);
    expect(cmp.selecaoDaUrl(e, todos.join(","))).toHaveLength(cmp.MAX_EMPRESAS);
    expect(cmp.selecaoDaUrl(e, undefined)).toEqual([]);
    expect(cmp.selecaoDaUrl(e, "constructor,__proto__")).toEqual([]);
    expect(cmp.anoDaUrl(e, "1999")).toBe(anos.at(-1));
    expect(cmp.anoDaUrl(e, null)).toBe(anos.at(-1));
    expect(cmp.anoDaUrl(e, String(anos[0]))).toBe(anos[0]);
    for (const p of cmp.PARES) {
      for (const s of p.slugs) expect(todos, s).toContain(s);
      expect(cmp.parDaSelecao([...p.slugs].reverse())?.id).toBe(p.id);
    }
    expect(cmp.parDaSelecao([todos[0]])).toBeNull();
    expect(cmp.hrefComparador(e, cmp.PAR_PADRAO, anos.at(-1)!)).toBe(gr.ROTA_COMPARADOR);
  });

  it("toda companhia tem substituta do mesmo segmento ou está sozinha nele, e os pares preparados têm substitutas", () => {
    const todas = cmp.empresasComparaveis(e, c);
    expect(todas).toHaveLength(Object.keys(e.empresas).length);
    for (const p of cmp.PARES) for (const s of p.slugs) expect(cmp.substitutos(todas, s).length, s).toBeGreaterThan(0);
    for (const x of todas) for (const sub of cmp.substitutos(todas, x.slug)) expect(sub.segmentos.some((s) => x.segmentos.includes(s)), `${x.slug} × ${sub.slug}`).toBe(true);
  });

  it("persistência: a diferença do exercício é A menos B, e só 'repete' quando o sinal é o mesmo em todos os exercícios comparáveis", () => {
    const [a, b] = cmp.PAR_PADRAO.map((s) => e.empresas[s]);
    const ano = anos.at(-1)!;
    for (const p of cmp.persistencias(e, a, b, ano)) {
      if (p.a !== null && p.b !== null) expect(p.diferenca).toBeCloseTo(p.a - p.b, 8);
      expect(p.comparaveis).toBeLessThanOrEqual(anos.length);
      expect(p.aAcima).toBeLessThanOrEqual(p.comparaveis);
      if (p.repete) expect(p.aAcima === p.comparaveis || p.aAcima === 0).toBe(true);
      if (p.menor !== null && p.maior !== null) expect(p.menor).toBeLessThanOrEqual(p.maior);
    }
  });

  it("os avisos saem do dado: exercício ausente, base individual ao lado de consolidada, reapresentação e resultado financeiro positivo", () => {
    const ano = anos.at(-1)!;
    const semAno = Object.entries(e.empresas).find(([, emp]) => !gr.periodoDe(emp, ano));
    const comAno = Object.entries(e.empresas).find(([, emp]) => gr.periodoDe(emp, ano))!;
    if (semAno) expect(cmp.avisosDaSelecao([{ slug: semAno[0], emp: semAno[1] }, { slug: comAno[0], emp: comAno[1] }], ano).map((a) => a.id)).toContain("ausente");
    const individual = Object.entries(e.empresas).find(([, emp]) => gr.periodoDe(emp, ano)?.base === "individual");
    const consolidada = Object.entries(e.empresas).find(([, emp]) => gr.periodoDe(emp, ano)?.base === "consolidado");
    if (individual && consolidada) expect(cmp.avisosDaSelecao([{ slug: individual[0], emp: individual[1] }, { slug: consolidada[0], emp: consolidada[1] }], ano).map((a) => a.id)).toContain("base");
    for (const [slug, emp] of Object.entries(e.empresas)) {
      for (const p of emp.anuais) {
        const ids = cmp.avisosDaSelecao([{ slug, emp }, { slug: comAno[0], emp: comAno[1] }], p.exercicio).map((a) => a.id);
        expect(ids.includes(`financeiro-${slug}`), `${slug} ${p.exercicio}: resultado financeiro positivo`).toBe((p.ponte_100?.resultado_financeiro ?? 0) > 0);
        const r = p.reapresentado_no_exercicio_seguinte;
        expect(ids.includes(`reapresentado-${slug}`), `${slug} ${p.exercicio}: reapresentação`).toBe(Boolean(r && (r.receita_liquida !== p.receita_liquida || r.lucro_liquido !== p.lucro_liquido)));
      }
    }
    for (const a of cmp.avisosDaSelecao(Object.entries(e.empresas).slice(0, 4).map(([slug, emp]) => ({ slug, emp })), ano)) expect(a.texto).not.toMatch(/undefined|NaN|\d{4}-\d{2}-\d{2}/);
  });
});

describe("formatação", () => {
  it("reais na ordem de grandeza certa, parcela de R$ 100 com duas casas, datas brasileiras e texto da curadoria sem data crua", () => {
    expect(reais(84_736_000_000)).toBe(`R$ ${num(84.7, 1)} bilhões`);
    expect(reais(1_190_000_000)).toMatch(/bilhão$/);
    expect(reais(497_000_000)).toBe("R$ 497 milhões");
    expect(reais(-2_100_000_000).startsWith("−R$")).toBe(true);
    expect(reais(null)).toBe("sem dado");
    expect(reaisDeMilhoes(123594)).toBe(reais(123_594_000_000));
    expect(por100(-0.85)).toBe("−R$ 0,85");
    expect(por100(70.15)).toBe("R$ 70,15");
    expect(diaBr("2026-11-23")).toBe("23/11/2026");
    expect(mesDaData("2026-09-30")).toBe("set/2026");
    expect(mesDaData("2026-08")).toBe("ago/2026");
    expect(textoCurado("entregue à CVM em 2026-02-11 e revisto em 2025-05")).not.toMatch(/\d{4}-\d{2}/);
    expect(textoCurado("de 2021 a 2025")).toBe("de 2021 a 2025");
    expect(textoCurado(null)).toBe("");
    expect(gr.urlSegura("http://www.rad.cvm.gov.br/x?a=1")).toBe("https://www.rad.cvm.gov.br/x?a=1");
    expect(gr.urlSegura("javascript:alert(1)")).toBeNull();
    expect(valorNaUnidade(1, "lojas")).toBe("1 loja");
    expect(valorNaUnidade(8.2, "%")).toBe("8,2%");
    expect(valorNaUnidade(1042, "lojas")).toBe("1.042 lojas");
    expect(valorNaUnidade(29496, "R$ milhões")).toBe("R$ 29.496 milhões");
    expect(valorNaUnidade(65037, "US$ milhões")).toBe("US$ 65.037 milhões");
  });
});

describe("páginas no HTML do servidor", () => {
  const anoRanking = gr.exercicioDoRanking(c);
  const recortesGrupos: Record<string, string>[] = [{}, { q: "Atacadão" }, { q: "drogasil", segmento: "farmacia-beleza", ordem: "lojas" }, { q: "zzzxqy" }, { segmento: "<b>", ordem: "x", q: " " }, { ordem: "crescimento" }, { q: "riachuelo" }];

  it.each(recortesGrupos.map((r) => [new URLSearchParams(r).toString() || "(padrão)", r] as const))("/varejo/grupos?%s segue o molde, marca a natureza de cada venda e leva o recorte às fichas", (_n, r) => {
    const html = render(GruposPage({ searchParams: r }));
    conferirPainel(gr.ROTA_GRUPOS, html);
    semLixo(gr.ROTA_GRUPOS, html);
    linksValidos(gr.ROTA_GRUPOS, html);
    const segmento = gr.segmentosDoRanking(c).includes(r.segmento ?? "") ? r.segmento : null;
    const visiveis = gr.linhasDoRanking(c).filter((l) => !segmento || l.segmento === segmento);
    const figura = html.slice(html.indexOf('data-figura-analitica="ranking"'), html.indexOf('id="lideres"'));
    // uma marca de natureza, por extenso, para cada grupo visível, e a página da fonte em cada linha
    const naturezas = blocos(figura.slice(figura.indexOf("<table")), "data-natureza-dado");
    expect(naturezas).toHaveLength(visiveis.length);
    expect(naturezas.filter((n) => n === "estimado_pela_fonte")).toHaveLength(visiveis.filter((l) => l.natureza_dado === "estimado_pela_fonte").length);
    for (const l of visiveis) {
      expect(texto(figura), l.slug).toContain(l.grupo);
      expect(texto(figura), `${l.slug}: página da fonte`).toContain(`IRTT, p. ${l.pagina}`);
      expect(figura, `${l.slug}: link da ficha`).toContain(`href="${gr.ROTA_GRUPOS}/${l.slug}`);
    }
    expect(texto(figura)).toContain(gr.ROTULO_NATUREZA.estimado_pela_fonte);
    expect(texto(html)).toContain(anoRanking);
    // a definição de venda da fonte fica à vista junto da tabela, não só no método
    expect(texto(figura)).toContain(textoCurado(c.ranking!.fonte.conceito_venda).slice(0, 60));
    // o rótulo é "participação na amostra": a página nunca atribui participação de mercado a um grupo
    expect(texto(figura)).toMatch(/Participação na amostra/);
    expect(texto(html)).not.toMatch(/participação de mercado (de|do|da) [\dA-Z]/);
    // a soma dos grupos e o que nela é estimativa aparecem juntos
    const a = gr.amostraDoRanking(c);
    expect(texto(html)).toContain(reaisDeMilhoes(a.total_milhoes));
    expect(texto(html)).toContain(reaisDeMilhoes(a.estimado_milhoes));
    // o recorte acompanha os links das fichas
    const de = gr.recorteParaLevar({ q: (r.q ?? "").trim() || null, segmento, ordem: (gr.ORDENS as readonly string[]).includes(r.ordem ?? "") ? r.ordem : null });
    if (de) for (const h of internos(figura).filter((x) => x.startsWith(`${gr.ROTA_GRUPOS}/`))) expect(new URLSearchParams(h.split("?")[1] ?? "").get("de"), h).toBe(de);
    for (const id of ["lideres", "digitais", "conferencias"]) expect(html, id).toContain(`id="${id}"`);
    expect(html).toContain("data-quadro-conceitos");
    expect(html).toContain(`href="${gr.ROTA_GRUPOS_CSV}"`);
    // busca: resultado, estado vazio e grupos destacados
    const busca = gr.buscarGrupos(c, e, (r.q ?? "").trim() || null);
    expect(html.includes("data-resultado-busca")).toBe(Boolean(busca));
    if (busca) {
      expect(blocos(html, "data-achado")).toEqual(busca.grupos.map((x) => x.slug));
      expect(blocos(html, "data-achado-companhia")).toEqual(busca.companhias.map((x) => x.slug));
      expect(html.includes("data-busca-vazia")).toBe(busca.grupos.length + busca.companhias.length === 0);
    }
  });

  it("/varejo/grupos: os marketplaces fora do ranking levam a natureza de cada valor e a ficha do operador digital; as conferências trazem o documento", () => {
    const html = render(GruposPage({ searchParams: {} }));
    const digitais = html.slice(html.indexOf('id="digitais"'), html.indexOf('id="conferencias"'));
    const lista = c.ranking!.marketplaces!.lista!;
    expect(blocos(digitais.slice(digitais.indexOf("<table")), "data-natureza-dado").slice(0, lista.length)).toEqual(lista.map((m) => gr.naturezaCurada(m.natureza)));
    for (const m of lista) expect(texto(digitais), m.nome).toContain(m.nome);
    const fora = gr.slugsDasFichas(c).find((s) => !c.ranking!.grupos.some((g) => g.slug === s))!;
    expect(digitais).toContain(`href="${gr.ROTA_GRUPOS}/${fora}"`);
    const conferencias = html.slice(html.indexOf('id="conferencias"'));
    for (const x of c.ranking!.conferencias!) {
      expect(conferencias, x.fonte).toContain(`data-conferencia="${x.fonte}"`);
      expect(conferencias, x.fonte).toContain(`href="${x.url!.replace(/&/g, "&amp;")}"`);
      for (const d of x.divergencias ?? []) expect(texto(conferencias), d.grupo).toContain(textoCurado(d.motivo).slice(0, 50));
    }
  });

  it("/varejo/grupos sem a curadoria: a página segue de pé, diz que o ranking está em apuração e não mostra número", () => {
    semCuradoria.ligado = true;
    try {
      const html = render(GruposPage({ searchParams: { q: "atacadão" } }));
      conferirPainel(gr.ROTA_GRUPOS, html);
      semLixo(gr.ROTA_GRUPOS, html);
      expect(html).toContain("data-em-apuracao");
      expect(html).not.toContain("data-numero-indicador");
      expect(() => FichaPage({ params: { slug: "assai" }, searchParams: {} })).toThrow();
    } finally {
      semCuradoria.ligado = false;
    }
  });

  it.each(gr.slugsDasFichas(c))("ficha /varejo/grupos/%s segue o molde, com identidade, alcance, análise, operação, eventos, lacunas e fontes", (slug) => {
    const f = gr.fichaDoGrupo(c, slug)!;
    const rota = `${gr.ROTA_GRUPOS}/${slug}`;
    const de = gr.recorteParaLevar({ q: "extra", segmento: "alimentar" });
    const html = render(FichaPage({ params: { slug }, searchParams: { de } }));
    conferirPainel(rota, html);
    semLixo(rota, html);
    linksValidos(rota, html);
    const t = texto(html);
    // o link de volta preserva o recorte do ranking
    expect(html).toContain(`href="${gr.voltaAoRanking(de).replace(/&/g, "&amp;")}"`);
    for (const id of ["quem", "alcance", "leitura", "demonstracoes", "operacionais", "eventos", "sem-divulgacao", "fontes"]) expect(html, id).toMatch(new RegExp(`\\bid="${id}"`));
    for (const b of f.bandeiras) expect(t, b.nome).toContain(b.nome);
    expect(html).toContain("data-alcance-do-dado");
    expect(html).toContain("data-ranking-contra-cvm");
    expect(html).toContain("data-indicador-a-acompanhar");
    expect(t).toContain(textoCurado(f.analise!.acompanhar!.reforca).slice(0, 40));
    expect(t).toContain(textoCurado(f.analise!.acompanhar!.enfraquece).slice(0, 40));
    // cada série operacional com a sua fonte; cada evento com data e fonte; cada lacuna como estado escrito
    expect((html.match(/data-serie-operacional/g) ?? []).length).toBe(f.operacionais.length);
    const operacionais = html.slice(html.indexOf('id="operacionais"'), html.indexOf('id="eventos"'));
    expect((operacionais.match(/data-fonte-documento/g) ?? []).length).toBe(f.operacionais.length);
    expect(blocos(html, "data-evento")).toHaveLength(f.eventos.length);
    expect(html.includes("data-sem-eventos")).toBe(f.eventos.length === 0);
    expect(blocos(html, "data-campos-sem-divulgacao")).toEqual(f.campos_sem_divulgacao.length ? [String(f.campos_sem_divulgacao.length)] : []);
    expect(blocos(html, "data-fontes-da-ficha")).toEqual([String(f.fontes.length)]);
    for (const fonte of f.fontes) expect(html, fonte.url).toContain(`href="${gr.urlSegura(fonte.url)!.replace(/&/g, "&amp;")}"`);
    // companhia aberta: gráficos, tabela, documento original de cada exercício e as reapresentações; fechada: campos financeiros como não divulgados
    const emp = gr.empresaDaFicha(e, f);
    expect(html.includes('data-figura-analitica="demonstracoes"')).toBe(Boolean(emp));
    expect(html.includes("data-financeiro-nao-divulgado")).toBe(!emp);
    if (emp) {
      expect(blocos(html, "data-indicador")).toEqual([...gr.INDICADORES_FICHA.map((i) => i.id), "divida"]);
      for (const a of emp.anuais) expect(html, `${slug} ${a.exercicio}`).toContain(`href="${gr.urlSegura(a.documento!.link)!.replace(/&/g, "&amp;")}"`);
      const reap = gr.reapresentacoes(emp);
      expect(blocos(html, "data-reapresentado")).toEqual(reap.map((r) => String(r.exercicio)));
      for (const r of reap) {
        expect(t, `${slug} ${r.exercicio}: publicado`).toContain(reais(r.publicado, 2));
        expect(t, `${slug} ${r.exercicio}: reapresentado`).toContain(reais(r.reapresentado, 2));
      }
      if (emp.anuais.at(-1)!.base === "individual") expect(t).toMatch(/individua(l|is)/);
      expect(html.includes("data-ultimo-trimestre")).toBe(Boolean(emp.ultimo_trimestre?.atual));
    } else {
      expect((html.match(/data-nao-divulgado/g) ?? []).length).toBeGreaterThanOrEqual(gr.INDICADORES_FICHA.length);
    }
    // vínculo com o segmento, quando o grupo está no ranking e o segmento tem página
    const noRanking = c.ranking!.grupos.find((g) => g.slug === slug);
    expect(html.includes("data-link-segmento")).toBe(Boolean(noRanking && gr.hrefDoSegmento(c, noRanking.segmento)));
  });

  it("ficha com slug inexistente responde 404 (notFound), nunca página vazia", () => {
    expect(() => FichaPage({ params: { slug: "nao-existe" }, searchParams: {} })).toThrow();
    expect(() => FichaPage({ params: { slug: "__proto__" }, searchParams: {} })).toThrow();
  });

  const semUltimoAno = Object.entries(e.empresas).find(([, emp]) => !gr.periodoDe(emp, anos.at(-1)!))?.[0];
  const recortesComparador: Record<string, string>[] = [
    {},
    ...cmp.PARES.map((p) => ({ e: p.slugs.join(","), ano: String(anos.at(-1)) })),
    { e: Object.keys(e.empresas).slice(-4).join(","), ano: String(anos[0]) },
    ...(semUltimoAno ? [{ e: `${semUltimoAno},${cmp.PAR_PADRAO[0]}`, ano: String(anos.at(-1)) }] : []),
    { e: "nao-existe,<b>", ano: "1999" },
    { e: Object.keys(e.empresas).at(-1)! },
  ];

  it.each(recortesComparador.map((r) => [new URLSearchParams(r).toString() || "(padrão)", r] as const))("/varejo/comparador?%s segue o molde, com a ponte que fecha e a demonstração original de cada empresa", (_n, r) => {
    const html = render(ComparadorPage({ searchParams: r }));
    conferirPainel(gr.ROTA_COMPARADOR, html);
    semLixo(gr.ROTA_COMPARADOR, html);
    linksValidos(gr.ROTA_COMPARADOR, html);
    const t = texto(html);
    const ano = cmp.anoDaUrl(e, r.ano ?? null);
    const slugs = blocos(html, "data-ponte-empresa");
    expect(slugs.length).toBeGreaterThanOrEqual(cmp.MIN_EMPRESAS);
    expect(slugs.length).toBeLessThanOrEqual(cmp.MAX_EMPRESAS);
    expect(new Set(slugs).size).toBe(slugs.length);
    const pedidos = cmp.selecaoDaUrl(e, r.e);
    if (pedidos.length >= 2) expect(slugs).toEqual(pedidos);
    if (pedidos.length === 1) expect(slugs[0]).toBe(pedidos[0]);
    if (pedidos.length === 0) expect(slugs).toEqual([...cmp.PAR_PADRAO]);
    expect(blocos(html, "data-caixa-empresa")).toEqual(slugs);
    for (const id of ["ponte", "caixa"]) expect(html, id).toContain(`data-figura-analitica="${id}"`);
    const comDado = slugs.filter((s) => gr.periodoDe(e.empresas[s], ano)?.ponte_100);
    // só o exercício pedido entra: a empresa sem ele mostra a ausência, nas duas figuras, e nenhum outro ano no lugar
    expect(blocos(html, "data-sem-exercicio").sort()).toEqual([...slugs.filter((s) => !comDado.includes(s)), ...slugs.filter((s) => !gr.periodoDe(e.empresas[s], ano))].sort());
    expect(blocos(html, "data-reconcilia")).toEqual(comDado.map(() => "sim"));
    expect(blocos(html, "data-lucro-por-100")).toEqual(comDado.map((s) => gr.periodoDe(e.empresas[s], ano)!.ponte_100!.lucro_liquido.toFixed(2)));
    for (const s of comDado) {
      const p = gr.periodoDe(e.empresas[s], ano)!;
      expect(t, `${s}: lucro por R$ 100`).toContain(por100(p.ponte_100!.lucro_liquido));
      expect(html, `${s}: demonstração original`).toContain(`href="${gr.urlSegura(p.documento!.link)!.replace(/&/g, "&amp;")}"`);
      const cx = cmp.caixaDe(p);
      expect(t, `${s}: caixa operacional`).toContain(reais(cx.operacional));
      if (cx.aposConvenio !== null) expect(t, `${s}: caixa depois do convênio`).toContain(reais(cx.aposConvenio));
    }
    // as parcelas podem ser abertas (despesas e financeiro), em elemento nativo e acessível por teclado
    if (comDado.length) expect((html.match(/<details[^>]*data-abre-parcela/g) ?? []).length).toBeGreaterThanOrEqual(comDado.length);
    // avisos calculados e os dois que valem sempre
    const avisos = cmp.avisosDaSelecao(slugs.map((slug) => ({ slug, emp: e.empresas[slug] })), ano);
    expect(blocos(html, "data-aviso")).toEqual([...avisos.map((a) => a.id), "arrendamento", "ajustado"]);
    // dívida e arrendamento separados na tabela lado a lado
    expect(t).toMatch(/Dívida líquida sem arrendamento/);
    expect(t).toMatch(/Passivo de arrendamento/);
    expect(html.includes("data-leitura-do-par")).toBe(slugs.length === 2);
    const par = cmp.parDaSelecao(slugs);
    expect(blocos(html, "data-par-preparado")).toEqual(par ? [par.id] : []);
    expect(html).toContain("data-exportar-recorte");
    // nenhuma ordenação por desempenho nem rótulo de julgamento
    expect(t).not.toMatch(/melhor empresa|mais eficiente que|pior empresa|vencedor/i);
  });

  it("/varejo/comparador: os atalhos dos dois pares preparados abrem a página, com o par em vigor marcado", () => {
    const html = render(ComparadorPage({ searchParams: {} }));
    const atalhos = html.slice(html.indexOf("data-atalhos-pares"), html.indexOf("data-recorte"));
    for (const p of cmp.PARES) expect(internos(atalhos), p.id).toContain(cmp.hrefComparador(e, p.slugs, anos.at(-1)!));
    expect((atalhos.match(/aria-current="true"/g) ?? []).length).toBe(1);
  });

  it("/varejo/segmentos liga cada concorrente com ficha à ficha do grupo", () => {
    const s = c.segmentos?.segmentos.find((x) => (x.concorrentes ?? []).some((k) => k.slug && c.fichas[k.slug]));
    if (!s) return;
    const html = render(SegmentosPage({ searchParams: { segmento: s.slug } }));
    for (const k of (s.concorrentes ?? []).filter((x) => x.slug && c.fichas[x.slug])) expect(html, k.slug!).toContain(`href="${gr.hrefFicha(k.slug!)}"`);
    linksValidos("/varejo/segmentos", html);
  });
});

describe("CSV do ranking", () => {
  it("uma linha por grupo, com natureza, definição de venda, fonte, página e data de consulta; ausência como campo vazio", () => {
    const csv = csvGrupos(c);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const l = csv.trimEnd().split("\n");
    expect(l.length - 1).toBe(c.ranking!.grupos.length);
    const cab = l[0].replace("﻿", "").split(";");
    for (const k of ["posicao", "grupo", "bandeiras", "natureza_do_dado", "participacao_na_amostra_pct", "definicao_de_venda", "fonte", "pagina", "consultado_em"]) expect(cab, k).toContain(k);
    expect(csv).not.toMatch(/undefined|NaN|null|participacao_de_mercado/);
    const natureza = cab.indexOf("natureza_do_dado");
    for (const linha of l.slice(1)) expect(Object.values(gr.ROTULO_NATUREZA)).toContain(linha.split(";")[natureza]);
    const semValor = structuredClone(c);
    semValor.ranking!.grupos[0].vendas_milhoes = null;
    const pos = cab.findIndex((k) => k.startsWith("vendas_") && k.endsWith("_milhoes_reais") && !k.includes("anterior"));
    const linha1 = csvGrupos(semValor).split("\n").slice(1).find((x) => x.startsWith(`${semValor.ranking!.grupos[0].posicao};`))!;
    expect(linha1.split(";")[pos]).toBe("");
  });
});
