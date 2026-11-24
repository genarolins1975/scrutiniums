/**
 * Contratos da coleção Varejo (Observatório da Economia; PMC e PAC do IBGE, contexto macroeconômico e companhias abertas da CVM):
 * registro e navegação, princípio do aperitivo, golds lidas pelo mesmo seletor em título, gráfico e tabela, natureza, período e
 * prova de cada número, molde de entrada e de painel no HTML do servidor, recorte na URL, estado "em apuração" da curadoria, CSV,
 * telemetria e frescor. Invariantes, sem texto literal: o que a gold disser é o que a página tem de mostrar.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AperitivoPage, { generateMetadata as metaAperitivo } from "@/app/aperitivo/varejo/page";
import EntradaPage, { generateMetadata as metaEntrada } from "@/app/varejo/page";
import BrasilPage, { generateMetadata as metaBrasil } from "@/app/varejo/brasil/page";
import { generateMetadata as metaComparador } from "@/app/varejo/comparador/page";
import { generateMetadata as metaGrupos } from "@/app/varejo/grupos/page";
import { generateMetadata as metaFicha } from "@/app/varejo/grupos/[slug]/page";
import SegmentosPage, { generateMetadata as metaSegmentos } from "@/app/varejo/segmentos/page";
import MetodoPage, { metadata as metaMetodo } from "@/app/varejo/metodo/page";
import { metadata as metaLayoutVarejo } from "@/app/varejo/layout";
import { escalaVarejo } from "@/components/varejo/EntradaVarejo";
import { comConta } from "@/lib/varejo/convite";
import { csvAtividades, csvSerieBrasil, csvUfs } from "@/lib/varejo/csv";
import * as dados from "@/lib/varejo/dados";
import { mesExtenso, num, variacao } from "@/lib/varejo/formato";
import { DOWNLOADS, hrefDownload, PAGINAS_VAREJO, paginasPublicadas, paineisPublicados, ROTA_BRASIL, ROTA_METODO, ROTA_SEGMENTOS, ROTA_VAREJO, SECAO_APERITIVO, UFS, VERSAO_ABERTA } from "@/lib/varejo/paginas";
import type { CuradoriaVarejo, GoldSetor } from "@/lib/varejo/tipos";
import { colecoesDe } from "@/lib/observatorios/colecoes";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { donoDaRota, paineis } from "@/lib/observatorios/registro";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { CONSULTAS, portas } from "@/lib/perguntas/portas";
import { APERITIVOS, desvioDoAperitivo, ehRotaPublica } from "@/lib/rotasPublicas";
import { SECTION_LABELS, VIEW_SECTIONS } from "@/lib/telemetry";
import limiares from "@/lib/frescor/limiares.json";
import { extrairFrescor } from "@/lib/frescor/regras";
import { conferirPainel } from "./suporte/molde-painel";

// as páginas usam componentes de cliente que leem o roteador (barra comum, seletores): fora do Next, o caminho é fixo
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => "/varejo",
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined, replace: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

// a curadoria chega aos poucos: o teste liga e desliga a ausência dela sem tocar nos arquivos
const semCuradoria = vi.hoisted(() => ({ ligado: false }));
vi.mock("@/lib/varejo/dados", async () => {
  const real = await vi.importActual<typeof import("@/lib/varejo/dados")>("@/lib/varejo/dados");
  const vazia: CuradoriaVarejo = { gerado_em: null, ranking: null, segmentos: null, fichas: {}, recusados: [] };
  return { ...real, curadoria: () => (semCuradoria.ligado ? vazia : real.curadoria()) };
});

const raiz = process.cwd();
const g = dados.goldSetor();
const e = dados.goldEmpresas();
const texto = (html: string) => html.replace(/<(script|style|template)[\s\S]*?<\/\1>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const render = (no: unknown) => renderToStaticMarkup(no as ReturnType<typeof createElement>);
const rotasDoApp: string[] = JSON.parse(readFileSync(join(raiz, "src/lib/uso/rotas-do-app.json"), "utf-8"));

/** Endereço interno existe: página do app, rota de servidor ou painel do registro (a aplicação do Crédito). */
function existe(href: string): boolean {
  const caminho = href.split(/[?#]/)[0] || "/";
  if (existsSync(join(raiz, "src/app", caminho, "route.ts")) || existsSync(join(raiz, "src/app", caminho, "page.tsx"))) return true;
  if (paineis().some((p) => p.rota.split(/[?#]/)[0] === caminho)) return true;
  return rotasDoApp.some((p) => p === caminho || new RegExp(`^${p.replace(/\/\[\[\.\.\.[^\]]+\]\]/g, "(?:/.+)?").replace(/\/\[[^\]]+\]/g, "/[^/]+")}$`).test(caminho));
}

const linksInternos = (html: string) => [...html.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

function semLixo(rota: string, html: string) {
  const t = texto(html);
  expect(t, `${rota}: undefined, NaN ou objeto no texto`).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]|\bInfinity\b/);
  expect(t.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [], `${rota}: data ISO no texto`).toEqual([]);
  expect(t, `${rota}: hora em UTC`).not.toMatch(/\bUTC\b|T\d{2}:\d{2}:\d{2}Z/);
  expect(t, `${rota}: travessão no texto`).not.toContain("—");
  expect(t, `${rota}: forma antiga de prontidão`).not.toMatch(/Em desenvolvimento|Versão em desenvolvimento/);
}

describe("registro, navegação e acesso", () => {
  it("a coleção é do Observatório da Economia, mantida por ele, com a entrada como porta", () => {
    const c = OBSERVATORIOS.find((o) => o.id === "economia")!.colecoes.find((x) => x.id === "varejo")!;
    expect(c).toBeDefined();
    expect(c.href).toBe(ROTA_VAREJO);
    expect(c.metodo).toBe(ROTA_METODO);
    expect(colecoesDe("economia").find((x) => x.id === "varejo")!.href).toBe(ROTA_VAREJO);
    // a ficha de grupo tem endereço dinâmico (/varejo/grupos/[slug]): fica fora do registro e responde pelo painel Grupos
    for (const p of paginasPublicadas().filter((x) => !x.metodo && !x.ficha)) {
      const painel = paineis().find((x) => x.rota === p.href)!;
      expect(painel, p.href).toBeDefined();
      expect([painel.observatorio, painel.colecao, painel.origem], p.href).toEqual(["economia", "varejo", null]);
      expect(painel.duplicataDe, p.href).toBeUndefined();
    }
    expect(donoDaRota(hrefDownload("ufs.csv"))?.rota).toBe(ROTA_VAREJO);
    for (const p of paginasPublicadas().filter((x) => x.ficha)) {
      expect(paineis().some((x) => x.rota === p.href), `${p.href}: padrão dinâmico no registro`).toBe(false);
      expect(donoDaRota(p.href.replace("[slug]", "assai"))?.rota, p.href).toBe(p.href.replace("/[slug]", ""));
    }
  });

  it("toda página do catálogo tem pergunta, resumo de até 140 caracteres, de 3 a 12 termos e seção de telemetria; a publicada existe no app", () => {
    expect(new Set(PAGINAS_VAREJO.map((p) => p.href)).size).toBe(PAGINAS_VAREJO.length);
    for (const p of PAGINAS_VAREJO) {
      expect(p.pergunta.trim().endsWith("?"), p.id).toBe(true);
      expect(p.resumo.length, p.id).toBeGreaterThan(20);
      expect(p.resumo.length, p.id).toBeLessThanOrEqual(140);
      expect(p.termos.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.termos.length, p.id).toBeLessThanOrEqual(12);
      const pasta = join(raiz, "src/app", ...p.href.split("/").filter(Boolean));
      if (p.publicada) {
        expect(existsSync(join(pasta, "page.tsx")), `${p.href} publicada sem página`).toBe(true);
        expect(VIEW_SECTIONS, p.secao).toContain(p.secao);
        expect((SECTION_LABELS as Record<string, string>)[p.secao], p.secao).toBeTruthy();
      } else {
        // página reservada: fora do registro e da navegação até a etapa que a cria trocar `publicada`
        expect(paineis().some((x) => x.rota === p.href), `${p.href} reservada no registro`).toBe(false);
      }
    }
    expect(VIEW_SECTIONS).toContain(SECAO_APERITIVO);
  });

  it("a navegação da coleção só traz páginas publicadas, com a entrada primeiro e o método nos atalhos", () => {
    const nav = navegacaoDaColecao("varejo");
    expect(nav.itens[0].href).toBe(ROTA_VAREJO);
    expect(nav.itens.slice(1).map((i) => i.href)).toEqual(paineisPublicados().map((p) => p.href));
    expect(nav.itens.every((i) => i.publicado)).toBe(true);
    expect(nav.atalhos.metodo).toBe(ROTA_METODO);
    const reservadas = PAGINAS_VAREJO.filter((p) => !p.publicada).map((p) => p.href);
    for (const i of nav.itens) expect(reservadas, i.href).not.toContain(i.href);
  });

  it("princípio do aperitivo: o endereço público serve o aperitivo sem sessão; painéis, golds e CSV ficam fechados; o método é aberto", () => {
    const a = APERITIVOS.find((x) => x.rota === ROTA_VAREJO)!;
    expect(a).toEqual({ tema: "Varejo", rota: ROTA_VAREJO, versaoAberta: VERSAO_ABERTA, painelCompleto: ROTA_VAREJO });
    expect(ehRotaPublica(ROTA_VAREJO)).toBe(true);
    expect(desvioDoAperitivo(ROTA_VAREJO)).toEqual({ tipo: "aperitivo", destino: VERSAO_ABERTA });
    expect(desvioDoAperitivo(VERSAO_ABERTA)).toEqual({ tipo: "interno" });
    expect(existsSync(join(raiz, "src/app", VERSAO_ABERTA, "page.tsx"))).toBe(true);
    expect(ehRotaPublica(ROTA_METODO)).toBe(true);
    const fechadas = [ROTA_BRASIL, ROTA_SEGMENTOS, VERSAO_ABERTA, "/varejo/gold/setor.json", "/varejo/gold/empresas.json", "/varejo/gold/curadoria.json", ...DOWNLOADS.map((d) => hrefDownload(d.arquivo)), ...PAGINAS_VAREJO.filter((p) => p.id !== "inicio" && !p.metodo).map((p) => p.href.replace("[slug]", "assai")), "/varejo/grupos.csv"];
    for (const r of fechadas) expect(ehRotaPublica(r), r).toBe(false);
    for (const d of DOWNLOADS) expect(existsSync(join(raiz, "src/app/varejo", d.arquivo, "route.ts")), d.arquivo).toBe(true);
  });

  it("camada aberta, sitemap, tracing e frescor conhecem a coleção", () => {
    expect(CONSULTAS.varejo.href).toBe(ROTA_VAREJO);
    const porta = portas().find((p) => p.id === "economia")!;
    expect(porta.paraOSeuCaso.map((c) => c.href)).toContain(ROTA_VAREJO);
    const sitemap = readFileSync(join(raiz, "src/app/sitemap.ts"), "utf-8");
    expect(sitemap).toContain(`rota("${ROTA_VAREJO}"`);
    expect(sitemap).toContain(`rota("${ROTA_METODO}"`);
    const cfg = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    // toda página dinâmica da coleção leva as golds no pacote da função (as estáticas as leem no build)
    for (const p of paginasPublicadas().filter((x) => x.id !== "inicio" && !x.metodo)) expect(cfg, p.href).toContain(`"${p.href}": ["./public/varejo/gold/*.json"]`);
    expect(cfg).toContain('source: "/varejo/gold/:path*"');
    const f = extrairFrescor("varejo", (arquivo) => JSON.parse(readFileSync(join(raiz, arquivo), "utf-8")));
    expect(f.publicadoEm).toBe(g.capturado_em);
    expect(f.referencia).toBe(g.referencia.pmc);
    expect(limiares.dominios.varejo.publicacao[0].arquivo).toBe("public/varejo/gold/setor.json");
  });
});

describe("título do documento", () => {
  /**
   * O <title> como o Next o monta: título absoluto sai como está; texto simples passa pelo modelo do layout mais próximo
   * acima do segmento da página (o da coleção para as páginas abaixo de /varejo; o da raiz para a entrada, que mora no
   * segmento do layout da coleção, e para o aperitivo, cujas cascas não declaram título).
   */
  const modeloRaiz = /template:\s*"([^"]*%s[^"]*)"/.exec(readFileSync(join(raiz, "src/app/layout.tsx"), "utf-8"))?.[1];
  const modeloColecao = (metaLayoutVarejo.title as { template: string }).template;
  const resolver = (titulo: unknown, modelo: string): string => {
    if (typeof titulo === "string") return modelo.replace("%s", titulo);
    const t = titulo as { absolute?: string; default?: string };
    return t.absolute ?? modelo.replace("%s", String(t.default));
  };
  const ficha = Object.keys(dados.curadoria().fichas)[0];
  const titulos: [string, string][] = [
    ["/varejo sem sessão (aperitivo)", resolver(metaAperitivo().title, modeloRaiz!)],
    [ROTA_VAREJO, resolver(metaEntrada().title, modeloRaiz!)],
    [ROTA_BRASIL, resolver(metaBrasil().title, modeloColecao)],
    [ROTA_SEGMENTOS, resolver(metaSegmentos().title, modeloColecao)],
    ["/varejo/comparador", resolver(metaComparador().title, modeloColecao)],
    ["/varejo/grupos", resolver(metaGrupos().title, modeloColecao)],
    [`/varejo/grupos/${ficha}`, resolver(metaFicha({ params: { slug: ficha }, searchParams: {} }).title, modeloColecao)],
    ["/varejo/grupos/(ficha que não existe)", resolver(metaFicha({ params: { slug: "nao-existe" }, searchParams: {} }).title, modeloColecao)],
    [ROTA_METODO, resolver(metaMetodo.title, modeloColecao)],
  ];

  it("os dois modelos existem e terminam no nome da plataforma", () => {
    expect(modeloRaiz).toMatch(/%s.*Scrutiniums$/);
    expect(modeloColecao).toMatch(/%s.*Scrutiniums$/);
    expect(ficha).toBeTruthy();
  });

  // em produção até 24/11/2026 o aperitivo saía "… · Varejo · Scrutiniums · Scrutiniums": título por extenso mais o modelo da raiz
  it.each(titulos)("%s: o nome da plataforma aparece uma vez só, no fim, e a coleção também uma vez", (_rota, titulo) => {
    expect(titulo.match(/Scrutiniums/g), titulo).toHaveLength(1);
    expect(titulo, titulo).toMatch(/ · Scrutiniums$/);
    expect(titulo.split(" · ").filter((p) => p === "Varejo").length, titulo).toBeLessThanOrEqual(1);
    expect(titulo, titulo).not.toMatch(/undefined|\[object Object\]/);
  });
});

describe("gold setorial: um seletor por número", () => {
  it("o último mês é o da referência, e as séries têm o comprimento do calendário", () => {
    expect(g.pmc.meses[dados.ultimoIndice(g)]).toBe(g.referencia.pmc);
    for (const u of dados.UNIVERSOS) for (const i of dados.INDICADORES) for (const s of Object.values(g.pmc.brasil[u][i])) expect(s).toHaveLength(g.pmc.meses.length);
    expect(dados.mesesSelecionaveis(g)[0]).toBe("2019-01");
    expect(dados.indiceDoMes(g, "1999-01")).toBe(dados.ultimoIndice(g));
    expect(dados.indiceDoMes(g, null)).toBe(dados.ultimoIndice(g));
  });

  it("o título do achado sai da gold: até 60 caracteres, com o valor do mês, e muda quando a gold muda", () => {
    const ult = dados.ultimoIndice(g);
    const mm = g.pmc.brasil.restrito.volume.mm[ult];
    const titulo = dados.tituloDoAchado(g);
    expect(titulo.length).toBeLessThanOrEqual(60);
    expect(titulo).toContain(mesExtenso(g.referencia.pmc));
    if (typeof mm === "number" && Number(mm.toFixed(1)) !== 0) expect(titulo).toContain(num(Math.abs(mm), 1));
    // a mesma gold com outro valor no último mês: o título acompanha, com o sentido certo
    const outro = (valor: number | null): GoldSetor => {
      const c = structuredClone(g);
      c.pmc.brasil.restrito.volume.mm[ult] = valor;
      return c;
    };
    const alta = dados.tituloDoAchado(outro(3.4));
    const queda = dados.tituloDoAchado(outro(-3.4));
    expect(alta).toContain(num(3.4, 1));
    expect(queda).toContain(num(3.4, 1));
    expect(alta).not.toBe(queda);
    expect(dados.tituloDoAchado(outro(0.04))).not.toMatch(/\d,\d%/);
    expect(dados.tituloDoAchado(outro(null))).not.toMatch(/\d,\d%|null|undefined/);
    for (const t of [alta, queda, dados.tituloDoAchado(outro(-17.9))]) expect(t.length).toBeLessThanOrEqual(60);
  });

  it("a série do gráfico termina no valor publicado, e a diferença é receita menos volume, em pontos percentuais", () => {
    const ult = dados.ultimoIndice(g);
    for (const u of dados.UNIVERSOS) {
      for (const m of dados.MEDIDAS) {
        const s = dados.serieBrasil(g, u, m, "24m");
        expect(s).toHaveLength(24);
        const p = s[s.length - 1];
        expect(p.mes).toBe(g.referencia.pmc);
        expect(p.volume).toBe(g.pmc.brasil[u].volume[m][ult]);
        expect(p.receita).toBe(g.pmc.brasil[u].receita[m][ult]);
        if (p.volume !== null && p.receita !== null) expect(p.diferenca).toBeCloseTo(p.receita - p.volume, 5);
      }
    }
    expect(dados.serieBrasil(g, "restrito", "aa", "2019")[0].mes).toBe("2019-01");
    expect(dados.diferenca(null, 1)).toBeNull();
    expect(dados.diferenca(1, null)).toBeNull();
  });

  it("difusão: só atividades do universo, sem as de detalhe, e a contagem fecha com o total", () => {
    const porUniverso = (u: string) => Object.values(g.pmc.atividades).filter((a) => a.universo === u).length;
    expect(dados.atividadesDoUniverso(g, "restrito")).toHaveLength(porUniverso("restrito"));
    expect(dados.atividadesDoUniverso(g, "ampliado")).toHaveLength(porUniverso("restrito") + porUniverso("ampliado"));
    for (const u of dados.UNIVERSOS) {
      for (const m of dados.MEDIDAS) {
        const d = dados.difusao(g, u, m, "volume");
        expect(d.alta + d.queda + d.estavel + d.semDado).toBe(d.total);
        expect(d.linhas.every((l) => l.universo !== "detalhe")).toBe(true);
      }
    }
    // ausência não é queda nem estabilidade
    const c = structuredClone(g);
    const [primeira] = dados.atividadesDoUniverso(c, "restrito");
    c.pmc.atividades[primeira].volume.aa[dados.ultimoIndice(c)] = null;
    expect(dados.difusao(c, "restrito", "aa", "volume").semDado).toBe(1);
  });

  it("pesquisa anual: os grupos somam o comércio varejista, o porte e as formas de venda fecham em 100%", () => {
    const v = dados.pacVarejo(g)!;
    const soma = dados.gruposDoVarejo(g).reduce((s, x) => s + (x.receita_operacional_liquida ?? 0), 0);
    expect(Math.abs(soma - v.receita_operacional_liquida!) / v.receita_operacional_liquida!).toBeLessThan(0.001);
    const p = dados.porteDoVarejo(g);
    expect(p.parteEmpresas!).toBeGreaterThan(0);
    expect(p.parteEmpresas!).toBeLessThan(p.partePessoal!);
    expect(p.partePessoal!).toBeLessThan(100);
    const formas = dados.formasDeComercializacao(g);
    expect(formas.reduce((s, f) => s + (f.parte ?? 0), 0)).toBeCloseTo(100, 6);
    expect(formas.map((f) => f.valor)).toEqual([...formas.map((f) => f.valor)].sort((a, b) => (b ?? -1) - (a ?? -1)));
  });

  it("estados: as 27 UFs têm código da malha, e a ordenação põe a ausência no fim, nunca como zero", () => {
    const linhas = dados.linhasUf(g, "restrito", "m12");
    expect(linhas).toHaveLength(27);
    expect(new Set(linhas.map((l) => l.cod)).size).toBe(27);
    for (const l of linhas) expect(UFS[l.uf].cod).toBe(l.cod);
    const ordenadas = dados.ordenarPor([{ nome: "b", v: null as number | null }, { nome: "a", v: -1 }, { nome: "c", v: 2 }], (l) => l.v);
    expect(ordenadas.map((l) => l.nome)).toEqual(["c", "a", "b"]);
    expect(dados.ufValida("sp", g)).toBe("SP");
    expect(dados.ufValida("XX", g)).toBeNull();
    expect(dados.atividadesDaUf(g, "SP").every((a) => g.pmc.atividades[a.slug].universo !== "detalhe")).toBe(true);
  });

  it("modelo dos R$ 100: companhias reais, com exercício, e as partes fecham a conta", () => {
    const perfis = dados.perfisDoModelo(e);
    // redesenho de 24/11/2026 ("O cupom de R$ 100"): de quatro a seis tipos de negócio, um caso real de cada (eram dois ou três)
    expect(perfis.length).toBeGreaterThanOrEqual(4);
    expect(perfis.length).toBeLessThanOrEqual(6);
    expect(new Set(perfis.map((p) => p.slug)).size).toBe(perfis.length);
    expect(new Set(perfis.map((p) => p.perfil)).size).toBe(perfis.length);
    for (const p of perfis) {
      expect(e.empresas[p.slug].nome).toBe(p.empresa);
      expect(e.empresas[p.slug].anuais.some((a) => a.exercicio === p.exercicio && a.ponte_100)).toBe(true);
      // o que sai (custo, despesas, juros, impostos, outros) mais o lucro é igual aos R$ 100
      const saidas = p.partes.filter((x) => x.id !== "lucro").reduce((s, x) => s + x.valor, 0);
      const lucro = p.partes.find((x) => x.id === "lucro")!.valor;
      expect(saidas + lucro).toBeCloseTo(100, 1);
      // o cupom: entradas (os R$ 100 e o que voltou) = saídas + resultado; com prejuízo, as saídas passam das entradas no valor dele
      const c = dados.contaDoCupom(p);
      const entrou = c.entradas.reduce((s, x) => s + x.valor, 0);
      const saiu = c.saidas.reduce((s, x) => s + x.valor, 0);
      expect(c.entradas[0]).toEqual({ id: "venda", rotulo: "Venda líquida", valor: 100 });
      expect(c.saidas.every((x) => x.valor > 0) && c.entradas.every((x) => x.valor > 0)).toBe(true);
      expect(entrou - saiu).toBeCloseTo(c.resultado, 1);
      expect(c.resultado).toBe(lucro);
      expect(c.total).toBeCloseTo(saiu + Math.max(0, lucro), 6);
      if (lucro < 0) expect(saiu).toBeGreaterThan(entrou);
    }
  });
});

describe("seletores das figuras (redesenho de 24/11/2026)", () => {
  it("tesoura: as duas séries saem de 100 no primeiro mês, seguem os índices publicados e a abertura é receita menos volume", () => {
    for (const u of dados.UNIVERSOS) {
      for (const per of dados.PERIODOS) {
        const t = dados.tesoura(g, g.pmc.brasil[u], per);
        const de = dados.inicioDoPeriodo(g, per);
        expect(t[0].mes).toBe(g.pmc.meses[de]);
        expect(t[0].volume).toBeCloseTo(100, 9);
        expect(t[0].receita).toBeCloseTo(100, 9);
        const fim = dados.fimDaTesoura(t)!;
        expect(fim.mes).toBe(g.referencia.pmc);
        const ult = dados.ultimoIndice(g);
        expect(fim.volume!).toBeCloseTo((100 * g.pmc.brasil[u].volume.indice_sa[ult]!) / g.pmc.brasil[u].volume.indice_sa[de]!, 9);
        expect(fim.abertura!).toBeCloseTo(fim.receita! - fim.volume!, 9);
      }
    }
    // série sem ajuste sazonal publicado (atividade de detalhe): tudo ausente, nunca 100 nem zero
    const semSerie = Object.values(g.pmc.atividades).find((a) => a.volume.indice_sa.every((x) => x === null));
    if (semSerie) {
      const t = dados.tesoura(g, semSerie, "24m");
      expect(t.every((p) => p.volume === null && p.abertura === null)).toBe(true);
      expect(dados.fimDaTesoura(t)).toBeNull();
    }
    // lacuna no mês-base: a série inteira fica ausente
    const c = structuredClone(g);
    c.pmc.brasil.restrito.volume.indice_sa[dados.inicioDoPeriodo(c, "24m")] = null;
    expect(dados.tesoura(c, c.pmc.brasil.restrito, "24m").every((p) => p.volume === null)).toBe(true);
  });

  it("mosaico: uma linha por atividade do universo, meses desde 2019, contagem igual à difusão e ausência preservada", () => {
    for (const u of dados.UNIVERSOS) {
      const m = dados.mosaicoAtividades(g, u, "aa", "volume");
      expect(m.meses[0]).toBe("2019-01");
      expect(m.meses.at(-1)).toBe(g.referencia.pmc);
      expect(m.linhas.map((l) => l.slug)).toEqual(dados.atividadesDoUniverso(g, u));
      expect(m.contagem).toHaveLength(m.meses.length);
      for (const l of m.linhas) expect(l.valores).toHaveLength(m.meses.length);
      const d = dados.difusao(g, u, "aa", "volume");
      expect(m.contagem.at(-1)).toEqual({ alta: d.alta, queda: d.queda, estavel: d.estavel, semDado: d.semDado });
      const i = g.pmc.meses.indexOf("2020-04");
      const j = m.meses.indexOf("2020-04");
      for (const l of m.linhas) expect(l.valores[j]).toBe(g.pmc.atividades[l.slug].volume.aa[i]);
      expect(m.limite).toBeGreaterThan(0);
    }
    // atividade sem valor num mês continua sem valor (o atacado de alimentos só entra em 2023)
    const amp = dados.mosaicoAtividades(g, "ampliado", "aa", "volume");
    const atacado = amp.linhas.find((l) => l.slug === "atacado-alimentar");
    if (atacado) expect(atacado.valores[0]).toBeNull();
  });

  it("varejo no comércio, tipos de comércio e halteres leem a gold e fecham as contas", () => {
    const partes = dados.varejoNoComercio(g);
    expect(partes.map((p) => p.id)).toEqual(["receita", "empresas", "pessoal"]);
    for (const p of partes) {
      expect(p.parte!).toBeGreaterThan(0);
      expect(p.parte!).toBeLessThan(100);
      expect(p.parte!).toBeCloseTo((100 * p.varejo!) / p.total!, 9);
    }
    expect(partes[0].varejo).toBe(dados.pacVarejo(g)!.receita_operacional_liquida);
    expect(partes[0].total).toBe(g.pac.grupos[dados.CODIGO_PAC_TOTAL].receita_operacional_liquida);
    const tipos = dados.tiposDeComercio(g);
    expect(tipos.reduce((s, x) => s + (x.parte ?? 0), 0)).toBeCloseTo(100, 0);
    expect(tipos.map((x) => x.receita)).toEqual([...tipos.map((x) => x.receita)].sort((a, b) => (b ?? -1) - (a ?? -1)));
    for (const m of dados.MEDIDAS) {
      const hs = dados.halteres(g, m);
      expect(hs.every((x) => x.universo !== "detalhe")).toBe(true);
      expect(hs).toHaveLength(dados.atividadesDoUniverso(g, "ampliado").length);
      for (const x of hs) {
        expect(x.brasilVolume).toBe(dados.leituraBrasil(g, x.referencia).volume[m]);
        expect(x.contraVolume).toBe(dados.diferenca(x.volume, x.brasilVolume));
        expect(x.referencia).toBe(x.universo === "ampliado" ? "ampliado" : "restrito");
      }
      const comValor = hs.filter((x) => x.volume !== null).map((x) => x.volume as number);
      expect(comValor).toEqual([...comValor].sort((a, b) => b - a));
    }
  });

  it("etiquetas e indicadores dos segmentos: número da atividade equivalente, ausência dita, e figura só com dado estruturado", () => {
    const c = dados.curadoria();
    const etiquetas = dados.etiquetasDeSegmento(g, c, "m12");
    expect(etiquetas.map((x) => x.slug)).toEqual((c.segmentos?.segmentos ?? []).map((s) => s.slug));
    for (const x of etiquetas) {
      if (x.atividade) {
        expect(g.pmc.atividades[x.atividade]).toBeDefined();
        expect(x.volume).toBe(g.pmc.atividades[x.atividade].volume.m12[dados.ultimoIndice(g)]);
      } else {
        // segmento sem atividade equivalente: sem número e sem trajetória, nunca zero
        expect([x.volume, x.receita, x.trajetoria.length]).toEqual([null, null, 0]);
      }
      expect(String(x.vende)).not.toMatch(/undefined/);
    }
    for (const s of c.segmentos?.segmentos ?? []) {
      for (const f of [dados.indicadorDoSegmento(s, g, e, c), dados.taxaDeMargemDoSegmento(s, g)]) {
        if (!f) continue;
        expect(f.linhas.length).toBeGreaterThan(0);
        expect(f.unidade.trim()).not.toBe("");
        expect(f.fonte.trim()).not.toBe("");
        for (const l of f.linhas) {
          expect(Number.isFinite(l.valor), `${s.slug}: ${l.nome}`).toBe(true);
          expect(l.periodo).toMatch(/^\d{4}$/);
        }
      }
      // sem grupos da pesquisa anual ligados, não há taxa de margem inventada
      if (!(s.classes_pac_ids ?? []).length) expect(dados.taxaDeMargemDoSegmento(s, g)).toBeNull();
    }
    // margem bruta sai do campo publicado pela gold, no último exercício da companhia
    const moda = c.segmentos?.segmentos.find((s) => (s.indicador_operacional?.nome ?? "").toLowerCase().includes("margem bruta"));
    if (moda) {
      const f = dados.indicadorDoSegmento(moda, g, e, c)!;
      for (const l of f.linhas) {
        const ano = e.empresas[l.id].anuais.find((a) => String(a.exercicio) === l.periodo)!;
        expect(l.valor).toBeCloseTo(ano.margem_bruta_pct ?? (100 * ano.lucro_bruto!) / ano.receita_liquida!, 6);
      }
    }
  });
});

describe("números da entrada e do convite", () => {
  it("cada número de escala tem rótulo, período, fonte e destino que existe; ausência não vira zero", () => {
    const escala = escalaVarejo(g);
    expect(escala.length).toBeGreaterThanOrEqual(1);
    expect(escala.length).toBeLessThanOrEqual(4);
    for (const n of escala) {
      expect(n.rotulo.trim(), n.rotulo).not.toBe("");
      expect(n.periodo.trim(), n.rotulo).not.toBe("");
      expect(n.fonte.trim(), n.rotulo).not.toBe("");
      expect(existe(n.href), `${n.rotulo}: ${n.href}`).toBe(true);
      expect(String(n.valor), n.rotulo).not.toMatch(/undefined|NaN|sem dado/);
    }
    // gold sem o valor: o número fica ausente (null), e o componente escreve "Indisponível nesta publicação"
    const c = structuredClone(g);
    c.pmc.brasil.restrito.volume.m12[dados.ultimoIndice(c)] = null;
    expect(escalaVarejo(c)[0].valor).toBeNull();
    expect(escalaVarejo(g)[0].valor).toBe(variacao(g.pmc.brasil.restrito.volume.m12[dados.ultimoIndice(g)]));
  });

  it("o convite é dimensionado pela gold e só promete página publicada", () => {
    const itens = comConta(g, e, dados.curadoria());
    expect(itens.length).toBeGreaterThanOrEqual(5);
    expect(new Set(itens).size).toBe(itens.length);
    for (const i of itens) expect(i).not.toMatch(/undefined|NaN|sem dado/);
    expect(itens.join(" ")).toContain(num(Object.keys(g.pmc.ufs).length));
    expect(itens.join(" ")).toContain(String(g.pac.ano));
    const reservadas = PAGINAS_VAREJO.filter((p) => !p.publicada && p.id !== "grupo").length;
    // sem as páginas de grupos e do comparador no ar, o convite não as cita; com elas no ar, cita as duas, dimensionadas pelo dado
    if (reservadas === 2) expect(itens.join(" ")).not.toMatch(/comparador|maiores grupos/i);
    if (reservadas === 0) {
      const c = dados.curadoria();
      expect(itens.some((i) => /comparador/i.test(i) && i.includes(num(Object.keys(e.empresas).length)))).toBe(true);
      if (c.ranking?.grupos?.length) expect(itens.some((i) => /grupos/i.test(i) && i.includes(num(c.ranking!.grupos.length)) && i.includes(num(Object.keys(c.fichas).length)))).toBe(true);
      // sem o ranking da curadoria, o convite não promete os grupos
      expect(comConta(g, e, { gerado_em: null, ranking: null, segmentos: null, fichas: {}, recusados: [] }).join(" ")).not.toMatch(/maiores grupos/i);
    }
  });
});

describe("páginas no HTML do servidor", () => {
  it("versão aperitivo: o último resultado e o tamanho do mercado, com prova, convite e nenhum recurso fechado sem aviso", () => {
    const html = render(AperitivoPage());
    semLixo(VERSAO_ABERTA, html);
    expect(html).toContain('data-entrada="aperitivo"');
    expect(html).toContain("data-convite-aperitivo");
    const provas = [...html.matchAll(/data-prova-numero=""[^>]*>([^<]*(?:<!-- -->[^<]*)*)</g)].map((m) => m[1].replace(/<!-- -->/g, ""));
    expect(provas.length).toBeGreaterThanOrEqual(2);
    for (const p of provas) expect(p.split(" · ").filter((x) => x.trim()).length, p).toBeGreaterThanOrEqual(2);
    expect(texto(html)).toContain(variacao(g.pmc.brasil.restrito.volume.mm[dados.ultimoIndice(g)]));
    // sem mapa, sem gráfico do kit nem figura interativa (data-grafico) e sem arquivo: a malha das UFs, a leitura mês a mês e os CSV
    // são da área com conta. Desde o redesenho de 24/11/2026 a página aberta tem uma figura só, a tesoura de 24 meses em miniatura,
    // com descrição acessível e sem tabela nem valores mês a mês.
    expect(html).not.toMatch(/energia\/geo|data-grafico|\.csv/);
    expect(html.match(/data-tesoura-mini/g)).toHaveLength(1);
    expect(html).toMatch(/data-tesoura-mini=""[^>]*role="img"[^>]*aria-label="[^"]{40,}"/);
    expect(html).not.toMatch(/<table\b|type="range"/);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const h of linksInternos(html)) expect(existe(h), h).toBe(true);
    for (const p of PAGINAS_VAREJO.filter((x) => !x.publicada)) expect(html, p.href).not.toContain(`href="${p.href.replace("/[slug]", "")}"`);
  });

  it("entrada com conta: molde de entrada, fatias na ordem, de um a quatro números com prova, modelo didático e links válidos", () => {
    const html = render(EntradaPage());
    semLixo(ROTA_VAREJO, html);
    expect(html).toContain('data-entrada="colecao"');
    const fatias = [...html.matchAll(/data-fatia="([a-z-]+)"/g)].map((m) => m[1]);
    const ordem = ["abertura", "escala", "para-voce", "destinos", "artefato", "caminhos", "metodo"];
    expect(fatias.filter((f) => ordem.includes(f))).toEqual(ordem);
    const h1 = texto(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).trim();
    expect(h1.length).toBeLessThanOrEqual(60);
    expect(h1.endsWith("?")).toBe(true);
    const nEscala = (html.match(/data-numero-escala/g) ?? []).length;
    expect(nEscala).toBeGreaterThanOrEqual(1);
    expect(nEscala).toBeLessThanOrEqual(4);
    expect(html).toContain("data-modelo-didatico");
    expect(html).toContain("data-deixa-de-fora");
    expect(html).toContain("data-ponte-cem");
    for (const p of dados.perfisDoModelo(e)) expect(texto(html)).toContain(p.empresa);
    for (const h of linksInternos(html)) expect(existe(h), h).toBe(true);
    // toda subpágina publicada a um clique da entrada; nenhuma reservada
    for (const p of paineisPublicados()) expect(linksInternos(html).map((h) => h.split(/[?#]/)[0]), p.href).toContain(p.href);
    for (const p of PAGINAS_VAREJO.filter((x) => !x.publicada)) expect(linksInternos(html).map((h) => h.split(/[?#]/)[0]), p.href).not.toContain(p.href.replace("/[slug]", ""));
  });

  const recortesBrasil: Record<string, string>[] = [{}, { universo: "ampliado", medida: "aa", periodo: "5a", indicador: "receita", mes: "2024-03" }, { medida: "m12", periodo: "24m" }, { universo: "xyz", medida: "<b>", mes: "2099-13", periodo: "" }];
  it.each(recortesBrasil.map((r) => [new URLSearchParams(r).toString() || "(padrão)", r] as const))("/varejo/brasil?%s segue o molde de painel e mantém o recorte nos links", (_n, r) => {
    const html = render(BrasilPage({ searchParams: r }));
    conferirPainel(ROTA_BRASIL, html);
    semLixo(ROTA_BRASIL, html);
    expect(texto(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)![1]).trim()).toBe(dados.tituloDoAchado(g));
    for (const h of linksInternos(html)) expect(existe(h), h).toBe(true);
    for (const id of ["vendas", "diferenca", "difusao", "mercado", "contexto"]) expect(html, id).toContain(`data-figura-analitica="${id}"`);
    // cada seção com a sua figura (redesenho de 24/11/2026): tesoura, colunas da diferença, mosaico com a difusão, quadros de cem e três gráficos de contexto
    for (const fig of ["tesoura", "colunas", "mosaico"]) expect(html, fig).toContain(`data-figura-varejo="${fig}"`);
    expect(html.match(/data-quadro-de-cem/g)).toHaveLength(3);
    expect(html.match(/data-figura-varejo="linha-contexto"/g)).toHaveLength(3);
    expect(html.match(/data-linha-mosaico=/g)).toHaveLength(dados.atividadesDoUniverso(g, r.universo === "ampliado" ? "ampliado" : "restrito").length);
    // o ano da pesquisa anual acompanha o valor do mercado
    expect(texto(html)).toContain(String(g.pac.ano));
    const universo = r.universo === "ampliado" ? "ampliado" : "restrito";
    // medida padrão interanual desde o redesenho de 24/11/2026: a figura principal é a tesoura em índice, e a medida vale para a
    // diferença e o mosaico (era a variação no mês)
    const medida = (dados.MEDIDAS as readonly string[]).includes(r.medida) ? (r.medida as dados.Medida) : "aa";
    const p = dados.serieBrasil(g, universo, medida, "24m").at(-1)!;
    // o texto acompanha a seleção: a leitura traz os valores do recorte pedido
    expect(texto(html)).toContain(variacao(p.volume));
    expect(texto(html)).toContain(variacao(p.receita));
    if (universo === "ampliado") expect(html).toContain("universo=ampliado");
    expect(html).toContain('aria-current="true"');
  });

  it("/varejo/brasil: a contagem das atividades acompanha o mês escolhido", () => {
    const mes = "2024-03";
    const d = dados.difusao(g, "restrito", "aa", "volume", g.pmc.meses.indexOf(mes));
    const t = texto(render(BrasilPage({ searchParams: { medida: "aa", mes } })));
    expect(t).toContain(mesExtenso(mes));
    expect(t).toContain(`${num(d.alta)} `);
    expect(t).toContain(`das ${num(d.total)} atividades`);
  });

  const recortesSegmentos: Record<string, string>[] = [{}, { segmento: "farmacia", uf: "SP", universo: "ampliado", indicador: "receita", medida: "aa" }, { segmento: "moveis", periodo: "24m" }, { segmento: "nao-existe", uf: "ZZ" }];
  it.each(recortesSegmentos.map((r) => [new URLSearchParams(r).toString() || "(padrão)", r] as const))("/varejo/segmentos?%s segue o molde de painel", (_n, r) => {
    const html = render(SegmentosPage({ searchParams: r }));
    conferirPainel(ROTA_SEGMENTOS, html);
    semLixo(ROTA_SEGMENTOS, html);
    for (const h of linksInternos(html)) expect(existe(h), h).toBe(true);
    for (const id of ["atividades", "estados", "ecommerce"]) expect(html, id).toContain(`data-figura-analitica="${id}"`);
    expect(html.includes('data-figura-analitica="segmento"')).toBe(Boolean(r.segmento && g.pmc.atividades[r.segmento]));
    expect(html.includes('data-figura-analitica="estado"')).toBe(Boolean(r.uf && UFS[r.uf]));
    // toda atividade está na tabela, com o estado de ausência do peso dito, e o mapa tem a lista equivalente
    for (const a of Object.keys(g.pmc.atividades)) expect(html, a).toContain(`segmento=${a}`);
    expect(html).toContain("data-mapa-legado");
    // redesenho de 24/11/2026: halteres com todas as atividades principais, a prateleira com todos os segmentos da curadoria e o mapa de blocos com as 27 UFs
    // (os halteres das atividades de um estado aberto levam a sigla na frente do identificador e ficam fora desta conta)
    expect(html.match(/data-haltere="[a-z]/g)).toHaveLength(dados.atividadesDoUniverso(g, "ampliado").length);
    expect(html.includes("data-atividades-do-estado")).toBe(Boolean(r.uf && UFS[r.uf]));
    expect(html.match(/data-etiqueta="/g)).toHaveLength(dados.curadoria().segmentos?.segmentos.length ?? 0);
    expect(html.match(/data-bloco-uf="/g)).toHaveLength(27);
    expect(html).toContain("data-barra-de-partes");
    // trajetória recente: um minigráfico por atividade com série publicada; sem série, a ausência dita em texto, nunca uma linha inventada
    const comSerie = Object.values(g.pmc.atividades).filter((a) => dados.trajetoria(g, a, "volume").filter((p) => p.valor !== null).length >= 2).length;
    expect((html.match(/<svg[^>]*role="img"[^>]*aria-label="[^"]*índice de/g) ?? []).length).toBe(comSerie);
    expect((html.match(/data-sem-trajetoria/g) ?? []).length).toBe(Object.keys(g.pmc.atividades).length - comSerie);
  });

  it("/varejo/segmentos: sem a curadoria a página segue de pé e diz que o segmento está em apuração", () => {
    semCuradoria.ligado = true;
    try {
      const html = render(SegmentosPage({ searchParams: { segmento: "farmacia" } }));
      conferirPainel(ROTA_SEGMENTOS, html);
      semLixo(ROTA_SEGMENTOS, html);
      expect(html).toContain("data-segmento-em-apuracao");
      expect(html).not.toContain("data-segmento-curado");
      const metodo = render(MetodoPage());
      expect(metodo).toContain("data-em-apuracao");
      semLixo(ROTA_METODO, metodo);
    } finally {
      semCuradoria.ligado = false;
    }
  });

  it("/varejo/segmentos: com a curadoria, o segmento aberto traz a equivalência com o IBGE antes do texto", () => {
    const c = dados.curadoria();
    const s = c.segmentos?.segmentos.find((x) => (x.atividades_pmc ?? []).some((a) => g.pmc.atividades[a]));
    if (!s) return; // curadoria ainda não chegou neste checkout: o caso acima cobre a ausência
    const atividade = s.atividades_pmc.find((a) => g.pmc.atividades[a])!;
    const html = render(SegmentosPage({ searchParams: { segmento: atividade } }));
    expect(html).toContain(`data-segmento-curado="${s.slug}"`);
    semLixo(ROTA_SEGMENTOS, html);
  });

  it("método: toda fonte da gold com o link da tabela usada e a data da consulta; seção de lacunas; links válidos", () => {
    const html = render(MetodoPage());
    semLixo(ROTA_METODO, html);
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    for (const f of Object.values(g.fontes)) {
      expect(html, f.tabela).toContain(`href="${f.url.replace(/&/g, "&amp;")}"`);
      expect(texto(html), f.tabela).toContain(f.tabela);
    }
    for (const f of Object.values(e.fontes)) expect(html, f.nome).toContain(`href="${f.url}"`);
    for (const id of ["fontes", "formulas", "correspondencia", "lacunas"]) expect(html, id).toMatch(new RegExp(`<section id="${id}"`));
    for (const a of Object.values(g.pmc.atividades)) expect(texto(html), a.nome).toContain(a.nome);
    for (const h of linksInternos(html)) expect(existe(h), h).toBe(true);
  });
});

describe("arquivos CSV", () => {
  it("série do Brasil, atividades e estados: BOM, cabeçalho, uma linha por mês e recorte, ausência como campo vazio", () => {
    const meses = g.pmc.meses.length;
    const casos: [string, string, number][] = [
      ["serie-brasil", csvSerieBrasil(g), 2 * meses],
      ["atividades", csvAtividades(g), Object.keys(g.pmc.atividades).length * meses],
      ["ufs", csvUfs(g), Object.keys(g.pmc.ufs).length * 2 * meses],
    ];
    for (const [nome, csv, linhas] of casos) {
      expect(csv.charCodeAt(0), nome).toBe(0xfeff);
      const l = csv.trimEnd().split("\n");
      expect(l.length - 1, nome).toBe(linhas);
      const colunas = l[0].split(";").length;
      expect(colunas, nome).toBeGreaterThan(10);
      expect(csv, nome).not.toMatch(/undefined|NaN|null/);
      expect(l[1].split(";").length, nome).toBe(colunas);
    }
    // valor ausente na gold sai vazio no arquivo, nunca zero
    const c = structuredClone(g);
    c.pmc.brasil.restrito.volume.mm[0] = null;
    const linha = csvSerieBrasil(c).split("\n")[1].split(";");
    expect(linha[4]).toBe("");
  });
});
