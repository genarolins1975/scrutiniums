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
import { EVENTOS_A_VISTA, SERIES_A_VISTA, valorNaUnidade } from "@/components/varejo/FichaGrupo";
import MetodoPage from "@/app/varejo/metodo/page";
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
    // (redesenho de 24/11/2026: a figura do ranking virou o mosaico, com tabela equivalente própria; a lista completa, com as marcas
    // de natureza, é o bloco `lista`, logo depois das figuras e antes dos líderes)
    const lista = html.slice(html.indexOf('id="lista"'), html.indexOf('id="lideres"'));
    expect(html.indexOf('id="lista"')).toBeGreaterThan(html.indexOf('data-figura-analitica="ranking"'));
    const naturezas = blocos(lista.slice(lista.indexOf("<table")), "data-natureza-dado");
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
    // capítulos secundários recolhidos por padrão, com tudo no HTML: séries além das primeiras e eventos além dos mais recentes
    expect(blocos(html, "data-series-recolhidas")).toEqual(f.operacionais.length > SERIES_A_VISTA ? [String(f.operacionais.length - SERIES_A_VISTA)] : []);
    expect(blocos(html, "data-eventos-anteriores")).toEqual(f.eventos.length > EVENTOS_A_VISTA ? [String(f.eventos.length - EVENTOS_A_VISTA)] : []);
    expect(html).toMatch(/<details id="fontes"(?![^>]*\bopen\b)/);
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
    // uma empresa só: com e sem companhia do mesmo segmento na base
    ...Object.keys(e.empresas).filter((s, i, todos) => { const n = cmp.substitutos(cmp.empresasComparaveis(e, c), s).length; return todos.findIndex((t) => (cmp.substitutos(cmp.empresasComparaveis(e, c), t).length > 0) === n > 0) === i; }).map((s) => ({ e: s })),
  ];

  it.each(recortesComparador.map((r) => [new URLSearchParams(r).toString() || "(padrão)", r] as const))("/varejo/comparador?%s segue o molde, com a ponte que fecha e a demonstração original de cada empresa", (_n, r) => {
    const html = render(ComparadorPage({ searchParams: r }));
    conferirPainel(gr.ROTA_COMPARADOR, html);
    semLixo(gr.ROTA_COMPARADOR, html);
    linksValidos(gr.ROTA_COMPARADOR, html);
    const t = texto(html);
    const ano = cmp.anoDaUrl(e, r.ano ?? null);
    const pedidos = cmp.selecaoDaUrl(e, r.e);
    // uma empresa só, sem companhia do mesmo segmento na base: a página pede a segunda em vez de completar com outro ramo
    if (pedidos.length === 1 && cmp.substitutos(cmp.empresasComparaveis(e, c), pedidos[0]).length === 0) {
      expect(blocos(html, "data-escolha-segunda")).toEqual(pedidos);
      expect(blocos(html, "data-ponte-empresa")).toEqual([]);
      expect(blocos(html, "data-segunda").sort()).toEqual(Object.keys(e.empresas).filter((s) => s !== pedidos[0]).sort());
      expect(html).not.toContain("data-figura-analitica");
      return;
    }
    expect(html).not.toContain("data-escolha-segunda");
    const slugs = blocos(html, "data-ponte-empresa");
    expect(slugs.length).toBeGreaterThanOrEqual(cmp.MIN_EMPRESAS);
    expect(slugs.length).toBeLessThanOrEqual(cmp.MAX_EMPRESAS);
    expect(new Set(slugs).size).toBe(slugs.length);
    if (pedidos.length >= 2) expect(slugs).toEqual(pedidos);
    if (pedidos.length === 1) {
      expect(slugs[0]).toBe(pedidos[0]);
      // a dupla só é completada com companhia do mesmo segmento
      expect(cmp.substitutos(cmp.empresasComparaveis(e, c), pedidos[0]).map((x) => x.slug)).toContain(slugs[1]);
    }
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

describe("segmentos e método", () => {
  const g = dados.goldSetor();

  it("diferença contra o Brasil: a atividade menos o varejo a que ela pertence, na mesma medida e no mesmo mês, em pontos percentuais", () => {
    for (const medida of dados.MEDIDAS) {
      const linhas = dados.linhasAtividades(g, medida);
      for (const l of linhas) {
        const d = dados.contraBrasil(g, l, medida);
        const dono = l.universo === "detalhe" ? g.pmc.atividades[l.parteDe!].universo : l.universo;
        expect(d.universo, l.slug).toBe(dono === "ampliado" ? "ampliado" : "restrito");
        const br = dados.leituraBrasil(g, d.universo);
        if (l.volume !== null && br.volume[medida] !== null) expect(d.volume, `${l.slug} ${medida}`).toBeCloseTo(l.volume - (br.volume[medida] as number), 1);
        else expect(d.volume).toBeNull();
        if (l.receita !== null && br.receita[medida] !== null) expect(d.receita, `${l.slug} ${medida}`).toBeCloseTo(l.receita - (br.receita[medida] as number), 1);
        else expect(d.receita).toBeNull();
      }
      // a página traz a coluna e o universo de comparação de cada linha (o CSV do recorte recebe as mesmas linhas, no navegador)
      const html = render(SegmentosPage({ searchParams: { medida } }));
      const tabela = html.slice(html.indexOf('data-figura-analitica="atividades"'));
      const cabecalho = texto(tabela.slice(tabela.indexOf("<thead"), tabela.indexOf("</thead>")));
      expect(cabecalho).toMatch(/contra o Brasil, p\.p\./);
      const corpo = texto(tabela.slice(tabela.indexOf("<tbody"), tabela.indexOf("</tbody>")));
      for (const u of new Set(linhas.map((l) => dados.contraBrasil(g, l, medida).universo))) expect(corpo).toContain(dados.NOME_UNIVERSO[u].toLowerCase());
    }
  });

  it("método: ranking, conferências, base da CVM, todas as fórmulas da gold e as lacunas lidas do dado", () => {
    const html = render(MetodoPage());
    semLixo("/varejo/metodo", html);
    linksValidos("/varejo/metodo", html);
    const t = texto(html);
    expect(html).toMatch(/<section id="grupos"/);
    expect(html).toContain(`href="${c.ranking!.fonte.url}"`);
    expect(t).toContain(textoCurado(c.ranking!.fonte.conceito_venda).slice(0, 60));
    for (const v of Object.values(c.ranking!.fonte.hierarquia_fontes ?? {})) expect(t, v).toContain(textoCurado(v));
    for (const x of c.ranking!.conferencias ?? []) expect(html, x.fonte).toContain(`data-metodo-conferencia="${x.fonte}"`);
    for (const f of Object.values(e.formulas)) expect(t, f).toContain(f);
    const linhas = gr.linhasDoRanking(c);
    const lacuna = (id: string) => { const i = html.indexOf(`data-lacuna="${id}"`); expect(i, id).toBeGreaterThan(0); return texto(html.slice(i, html.indexOf("</li>", i))); };
    for (const l of linhas.filter((x) => x.natureza_dado === "estimado_pela_fonte")) expect(lacuna("estimados"), l.slug).toContain(l.grupo);
    for (const l of linhas.filter((x) => x.capital === "fechado" && !x.empresa_gold)) expect(lacuna("fechados"), l.slug).toContain(l.grupo);
    for (const l of linhas.filter((x) => x.empresa_gold)) expect(lacuna("fechados"), l.slug).not.toContain(`${l.grupo},`);
    expect(lacuna("digitais").length).toBeGreaterThan(80);
    expect(lacuna("conceitos-pmc").length).toBeGreaterThan(80);
    // companhia com ficha sem o último exercício na base, e companhia com o último trimestre atrás das demais
    const ultimo = anos.at(-1)!;
    const semAno = Object.values(c.fichas).filter((f) => f.empresa_gold && e.empresas[f.empresa_gold] && !gr.periodoDe(e.empresas[f.empresa_gold], ultimo));
    expect(blocos(html, "data-lacuna").filter((x) => x === "sem-demonstracao")).toHaveLength(semAno.length);
    for (const f of semAno) expect(lacuna("sem-demonstracao")).toContain(f.grupo);
    expect(blocos(html, "data-lacuna").filter((x) => x === "conferencia")).toHaveLength((c.ranking!.conferencias ?? []).filter((x) => x.nao_acessado).length);
    expect(blocos(html, "data-lacuna")).toContain("trimestre");
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

/**
 * Figuras do redesenho de 24/11/2026 (mosaico de tamanhos, inclinação, dispersão, régua das plataformas, mapa de presença, pequenos
 * múltiplos, cupons lado a lado, cascata do caixa e pontos conectados). Invariantes dos seletores que as alimentam: cada número de
 * figura sai de um seletor, fecha com o dado de origem e mantém a ausência como ausência.
 */
describe("seletores das figuras dos grupos", () => {
  const linhas = gr.linhasDoRanking(c);

  it("tamanhos por segmento: todo grupo com venda entra uma vez, as participações fecham em 100% e a do segmento é a soma dos seus grupos", () => {
    const t = gr.tamanhosPorSegmento(c);
    const blocosT = t.flatMap((s) => s.blocos);
    expect(blocosT.map((b) => b.slug).sort()).toEqual(linhas.filter((l) => typeof l.vendas_milhoes === "number").map((l) => l.slug).sort());
    expect(t.reduce((s, x) => s + x.participacao, 0)).toBeCloseTo(100, 6);
    for (const s of t) {
      expect(s.participacao, s.segmento).toBeCloseTo(s.blocos.reduce((a, b) => a + b.participacao, 0), 6);
      expect(s.vendas_milhoes, s.segmento).toBeCloseTo(s.blocos.reduce((a, b) => a + b.vendas_milhoes, 0), 6);
      expect(s.blocos.map((b) => b.vendas_milhoes)).toEqual([...s.blocos.map((b) => b.vendas_milhoes)].sort((a, b) => b - a));
    }
    expect(t.map((s) => s.vendas_milhoes)).toEqual([...t.map((s) => s.vendas_milhoes)].sort((a, b) => b - a));
    expect(blocosT.filter((b) => b.natureza === "estimado_pela_fonte")).toHaveLength(gr.amostraDoRanking(c).estimados);
  });

  it("mosaico: a área de cada bloco é proporcional ao valor, a soma das áreas é a da caixa e nenhum bloco sai dela", async () => {
    const { mosaico } = await import("@/components/varejo/figuras/geometria");
    const itens = linhas.filter((l) => typeof l.vendas_milhoes === "number").map((l) => ({ id: l.slug, valor: l.vendas_milhoes as number }));
    const caixa = { x: 10, y: 20, w: 1000, h: 470 };
    const m = mosaico(itens, caixa);
    const total = itens.reduce((s, i) => s + i.valor, 0);
    expect(m).toHaveLength(itens.length);
    expect(m.reduce((s, b) => s + b.w * b.h, 0)).toBeCloseTo(caixa.w * caixa.h, 3);
    for (const b of m) {
      expect((b.w * b.h) / (caixa.w * caixa.h), b.id).toBeCloseTo(b.valor / total, 6);
      expect(b.x).toBeGreaterThanOrEqual(caixa.x - 1e-6);
      expect(b.y).toBeGreaterThanOrEqual(caixa.y - 1e-6);
      expect(b.x + b.w).toBeLessThanOrEqual(caixa.x + caixa.w + 1e-6);
      expect(b.y + b.h).toBeLessThanOrEqual(caixa.y + caixa.h + 1e-6);
    }
    expect(mosaico([{ valor: 0 }, { valor: -3 }], caixa)).toEqual([]);
  });

  it("movimentos: posições ganhas são a anterior menos a atual; sem posição anterior não há ganho; o destaque nunca é troca de um lugar", () => {
    const m = gr.movimentosDoRanking(c);
    expect(m.map((x) => x.atual)).toEqual(linhas.map((l) => l.posicao));
    for (const x of m) expect(x.ganho, x.slug).toBe(x.anterior === null ? null : x.anterior - x.atual);
    expect(gr.limiarDeDestaque(m)).toBeGreaterThanOrEqual(2);
    expect(gr.movimentosDoRanking({ ...c, ranking: { ...c.ranking!, grupos: [{ ...c.ranking!.grupos[0], posicao_anterior: null }] } })[0]).toMatchObject({ anterior: null, ganho: null });
  });

  it("vendas e lojas: a venda por loja é a divisão das duas, e grupo sem número de lojas fica sem ela (nunca zero)", () => {
    for (const x of gr.modelosDeLoja(c)) {
      const l = linhas.find((y) => y.slug === x.slug)!;
      if (typeof l.vendas_milhoes === "number" && typeof l.lojas === "number" && l.lojas > 0) expect(x.venda_por_loja_milhoes, x.slug).toBeCloseTo(l.vendas_milhoes / l.lojas, 9);
      else expect(x.venda_por_loja_milhoes, x.slug).toBeNull();
    }
    expect(gr.modelosDeLoja(c).some((x) => x.lojas === null)).toBe(linhas.some((l) => typeof l.lojas !== "number"));
  });

  it("decomposição do crescimento: (1 + vendas) = (1 + lojas) × (1 + venda por loja), e parte sem os dois anos fica ausente", () => {
    for (const g of c.ranking!.grupos) {
      const [v, l, p] = gr.decomposicaoDoCrescimento(g);
      if (v.variacao_pct !== null && l.variacao_pct !== null && p.variacao_pct !== null) expect((1 + l.variacao_pct / 100) * (1 + p.variacao_pct / 100), g.slug).toBeCloseTo(1 + v.variacao_pct / 100, 9);
      if (typeof g.vendas_ano_anterior_milhoes !== "number") expect(v.variacao_pct, g.slug).toBeNull();
      if (typeof g.lojas_ano_anterior !== "number" || typeof g.lojas !== "number") expect(p.variacao_pct, g.slug).toBeNull();
    }
    expect(gr.decomposicaoDoCrescimento(null).every((x) => x.variacao_pct === null)).toBe(true);
  });

  it("plataformas, conferência e líderes: venda própria mais a de terceiros dá o valor negociado; a diferença é ABRAS menos IRTT; a parte do líder é a venda dele sobre a do segmento", () => {
    const lista = c.ranking!.marketplaces!.lista!;
    const regua = gr.reguaDasPlataformas(c);
    expect(regua.map((x) => x.nome)).toEqual(lista.map((m) => m.nome));
    for (const x of regua) {
      if (x.propria_milhoes !== null) expect(x.propria_milhoes + x.terceiros_milhoes!, x.nome).toBeCloseTo(x.gmv_milhoes!, 6);
      else expect(x.gmv_milhoes === null || x.terceiros_milhoes === null, x.nome).toBe(true);
      if (x.slug) expect(Object.keys(c.fichas), x.nome).toContain(x.slug);
    }
    for (const p of gr.paresDaAbras(c)) if (p.irtt_milhoes !== null) expect(p.diferenca_milhoes, p.slug).toBeCloseTo(p.outra_milhoes - p.irtt_milhoes, 6);
    for (const l of gr.lideresNosSegmentos(c)) if (l.parte_do_lider_pct !== null) expect(l.parte_do_lider_pct, l.lider).toBeCloseTo((100 * l.vendas_milhoes!) / l.vendas_segmento_milhoes!, 9);
    expect(gr.lideresNosSegmentos(c)).toHaveLength(c.ranking!.lideres_por_segmento!.length);
  });

  it("presença por estado: 'todos' pinta as 27, a lista traz só siglas válidas e a ausência de lista é estado próprio, sem estado pintado", () => {
    for (const slug of gr.slugsDasFichas(c)) {
      const p = gr.presencaPorEstado(c, slug);
      expect(new Set(p.ufs).size, slug).toBe(p.ufs.length);
      if (p.tipo === "todos") expect(p.ufs, slug).toHaveLength(27);
      if (p.tipo === "lista") expect(p.ufs.length, slug).toBeGreaterThan(0);
      if (p.tipo === "lista") expect(p.ufs.length, slug).toBeLessThan(27);
      if (p.tipo === "nao_divulgado") expect([p.ufs.length, p.origem], slug).toEqual([0, null]);
      const daFicha = (c.fichas[slug].regioes?.estados ?? []).length;
      const doRanking = (c.ranking!.grupos.find((g) => g.slug === slug)?.estados ?? "").trim();
      expect(p.tipo === "nao_divulgado", slug).toBe(daFicha === 0 && doRanking === "");
      if (daFicha > 0) expect(p.origem, slug).toBe("ficha");
    }
    expect(gr.presencaPorEstado(c, "nao-existe").tipo).toBe("nao_divulgado");
  });

  it("séries da ficha: os indicadores e a dívida nos mesmos exercícios; a reapresentação só aparece onde o valor republicado difere do publicado", () => {
    for (const slug of gr.slugsDasFichas(c)) {
      const emp = gr.empresaDaFicha(e, c.fichas[slug]);
      if (!emp) continue;
      const series = gr.seriesDaFicha(emp, anos);
      expect(series.map((s) => s.id)).toEqual([...gr.INDICADORES_FICHA.map((i) => i.id), "divida"]);
      for (const s of series) expect(s.pontos.map((p) => p.exercicio), `${slug} ${s.id}`).toEqual(anos);
      const marcados = series.flatMap((s) => s.pontos.filter((p) => p.reapresentado !== null).map((p) => `${p.exercicio}-${s.id}`)).sort();
      expect(marcados, slug).toEqual(gr.reapresentacoes(emp).map((r) => `${r.exercicio}-${r.campo === "Receita líquida" ? "receita" : "lucro"}`).sort());
      for (const a of anos) if (!gr.periodoDe(emp, a)) for (const s of series) expect(s.pontos.find((p) => p.exercicio === a)!.valor, `${slug} ${a}`).toBeNull();
    }
  });

  it("série operacional em gráfico: três ou mais valores da mesma periodicidade, em ordem, e trimestre nunca divide o eixo com ano", () => {
    expect(gr.periodoOperacional("2025")).toEqual({ periodicidade: "anual", ordem: 2025 });
    expect(gr.periodoOperacional("dez/2025")).toEqual({ periodicidade: "anual", ordem: 2025 });
    expect(gr.periodoOperacional("4T24")!.periodicidade).toBe("trimestral");
    for (const p of ["1S26", "9M25", "jun/2026", "até 16/08/2026", "", undefined]) expect(gr.periodoOperacional(p), String(p)).toBeNull();
    expect(gr.serieComparavel({ valores: [{ periodo: "4T22", valor: 1 }, { periodo: "4T23", valor: 2 }, { periodo: "2025", valor: 3 }, { periodo: "2T26", valor: 4 }] })).toMatchObject({ periodicidade: "trimestral", pontos: [{ periodo: "4T22" }, { periodo: "4T23" }, { periodo: "2T26" }] });
    expect(gr.serieComparavel({ valores: [{ periodo: "2024", valor: 1 }, { periodo: "2025", valor: 2 }, { periodo: "1S26", valor: 3 }] })).toBeNull();
    for (const f of Object.values(c.fichas)) {
      for (const o of f.operacionais ?? []) {
        const s = gr.serieComparavel(o);
        if (!s) continue;
        expect(s.pontos.length, o.indicador).toBeGreaterThanOrEqual(3);
        expect(s.pontos.map((p) => p.ordem), o.indicador).toEqual([...s.pontos.map((p) => p.ordem)].sort((a, b) => a - b));
        for (const p of s.pontos) expect(gr.periodoOperacional(p.periodo)!.periodicidade, o.indicador).toBe(s.periodicidade);
      }
    }
  });

  it("venda do ranking contra a receita da CVM: a razão só existe no mesmo exercício e é a receita sobre a venda", () => {
    for (const g of c.ranking!.grupos) {
      const emp = g.empresa_gold ? e.empresas[g.empresa_gold] ?? null : null;
      const r = gr.rankingContraCvm(g.vendas_milhoes, emp, gr.exercicioDoRanking(c));
      const p = emp ? gr.periodoDe(emp, Number(gr.exercicioDoRanking(c))) : null;
      expect(r.mesmo_ano, g.slug).toBe(Boolean(p));
      if (p?.receita_liquida != null && typeof g.vendas_milhoes === "number") {
        expect(r.razao_pct, g.slug).toBeCloseTo((100 * p.receita_liquida) / (g.vendas_milhoes * 1e6), 6);
        expect(r.diferenca_milhoes, g.slug).toBeCloseTo(g.vendas_milhoes - p.receita_liquida / 1e6, 4);
      } else expect(r.razao_pct, g.slug).toBeNull();
    }
    expect(gr.rankingContraCvm(null, null, "2025")).toMatchObject({ venda_milhoes: null, receita_milhoes: null, razao_pct: null });
  });
});

describe("seletores das figuras do comparador", () => {
  const todosOsPeriodos = Object.entries(e.empresas).flatMap(([slug, emp]) => emp.anuais.map((p) => ({ slug, emp, p })));

  it("cascata do caixa: cada patamar é o anterior mais os passos entre eles, o declarado é o da demonstração e o convênio ausente não vira zero", () => {
    expect(cmp.cascataDoCaixa(null)).toBeNull();
    for (const { slug, p } of todosOsPeriodos) {
      const passos = cmp.cascataDoCaixa(p);
      const cx = cmp.caixaDe(p);
      if (!p.receita_liquida || cx.operacional === null) {
        expect(passos, `${slug} ${p.exercicio}`).toBeNull();
        continue;
      }
      const de = (id: string) => passos!.find((x) => x.id === id)!;
      const r = (v: number) => (100 * v) / p.receita_liquida!;
      const giro = ["estoques", "fornecedores", "recebiveis"].reduce((s, id) => s + (de(id).por100 ?? 0), 0);
      expect(de("antes-do-giro").por100! + giro, `${slug} ${p.exercicio}: giro`).toBeCloseTo(r(cx.operacional), 6);
      expect(de("operacional").por100, `${slug} ${p.exercicio}`).toBeCloseTo(r(cx.operacional), 9);
      expect(de("recebiveis").ate ?? de("fornecedores").ate ?? de("estoques").ate ?? de("antes-do-giro").ate, `${slug} ${p.exercicio}: o último passo do giro chega ao declarado`).toBeCloseTo(r(cx.operacional), 6);
      expect(de("convenio").por100 === null, `${slug} ${p.exercicio}: convênio`).toBe(cx.convenio === null);
      expect(de("apos-convenio").por100 === null).toBe(cx.convenio === null);
      if (cx.convenio !== null) {
        expect(de("apos-convenio").por100).toBeCloseTo(r(cx.aposConvenio!), 9);
        expect(de("convenio").ate).toBeCloseTo(r(cx.aposConvenio!), 6);
      }
      if (cx.investimentos !== null) expect(de("apos-investimentos").por100).toBeCloseTo(r((cx.aposConvenio ?? cx.operacional) + cx.investimentos), 9);
      for (const x of passos!) if (x.tipo === "total" && x.por100 !== null) expect([x.de, x.ate]).toEqual([0, x.por100]);
    }
  });

  it("cupons linha a linha: as saídas e o lucro de cada companhia fecham em R$ 100, e a distância anotada é a maior menos a menor", () => {
    const pontes = todosOsPeriodos.filter((x) => x.p.ponte_100).slice(0, 12).map((x) => x.p.ponte_100!);
    const linhasC = cmp.linhasDosCupons([...pontes, null]);
    expect(linhasC.map((l) => l.id)).toEqual(cmp.PARTES.map((p) => p.id));
    pontes.forEach((_b, i) => expect(linhasC.reduce((s, l) => s + (l.valores[i] as number), 0), String(i)).toBeCloseTo(100, 1));
    for (const l of linhasC) {
      expect(l.valores.at(-1)).toBeNull();
      const com = l.valores.filter((v): v is number => v !== null);
      if (l.maior !== null && l.menor !== null) {
        expect(l.valores[l.maior]).toBe(Math.max(...com));
        expect(l.valores[l.menor]).toBe(Math.min(...com));
        expect(l.amplitude).toBeCloseTo(Math.max(...com) - Math.min(...com), 9);
      }
    }
    expect(cmp.linhasDosCupons([pontes[0], null]).every((l) => l.maior === null && l.amplitude === null)).toBe(true);
    // o perfil do cupom lê a mesma ponte: a conta do cupom fecha com o lucro por R$ 100
    const { slug, emp, p } = todosOsPeriodos.find((x) => x.p.ponte_100)!;
    const perfil = cmp.perfilDoExercicio(slug, emp, p, "Companhia")!;
    expect(dados.contaDoCupom(perfil).resultado).toBe(p.ponte_100!.lucro_liquido);
    expect(cmp.perfilDoExercicio(slug, emp, null, "Companhia")).toBeNull();
  });

  it("pontos conectados e persistência desenhada: um valor por empresa e por medida; os quadrinhos somam o que a persistência conta", () => {
    const [a, b] = cmp.PARES[1].slugs.map((s) => e.empresas[s]);
    const ano = anos.at(-1)!;
    const pontos = cmp.medidasEmPontos([gr.periodoDe(a, ano), gr.periodoDe(b, ano), null]);
    expect(pontos.map((m) => m.medida.id)).toEqual(cmp.MEDIDAS_COMPARADAS.map((m) => m.id));
    for (const m of pontos) expect(m.valores).toHaveLength(3);
    for (const m of pontos) expect(m.valores[2]).toBeNull();
    for (const p of cmp.persistencias(e, a, b, ano)) {
      const sinais = cmp.sinaisPorExercicio(e, a, b, p.medida);
      expect(sinais.map((s) => s.exercicio)).toEqual(anos);
      expect(sinais.filter((s) => s.sinal !== null), p.medida.id).toHaveLength(p.comparaveis);
      expect(sinais.filter((s) => s.sinal === 1), p.medida.id).toHaveLength(p.aAcima);
      expect(p.a, p.medida.id).toBe(pontos.find((m) => m.medida.id === p.medida.id)!.valores[0]);
    }
  });
});

describe("figuras no HTML do servidor", () => {
  it("/varejo/grupos: mosaico com um bloco por grupo com venda e a estimativa marcada; inclinação com uma linha por grupo com posição anterior; dispersão com um ponto por grupo com lojas", () => {
    const html = render(GruposPage({ searchParams: {} }));
    const comVenda = gr.linhasDoRanking(c).filter((l) => typeof l.vendas_milhoes === "number");
    // o mosaico sai em duas composições (larga e de tablet) e em lista no celular: cada grupo aparece nas duas primeiras
    const blocosDoMosaico = blocos(html, "data-bloco-grupo");
    expect(blocosDoMosaico).toHaveLength(2 * comVenda.length);
    expect(new Set(blocosDoMosaico)).toEqual(new Set(comVenda.map((l) => l.slug)));
    expect((html.match(/data-bloco-grupo="[^"]*" data-estimado/g) ?? []).length).toBe(2 * comVenda.filter((l) => l.natureza_dado === "estimado_pela_fonte").length);
    expect(html).toContain("data-denominador");
    const mov = gr.movimentosDoRanking(c);
    expect(blocos(html, "data-linha-movimento").sort()).toEqual(mov.filter((m) => m.anterior !== null).map((m) => m.slug).sort());
    expect(blocos(html, "data-movimento")).toEqual(mov.map((m) => m.slug));
    const modelos = gr.modelosDeLoja(c);
    expect(blocos(html, "data-ponto-grupo").sort()).toEqual(modelos.filter((m) => m.venda_por_loja_milhoes !== null).map((m) => m.slug).sort());
    expect(blocos(html, "data-fora-da-dispersao")).toEqual(modelos.some((m) => m.venda_por_loja_milhoes === null) ? [String(modelos.filter((m) => m.venda_por_loja_milhoes === null).length)] : []);
    for (const id of ["ranking", "movimento", "modelos"]) expect(html).toContain(`data-figura-analitica="${id}"`);
    expect(blocos(html, "data-plataforma")).toEqual(c.ranking!.marketplaces!.lista!.map((m) => m.nome));
    expect(blocos(html, "data-par-de-listas")).toEqual(gr.paresDaAbras(c).map((p) => p.slug));
    expect(blocos(html, "data-lideres-de-segmento")).toEqual([String(c.ranking!.lideres_por_segmento!.length)]);
    // identidade: todo grupo do ranking aparece com o logo oficial ou com a placa tipográfica, nunca com imagem de arquivo ausente
    for (const l of comVenda) expect(html.includes(`data-logo="${l.slug}"`) || html.includes(`data-logo-ausente="${l.slug}"`), l.slug).toBe(true);
  });

  it.each(gr.slugsDasFichas(c))("ficha /varejo/grupos/%s: identidade com logo ou placa, mapa de presença no estado certo, cupom só com a ponte e linha do tempo desenhada", (slug) => {
    const f = gr.fichaDoGrupo(c, slug)!;
    const html = render(FichaPage({ params: { slug }, searchParams: {} }));
    expect(html).toContain("data-identidade-ficha");
    expect(html.includes(`data-logo="${slug}"`) || html.includes(`data-logo-ausente="${slug}"`)).toBe(true);
    const presenca = gr.presencaPorEstado(c, slug);
    expect(blocos(html, "data-mapa-presenca")).toEqual([presenca.tipo]);
    expect((html.match(/data-presente=""/g) ?? []).length).toBe(presenca.tipo === "nao_divulgado" ? 0 : presenca.ufs.length);
    const emp = gr.empresaDaFicha(e, f);
    const comPonte = emp ? dados.ultimoComPonte(emp.anuais) : null;
    expect(html.includes('data-figura-analitica="cupom"')).toBe(Boolean(comPonte));
    if (comPonte) expect(texto(html)).toContain(por100(Math.abs(comPonte.ponte_100!.lucro_liquido)).replace("−", ""));
    const noRanking = c.ranking!.grupos.find((g) => g.slug === slug) ?? null;
    expect(html.includes("data-decomposicao-do-crescimento")).toBe(gr.decomposicaoDoCrescimento(noRanking).some((x) => x.variacao_pct !== null));
    expect(html.includes("data-faixa-do-tempo")).toBe(f.eventos.filter((ev) => /^\d{4}-\d{2}/.test(ev.data ?? "")).length > 1);
    // minigráfico só para série de uma natureza só, com três ou mais pontos comparáveis
    const emGrafico = f.operacionais.filter((o) => gr.serieComparavel(o) && new Set((o.valores ?? []).filter((v) => (v.periodo ?? "").trim()).map((v) => gr.naturezaCurada(v.natureza))).size === 1).length;
    expect((html.match(/data-serie-em-grafico/g) ?? []).length).toBe(emGrafico);
  });

  it("/varejo/comparador: um cupom, uma cascata e uma marca por companhia, com a diferença de cada linha anotada", () => {
    for (const r of [{}, { e: cmp.PARES[1].slugs.join(","), ano: String(anos.at(-1)) }, { e: Object.keys(e.empresas).slice(0, 4).join(","), ano: String(anos.at(-2)) }] as Record<string, string>[]) {
      const html = render(ComparadorPage({ searchParams: r }));
      const slugs = blocos(html, "data-ponte-empresa");
      const ano = cmp.anoDaUrl(e, r.ano ?? null);
      expect(blocos(html, "data-cupons-lado-a-lado")).toEqual([String(slugs.length)]);
      const comCaixa = slugs.filter((s) => cmp.cascataDoCaixa(gr.periodoDe(e.empresas[s], ano)));
      expect((html.match(/data-cascata-caixa=""/g) ?? []).length).toBe(comCaixa.length);
      const linhasC = cmp.linhasDosCupons(slugs.map((s) => gr.periodoDe(e.empresas[s], ano)?.ponte_100 ?? null));
      expect(blocos(html, "data-linha-do-cupom")).toEqual(linhasC.map((l) => l.id));
      expect(blocos(html, "data-diferenca-da-linha")).toEqual(linhasC.map((l) => (l.amplitude === null ? "sem-dado" : l.amplitude.toFixed(2))));
      // as medidas vêm agrupadas pela unidade (as em % num eixo, as em dias noutro): todas presentes, uma vez cada
      expect(blocos(html, "data-medida-em-pontos").sort()).toEqual(cmp.MEDIDAS_COMPARADAS.map((m) => m.id).sort());
      expect((html.match(/data-persistencia-desenhada/g) ?? []).length).toBe(slugs.length === 2 ? cmp.MEDIDAS_COMPARADAS.length : 0);
      for (const s of slugs) expect(html.includes(`data-logo="${s}"`) || html.includes(`data-logo-ausente="${s}"`), s).toBe(true);
    }
  });
});
