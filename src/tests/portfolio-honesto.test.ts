import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { ATALHOS, OBSERVATORIOS, donoDaRota, paineis } from "@/lib/observatorios/registro";
import { diretorioDoMapa, retratoDoPortfolio } from "@/lib/observatorios/mapaConta";
import { inventario } from "@/lib/observatorios/inventario";
import { portas } from "@/lib/perguntas/portas";
import { colecoesDaPorta } from "@/lib/perguntas/colecoesDaPorta";
import { vitrines } from "@/lib/vitrine";
import { HeroPerguntas } from "@/components/home/HeroPerguntas";
import { SecaoObservatorios } from "@/components/home/SecaoObservatorios";
import { PaginaPorta } from "@/components/perguntas/PaginaPorta";

/**
 * Portfólio honesto (recomendação 6 do parecer estrutural): a home e a página aberta de cada observatório mostram, antes de o
 * leitor entrar, quantas coleções e páginas cada observatório tem e em que estado cada coleção está. Invariantes, sem texto
 * literal:
 *
 * 1. a contagem exibida de cada observatório é a do registro (`paineis()`, sem as cópias integrais), e a de cada coleção é a do
 *    mapa da área logada (`diretorioDoMapa`);
 * 2. nenhuma contagem é escrita à mão nos componentes: o número sai de `retratoDoPortfolio`;
 * 3. coleção que não é "publicado" em tudo exibe o selo (`SeloProntidao`, `data-prontidao`), e coleção plena não exibe.
 */

// a página da porta resolve a trilha pelo endereço
const navegador = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => navegador.caminho,
}));

const retratos = retratoDoPortfolio();
const registro = paineis();
const proprias = (id: string) => registro.filter((p) => p.observatorio === id && !p.duplicataDe).length;
const atalhosDe = (id: string) => new Set(ATALHOS.filter((a) => a.observatorio === id).map((a) => donoDaRota(a.rota)?.rota ?? a.rota)).size;

/** Elementos com o atributo dado: a etiqueta de abertura e o conteúdo até o fechamento do mesmo nome, sem aninhamento do mesmo tipo. */
function marcados(html: string, atributo: string): { id: string; abertura: string; corpo: string }[] {
  const re = new RegExp(`<(span|p)\\b([^>]*\\b${atributo}="([^"]*)"[^>]*)>`, "g");
  return [...html.matchAll(re)].map((m) => {
    const inicio = m.index + m[0].length;
    let nivel = 1;
    let i = inicio;
    const tag = new RegExp(`<(/?)${m[1]}\\b[^>]*>`, "g");
    tag.lastIndex = inicio;
    for (let t = tag.exec(html); t; t = tag.exec(html)) {
      nivel += t[1] ? -1 : 1;
      i = t.index;
      if (nivel === 0) break;
    }
    return { id: m[3], abertura: m[2], corpo: html.slice(inicio, i) };
  });
}
const dado = (abertura: string, nome: string) => Number(abertura.match(new RegExp(`\\bdata-${nome}="(\\d+)"`))?.[1] ?? NaN);
const texto = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
/** Os inteiros que o leitor lê no trecho, na ordem. */
const inteiros = (html: string) => [...texto(html).matchAll(/\d[\d.]*/g)].map((m) => Number(m[0].replace(/\./g, "")));
const selos = (html: string) => [...html.matchAll(/data-prontidao="([a-z]+)"/g)].map((m) => m[1]);

describe("o retrato sai do registro e do inventário", () => {
  it("um retrato por observatório, na ordem do registro, com todas as coleções", () => {
    expect(retratos.map((r) => r.id)).toEqual(OBSERVATORIOS.map((o) => o.id));
    for (const o of OBSERVATORIOS) {
      const r = retratos.find((x) => x.id === o.id)!;
      expect(r.colecoes.map((c) => c.id), o.id).toEqual(o.colecoes.map((c) => c.id));
    }
  });

  it("as páginas próprias são os painéis do registro sem cópia integral; as de outros, os atalhos registrados", () => {
    for (const r of retratos) {
      expect(r.proprias, r.id).toBe(proprias(r.id));
      expect(r.proprias, r.id).toBeGreaterThan(0);
      expect(r.deOutros, r.id).toBe(atalhosDe(r.id));
      // nenhuma página some nem conta duas vezes: próprias e de outros fecham com as contagens das coleções
      expect(r.colecoes.reduce((n, c) => n + c.paginas, 0), r.id).toBeGreaterThanOrEqual(r.proprias + r.deOutros);
    }
    // o total do registro, sem as cópias, está distribuído entre os seis
    expect(retratos.reduce((n, r) => n + r.proprias, 0)).toBe(registro.filter((p) => !p.duplicataDe).length);
  });

  it("a contagem e o selo de cada coleção são os do mapa da área logada", () => {
    const mapa = diretorioDoMapa(new Date("2026-11-10T12:00:00Z")).secoes;
    const inv = inventario();
    for (const r of retratos) {
      const secao = mapa.find((s) => s.id === r.id)!;
      const io = inv.find((o) => o.id === r.id)!;
      for (const c of r.colecoes) {
        const linha = secao.colecoes.find((l) => l.id === c.id)!;
        const paginas = io.colecoes.find((x) => x.id === c.id)!.paginas;
        expect(c.paginas, `${r.id}/${c.id}`).toBe(linha.contagem);
        expect(c.ressalvas.find((x) => x.paginas === null)?.valor ?? null, `${r.id}/${c.id}`).toBe(linha.prontidao);
        // plena: todas as páginas "publicado", nada previsto e sem selo no mapa; só então a coleção fica sem ressalva
        const plena = linha.prontidao === null && paginas.every((p) => p.situacao === "publicado");
        expect(c.ressalvas.length === 0, `${r.id}/${c.id}`).toBe(plena);
        for (const x of c.ressalvas) {
          if (x.paginas === null) continue;
          expect(x.paginas, `${r.id}/${c.id} ${x.valor}`).toBe(paginas.filter((p) => p.situacao === (x.valor === "preparacao" ? "previsto" : "parcial")).length);
        }
      }
    }
  });
});

describe("a home mostra o tamanho de cada observatório", () => {
  const cartoes = renderToStaticMarkup(createElement(HeroPerguntas, { portas: portas() }));
  const secao = renderToStaticMarkup(createElement(SecaoObservatorios, { vitrines: vitrines() }));

  it.each([["cartões das perguntas", cartoes], ["seção das coleções", secao]])("%s: os seis observatórios, cada um com a contagem do registro", (_nome, html) => {
    const vistos = marcados(html, "data-retrato-observatorio");
    expect(vistos.map((v) => v.id)).toEqual(OBSERVATORIOS.map((o) => o.id));
    for (const v of vistos) {
      const o = OBSERVATORIOS.find((x) => x.id === v.id)!;
      // o atributo e o texto que o leitor lê dizem o mesmo, e ambos são os do registro
      expect(dado(v.abertura, "colecoes"), v.id).toBe(o.colecoes.length);
      expect(dado(v.abertura, "paginas"), v.id).toBe(proprias(v.id));
      expect(inteiros(v.corpo), v.id).toEqual([o.colecoes.length, proprias(v.id)]);
      expect(texto(v.corpo), v.id).not.toMatch(/undefined|NaN/);
    }
  });

  it("na seção das coleções, toda coleção não plena aparece com o selo, e só elas", () => {
    const bloco = secao.slice(secao.indexOf('data-retrato-portfolio=""'));
    const vistas = marcados(bloco, "data-ressalvas-colecao");
    const esperadas = retratos.flatMap((r) => r.colecoes.filter((c) => c.ressalvas.length > 0));
    expect(esperadas.length).toBeGreaterThan(0);
    expect(vistas.map((v) => v.id)).toEqual(esperadas.map((c) => c.id));
    for (const c of esperadas) {
      const v = vistas.find((x) => x.id === c.id)!;
      expect(selos(v.corpo), c.id).toEqual(c.ressalvas.map((x) => x.valor));
      expect(inteiros(v.corpo), c.id).toEqual(c.ressalvas.flatMap((x) => (x.paginas === null ? [] : [x.paginas])));
    }
  });

  it("o resumo recolhido diz quantas das coleções os capítulos detalham, sem número fixo", () => {
    const total = OBSERVATORIOS.reduce((n, o) => n + o.colecoes.length, 0);
    const capitulos = (secao.match(/<article\b/g) ?? []).length;
    const resumo = secao.slice(secao.indexOf("<summary"), secao.indexOf("</summary>"));
    expect(inteiros(resumo)).toEqual([capitulos, total]);
  });
});

describe("a página aberta de cada observatório mostra o tamanho e a prontidão", () => {
  const todas = portas();
  it.each(OBSERVATORIOS.map((o) => [o.id] as const))("%s", (id) => {
    navegador.caminho = `/perguntas/${id}`;
    const o = OBSERVATORIOS.find((x) => x.id === id)!;
    const r = retratos.find((x) => x.id === id)!;
    const html = renderToStaticMarkup(
      createElement(PaginaPorta, { porta: todas.find((p) => p.id === id)!, outras: todas.filter((p) => p.id !== id), ...colecoesDaPorta(id) }),
    );
    // a frase do observatório: coleções, páginas próprias e, quando há, as de outros observatórios, as parciais e as previstas
    const frases = marcados(html, "data-retrato-observatorio");
    expect(frases).toHaveLength(1);
    expect(frases[0].id).toBe(id);
    expect(dado(frases[0].abertura, "colecoes")).toBe(o.colecoes.length);
    expect(dado(frases[0].abertura, "paginas")).toBe(proprias(id));
    expect(inteiros(frases[0].corpo)).toEqual([o.colecoes.length, proprias(id), r.deOutros, r.parciais, r.previstas].filter((n, i) => i < 2 || n > 0));
    expect(selos(frases[0].corpo)).toEqual([...(r.parciais > 0 ? ["parcial"] : []), ...(r.previstas > 0 ? ["preparacao"] : [])]);

    // cada coleção: a contagem do mapa e o selo quando não é plena; coleção plena sem selo
    const vistas = marcados(html, "data-retrato-colecao");
    expect(vistas.map((v) => v.id)).toEqual(o.colecoes.map((c) => c.id));
    for (const c of r.colecoes) {
      const v = vistas.find((x) => x.id === c.id)!;
      expect(dado(v.abertura, "paginas"), c.id).toBe(c.paginas);
      expect(inteiros(v.corpo), c.id).toEqual([c.paginas, ...c.ressalvas.flatMap((x) => (x.paginas === null ? [] : [x.paginas]))]);
      expect(selos(v.corpo), c.id).toEqual(c.ressalvas.map((x) => x.valor));
    }
    expect(texto(html)).not.toMatch(/undefined|NaN/);
  });
});

describe("nenhuma contagem escrita à mão", () => {
  const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf-8");
  const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  it("os componentes do retrato não trazem quantidade de coleções, páginas ou painéis em texto", () => {
    for (const arquivo of [
      "src/components/observatorios/RetratoPortfolio.tsx",
      "src/components/home/HeroPerguntas.tsx",
      "src/components/home/SecaoObservatorios.tsx",
      "src/components/perguntas/PaginaPorta.tsx",
      "src/lib/perguntas/colecoesDaPorta.ts",
    ]) {
      const fonte = semComentarios(ler(arquivo));
      expect(fonte.match(/\b\d+\s+(?:das\s+\d+\s+)?(?:cole[çc][ãõa][oe]s?|p[áa]ginas?|pain[ée]is|painel)\b/gi) ?? [], arquivo).toEqual([]);
    }
  });

  it("quem exibe o retrato o lê de retratoDoPortfolio, e o retrato usa a regra por coleção do mapa", () => {
    for (const arquivo of ["src/components/home/HeroPerguntas.tsx", "src/components/home/SecaoObservatorios.tsx", "src/lib/perguntas/colecoesDaPorta.ts"]) {
      expect(ler(arquivo), arquivo).toContain("retratoDoPortfolio()");
    }
    const mapa = ler("src/lib/observatorios/mapaConta.ts");
    // uma só regra de contagem e selo por coleção, chamada pelo mapa e pelo retrato
    expect(mapa.match(/estadoDaColecao\(c\)/g)).toHaveLength(2);
    expect(mapa.match(/1 \+ existentes\.length/g)).toHaveLength(1);
    // o selo tem forma única
    expect(ler("src/components/observatorios/RetratoPortfolio.tsx")).toContain("<SeloProntidao");
  });
});
