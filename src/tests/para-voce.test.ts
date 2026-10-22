import { beforeEach, describe, expect, it, vi } from "vitest";

// O Next instala o AsyncLocalStorage global no servidor dele; aqui o teste faz o mesmo antes dos imports (como em energia-idioma).
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { PaginaAberta } from "@/components/acesso/PaginaAberta";
import { FRESCOR_DAS_COLECOES, FRESCOR_DOS_OBSERVATORIOS } from "@/lib/frescor/entradas";
import { observatorio, type ObservatorioId } from "@/lib/observatorios/registro";
import { PARA_VOCE, ehEntradaParaVoce, paraVoce, todasAsPerguntas, type EntradaParaVoce, type PerguntaParaVoce } from "@/lib/observatorios/paraVoce";
import { ehRotaPublica, exigeConta } from "@/lib/rotasPublicas";
import { hrefNoIdioma } from "@/lib/i18n-href";

/**
 * "Para você" em cada entrada (Onda 2 da banca de 19/10/2026; skill observatorio-layout, seção 4, item 2):
 * as duas ou três perguntas de maior valor para o cidadão sobre o próprio caso, a um clique, logo depois dos
 * números de abertura. O teste reprova:
 * - entrada de src/lib/frescor/entradas.ts sem o bloco, ou com ele fora do lugar;
 * - pergunta cujo destino não existe em src/app;
 * - número sem fonte, sem período ou lido de outra página que não o destino;
 * - link para destino fechado sem o selo "com conta" numa entrada vista sem sessão.
 */
const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
}));

// cada render lê as golds dos destinos; com a suíte inteira em paralelo, 5 s não bastam
vi.setConfig({ testTimeout: 60_000 });

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const html = (entrada: EntradaParaVoce, idioma: "pt" | "en" = "pt") => renderToStaticMarkup(createElement(ParaVoce, { entrada, idioma }));
const aberta = (entrada: EntradaParaVoce) => renderToStaticMarkup(createElement(PaginaAberta, null, createElement(ParaVoce, { entrada, idioma: "pt" })));
const emIngles = <T,>(urlPathname: string, f: () => T): T =>
  (staticGenerationAsyncStorage as unknown as { run: (store: unknown, cb: () => T) => T }).run({ urlPathname }, f);

/** Uma rota do App Router existe se houver page.tsx no caminho literal, num segmento dinâmico ou num catch-all (como em perguntas-portas). */
function rotaExiste(href: string): boolean {
  const c = href.split(/[?#]/)[0];
  if (c.startsWith("/observatorio/")) return existsSync(join(raiz, "src", "app", "observatorio", "[[...rota]]", "route.ts")); // SPA do Crédito
  const partes = c.split("/").filter(Boolean);
  const busca = (dir: string, i: number): boolean => {
    if (existsSync(join(dir, "[[...painel]]", "page.tsx"))) return true;
    if (i === partes.length) return existsSync(join(dir, "page.tsx"));
    if (existsSync(join(dir, partes[i])) && busca(join(dir, partes[i]), i + 1)) return true;
    return ["[capitulo]", "[id]"].some((d) => existsSync(join(dir, d)) && busca(join(dir, d), i + 1));
  };
  return busca(join(raiz, "src", "app"), 0);
}

/** O que o teste reprova numa pergunta; vazio quando ela está em ordem. */
function problemas(p: PerguntaParaVoce): string[] {
  const out: string[] = [];
  if (!p.pergunta.trim().endsWith("?")) out.push("pergunta sem interrogação");
  if (!p.resposta.trim()) out.push("sem resposta curta");
  if (!rotaExiste(p.href)) out.push(`destino inexistente: ${p.href}`);
  if (/—|\s-\s/.test(`${p.pergunta} ${p.resposta}`)) out.push("travessão ou hífen como pontuação");
  if (p.numero === null) {
    if (!p.semNumero?.trim()) out.push("sem número e sem o motivo");
    return out;
  }
  const n = p.numero;
  if (!n.fonte.trim()) out.push("número sem fonte");
  if (!n.periodo.trim() || !/\d{4}/.test(n.periodo)) out.push("número sem período com ano");
  if (!n.rotulo.trim()) out.push("número sem rótulo");
  if (n.valor !== null && !n.unidade.trim()) out.push("número sem unidade");
  if (n.valor !== null && /NaN|undefined|Infinity/.test(n.valor)) out.push("valor inválido");
  if (n.origem.split("#")[0] !== p.href.split("#")[0]) out.push(`número lido de ${n.origem}, não do destino ${p.href}`);
  return out;
}

/** As entradas com conta, pela lista da faixa de frescor: as coleções pela rota, os observatórios pela entrada do registro. */
const ENTRADAS = [
  ...Object.keys(FRESCOR_DAS_COLECOES),
  ...(Object.keys(FRESCOR_DOS_OBSERVATORIOS) as ObservatorioId[]).map((id) => observatorio(id).entrada as string),
];

// as golds são lidas uma vez; o teste roda junto de outros em paralelo
const TODAS = todasAsPerguntas();

describe("lista central", () => {
  it("toda entrada de src/lib/frescor/entradas.ts tem o bloco, com duas ou três perguntas distintas", () => {
    expect([...Object.keys(PARA_VOCE)].sort()).toEqual([...ENTRADAS].sort());
    for (const e of ENTRADAS) {
      expect(ehEntradaParaVoce(e), e).toBe(true);
      const ids = PARA_VOCE[e as EntradaParaVoce];
      expect(ids.length, e).toBeGreaterThanOrEqual(2);
      expect(ids.length, e).toBeLessThanOrEqual(3);
      expect(new Set(ids).size, e).toBe(ids.length);
    }
  });

  it("cada pergunta tem destino real, resposta curta e, quando há número, fonte, período e a mesma página de origem", () => {
    for (const p of TODAS) expect(problemas(p), p.id).toEqual([]);
  });

  it("os números estão publicados: nenhum cartão sai como indisponível nesta publicação", () => {
    for (const p of TODAS) if (p.numero) expect(p.numero.valor, p.id).not.toBeNull();
  });

  it("o leitor reprova o que deve reprovar", () => {
    const base = TODAS.find((p) => p.numero !== null)!;
    expect(problemas({ ...base, href: "/setor-eletrico/inexistente" }).join()).toMatch(/destino inexistente/);
    expect(problemas({ ...base, numero: { ...base.numero!, fonte: "" } })).toContain("número sem fonte");
    expect(problemas({ ...base, numero: { ...base.numero!, periodo: "" } })).toContain("número sem período com ano");
    expect(problemas({ ...base, numero: { ...base.numero!, origem: "/outra-pagina" } }).join()).toMatch(/não do destino/);
    expect(problemas({ ...base, numero: null, semNumero: undefined })).toContain("sem número e sem o motivo");
    expect(problemas({ ...base, resposta: "Tarifa — sem tributos" })).toContain("travessão ou hífen como pontuação");
  });

  it("a entrada não oferece a si mesma como destino", () => {
    for (const e of ENTRADAS) for (const p of paraVoce(e as EntradaParaVoce)) expect(p.href, e).not.toBe(e);
  });
});

describe("posição em cada entrada: logo depois dos números de abertura", () => {
  /** [arquivo, marca dos números de abertura, marca do que vem depois do bloco] */
  const PAGINAS: Record<string, [string, string, string]> = {
    "/setor-eletrico": ["src/app/setor-eletrico/page.tsx", "energia-abertura-medidas", "<PercursoVisualEnergia"],
    "/gas-natural": ["src/app/gas-natural/page.tsx", "<h1", "<SecaoGas"],
    "/saneamento": ["src/app/saneamento/page.tsx", "Brasil, em uma leitura", 'aria-labelledby="como-funciona"'],
    "/eficiencia-estatal": ["src/app/eficiencia-estatal/page.tsx", "<AtlasCidadao", "<FaixaFrescor dominios={FRESCOR_DAS_COLECOES['/eficiencia-estatal']} variante"],
    "/contas-publicas": ["src/app/contas-publicas/page.tsx", "<AberturaFederal", "<RespostasIniciais"],
    "/agronegocio": ["src/app/agronegocio/page.tsx", "<DestaquesAgro", "<PerguntasAgro"],
    "/territorio": ["src/app/territorio/page.tsx", "O tema em números", 'aria-labelledby="paineis-titulo"'],
  };

  it.each(Object.entries(PAGINAS))("%s", (rota, [arquivo, antes, depois]) => {
    const s = ler(arquivo);
    // o componente pode quebrar as props em várias linhas: procura a tag até o atributo entrada
    const uso = s.search(new RegExp(`<ParaVoce\\s+entrada="${rota.replace(/[/]/g, "\\/")}"`));
    expect(uso, `${arquivo} sem <ParaVoce entrada="${rota}">`).toBeGreaterThan(0);
    expect(s.indexOf(antes), antes).toBeGreaterThan(0);
    expect(s.indexOf(antes)).toBeLessThan(uso);
    expect(uso).toBeLessThan(s.indexOf(depois));
  });

  it("na Eficiência Estatal, o bloco vem logo depois do retrato da capital", () => {
    const a = ler("src/components/eficiencia/AtlasCidadao.tsx");
    expect(a.indexOf("{paraVoce}")).toBeGreaterThan(a.indexOf("<RetratoCapital"));
    expect(a.indexOf("{paraVoce}")).toBeLessThan(a.indexOf("<PerguntasCapital"));
  });

  it("as entradas que reúnem coleções recebem o bloco pela entrada do registro, entre os números e as coleções", () => {
    const p = ler("src/app/observatorios/[id]/page.tsx");
    expect(p).toMatch(/paraVoce=\{o\.entrada && ehEntradaParaVoce\(o\.entrada\) \? <ParaVoce entrada=\{o\.entrada\} \/> : null\}/);
    // a entrada de observatório é o molde EntradaColecao (Iniciativa 4): o bloco vem depois da escala e antes dos destinos
    expect(ler("src/components/observatorios/EntradaObservatorio.tsx")).toContain("paraVoce={paraVoce}");
    const e = ler("src/components/observatorios/EntradaColecao.tsx");
    expect(e.indexOf('data-fatia="para-voce"')).toBeGreaterThan(e.indexOf("<Escala "));
    expect(e.indexOf('data-fatia="para-voce"')).toBeLessThan(e.indexOf('data-fatia="destinos"'));
  });

  it("substitui os blocos equivalentes em vez de somar", () => {
    expect(ler("src/app/setor-eletrico/page.tsx")).not.toContain("energia-portas");
    expect(ler("src/app/contas-publicas/page.tsx")).not.toContain("<TrilhasEstado");
    const t = ler("src/app/territorio/page.tsx");
    expect(t).not.toContain('<section aria-labelledby="municipio-titulo"');
    expect(t.indexOf("<FocosNoMunicipio")).toBeGreaterThan(t.indexOf('<ParaVoce entrada="/territorio"'));
    expect(t.indexOf("<FocosNoMunicipio")).toBeLessThan(t.indexOf("</ParaVoce>"));
  });
});

describe("componente", () => {
  beforeEach(() => {
    caminho.atual = "/";
  });

  it.each(ENTRADAS)("%s: um cartão por pergunta, com o número, a fonte e o período", (e) => {
    caminho.atual = e;
    const h = html(e as EntradaParaVoce);
    expect(h).toContain(`data-para-voce="${e}"`);
    expect(h).toContain(">Para você</h2>");
    for (const p of paraVoce(e as EntradaParaVoce)) {
      expect(h).toContain(`href="${p.href}"`);
      expect(h).toContain(p.pergunta);
      if (p.numero) {
        expect(h).toContain(p.numero.valor!);
        expect(h).toContain(`${p.numero.fonte} · ${p.numero.periodo}`);
      }
    }
    expect(h).not.toMatch(/NaN|undefined|Infinity|\[object Object\]/);
  });

  it("numa página aberta (versão aperitivo, marcada por PaginaAberta), todo destino fechado leva o selo, e o aberto não", () => {
    // princípio do aperitivo (20/10/2026): a entrada da Eficiência Estatal no endereço público é o painel completo de quem
    // tem conta; a página aberta é a versão aperitivo, que se declara aberta pelo layout de src/app/aperitivo
    expect(ENTRADAS.filter((e) => ehRotaPublica(e))).toEqual(["/eficiencia-estatal"]);
    caminho.atual = "/eficiencia-estatal";
    expect(html("/eficiencia-estatal" as EntradaParaVoce)).not.toContain("data-selo-conta");
    for (const e of ENTRADAS) {
      const h = aberta(e as EntradaParaVoce);
      const cartoes = h.split("<li ").slice(1);
      const perguntas = paraVoce(e as EntradaParaVoce);
      expect(cartoes).toHaveLength(perguntas.length);
      perguntas.forEach((p, i) => {
        if (exigeConta(p.href)) expect(cartoes[i], `${e}: ${p.href} sem selo`).toContain("data-selo-conta");
        else expect(cartoes[i], `${e}: ${p.href} aberto com selo`).not.toContain("data-selo-conta");
      });
    }
    // pelo menos um destino de cada tipo, para o teste valer
    const todas = ENTRADAS.flatMap((e) => paraVoce(e as EntradaParaVoce));
    expect(todas.some((p) => exigeConta(p.href))).toBe(true);
    expect(todas.some((p) => !exigeConta(p.href))).toBe(true);
  });

  it("entrada com conta: sem selo, porque quem a vê já tem sessão", () => {
    caminho.atual = "/setor-eletrico";
    expect(html("/setor-eletrico")).not.toContain("data-selo-conta");
  });

  it("destino fechado não é pré-carregado", () => {
    const c = ler("src/components/observatorios/ParaVoce.tsx");
    expect(c).toContain("prefetch={prefetchDoLink(p.href)}");
    expect(c).toContain("<SeloComConta href={p.href} />");
  });
});

describe("Setor Elétrico em inglês", () => {
  it("o bloco da irmã inglesa sai em inglês, com os destinos ingleses e os mesmos números", () => {
    caminho.atual = "/en/setor-eletrico";
    const en = emIngles("/en/setor-eletrico", () => html("/setor-eletrico", "en"));
    caminho.atual = "/setor-eletrico";
    const pt = html("/setor-eletrico", "pt");
    expect(en).toContain(">For you</h2>");
    expect(en).toContain("See the answer");
    expect(en).not.toMatch(/Para você|Ver a resposta|Perguntas sobre o seu caso|Indisponível|vigente em|ano de|tarifas homologadas/);
    expect(pt).not.toMatch(/For you|See the answer/);
    for (const p of paraVoce("/setor-eletrico")) {
      expect(en).toContain(`href="${hrefNoIdioma(p.href, "en")}"`);
      expect(hrefNoIdioma(p.href, "en")).toMatch(/^\/en\//);
    }
    // os mesmos valores, só com a grafia do idioma (vírgula decimal no português, ponto no inglês)
    const valoresEn = emIngles("/en/setor-eletrico", () => paraVoce("/setor-eletrico", "en")).map((p) => p.numero?.valor ?? null);
    const valoresPt = paraVoce("/setor-eletrico").map((p) => p.numero?.valor ?? null);
    for (const v of valoresEn) expect(en).toContain(v!);
    expect(valoresEn.map((v) => v?.replace(/[^\d]/g, ""))).toEqual(valoresPt.map((v) => v?.replace(/[^\d]/g, "")));
  });
});
