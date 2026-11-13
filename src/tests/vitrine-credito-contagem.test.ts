import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRUPOS_CREDITO, INICIO_DO_PAINEL, paginasTematicasDoCredito } from "@/lib/credito/navegacao";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { paginasNaNavegacao, retratoDoPortfolio } from "@/lib/observatorios/mapaConta";
import { donoDaRota } from "@/lib/observatorios/registro";
import { PAINEIS_REDIRECIONADOS, PAINEIS_REESCRITOS, PREFIXO_APLICACAO } from "@/lib/observatorios/reescritos";
import { vitrines } from "@/lib/vitrine";

/**
 * Contagem de páginas do Crédito na vitrine da home (10/11/2026).
 *
 * A vitrine contava as abas do catálogo (src/lib/data/observatorioAbas.ts): 43, entre elas as nove vistas reescritas como
 * páginas próprias das Famílias, o "Início do painel" e as Perguntas rápidas. A contagem passa a sair da mesma fonte que o
 * "Início do painel" da aplicação usa, os grupos do Crédito (GRUPOS_CREDITO), sem número escrito à mão. O que se trava:
 * - a vitrine mostra exatamente o que a aplicação conta em renderMapa (vistas dos grupos, menos o mapa e as substituídas);
 * - as nove páginas reescritas não entram na contagem do Crédito e entram uma vez só no retrato do portfólio (home e
 *   /perguntas), na coleção dona, das Famílias; o endereço antigo não é contado em coleção alguma.
 * No navegador, src/tests/split-bundle-browser.test.ts confere o número que o "Início do painel" escreve na tela.
 */
const raiz = process.cwd();
const app = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const rotas: Record<string, string> = Object.fromEntries(Array.from(app.match(/const ROUTES = \{([\s\S]*?)\};/)![1].matchAll(/(\w+): "([^"]*)"/g)).map((x) => [x[1], x[2]]));

/** A conta de renderMapa, refeita com o que o servidor manda no índice (grupos e substituídas). */
function contagemDaAplicacao(): string[] {
  const porRota = Object.fromEntries(Object.entries(rotas).map(([v, r]) => [PREFIXO_APLICACAO + r, v]));
  const substituidas = new Set<string>();
  for (const p of PAINEIS_REDIRECIONADOS) { porRota[p.rota] = porRota[PREFIXO_APLICACAO + p.abaAntiga]; substituidas.add(porRota[p.rota]); }
  const noMenu = GRUPOS_CREDITO.flatMap((g) => g.paginas.map((h) => porRota[h]).filter(Boolean));
  return noMenu.filter((v) => v !== "mapa" && !substituidas.has(v));
}

describe("vitrine do Crédito: a contagem é a do Início do painel", () => {
  it("a aplicação conta as vistas dos grupos, menos o mapa e as substituídas, e escreve esse número no cabeçalho", () => {
    expect(app).toContain('const abas = noMenu.filter(v => v !== "mapa" && !substituta(v));');
    expect(app).toContain("${abas.length} páginas temáticas");
    expect(app).toContain("el.dataset.paginas = String(abas.length);");
    expect(rotas.mapa).toBe(INICIO_DO_PAINEL.slice(PREFIXO_APLICACAO.length));
  });

  it("a vitrine da home mostra o mesmo número, nas duas línguas, sem número escrito à mão", () => {
    const daAplicacao = contagemDaAplicacao();
    const daVitrine = paginasTematicasDoCredito();
    expect(daVitrine.map((h) => h.slice(PREFIXO_APLICACAO.length)).sort()).toEqual(daAplicacao.map((v) => rotas[v]).sort());
    expect(new Set(daVitrine).size).toBe(daVitrine.length);
    for (const idioma of ["pt", "en"] as const) {
      const v = vitrines(idioma).credito;
      expect(v.contagemIndice).toEqual({ tipo: "simples", quantidade: daAplicacao.length, unidade: "paginas_tematicas" });
      expect(v.contagem.valor).toBe(String(daAplicacao.length));
    }
    const fonte = readFileSync(join(raiz, "src/lib/vitrine.ts"), "utf-8");
    expect(fonte).toContain("const quantidade = paginasTematicasDoCredito().length;");
  });

  it("as nove reescritas saíram da contagem; o catálogo de abas, que ainda as lista para o endereço antigo, não é a fonte", () => {
    const contadas = new Set(paginasTematicasDoCredito());
    expect(PAINEIS_REDIRECIONADOS.length).toBe(9);
    for (const p of PAINEIS_REESCRITOS) {
      expect(contadas.has(PREFIXO_APLICACAO + p.abaAntiga), p.abaAntiga).toBe(false);
      expect(contadas.has(p.rota), p.rota).toBe(false);
    }
    // diferença para a contagem antiga, explicada item a item: as nove reescritas, o próprio Início e as Perguntas rápidas
    const antiga = ABAS_OBSERVATORIO.filter((a) => !a.caminho.endsWith("/") && !["/suggestions", "/about"].includes(a.caminho)).map((a) => PREFIXO_APLICACAO + a.caminho);
    const fora = antiga.filter((h) => !contadas.has(h)).sort();
    expect(fora).toEqual([...PAINEIS_REESCRITOS.map((p) => PREFIXO_APLICACAO + p.abaAntiga), INICIO_DO_PAINEL, "/observatorio/research"].sort());
    expect([...contadas].filter((h) => !antiga.includes(h))).toEqual([]);
    // toda página contada é servida pela aplicação: tem título no catálogo de abas
    for (const h of contadas) expect(ABAS_OBSERVATORIO.some((a) => PREFIXO_APLICACAO + a.caminho === h), h).toBe(true);
  });
});

describe("retrato do portfólio (home e /perguntas): cada página reescrita conta uma vez, na coleção dona", () => {
  const colecoes = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => ({ observatorio: o.id, id: c.id, paginas: paginasNaNavegacao(c.id) })));

  it("a página nova está na navegação da coleção dela, das Famílias, e em nenhuma outra", () => {
    for (const p of PAINEIS_REESCRITOS) {
      const onde = colecoes.filter((c) => c.paginas.includes(p.rota)).map((c) => `${c.observatorio}/${c.id}`);
      expect(onde, p.rota).toEqual([`familias/${p.colecao}`]);
      expect(donoDaRota(p.rota)?.observatorio, p.rota).toBe("familias");
    }
  });

  it("o endereço antigo não é contado em coleção alguma, nem nas da Economia", () => {
    for (const p of PAINEIS_REESCRITOS) {
      const antigo = PREFIXO_APLICACAO + p.abaAntiga;
      expect(colecoes.filter((c) => c.paginas.includes(antigo)).map((c) => c.id), antigo).toEqual([]);
    }
  });

  it("no retrato, as nove entram nas páginas próprias das Famílias e não nas da Economia", () => {
    const retrato = retratoDoPortfolio();
    const familias = retrato.find((r) => r.id === "familias")!;
    const economia = retrato.find((r) => r.id === "economia")!;
    const rotasDe = (id: string) => new Set(colecoes.filter((c) => c.observatorio === id).flatMap((c) => c.paginas));
    const daFamilia = rotasDe("familias"), daEconomia = rotasDe("economia");
    for (const p of PAINEIS_REESCRITOS) {
      expect(daFamilia.has(p.rota), p.rota).toBe(true);
      expect(daEconomia.has(p.rota), p.rota).toBe(false);
      expect(daEconomia.has(PREFIXO_APLICACAO + p.abaAntiga), p.abaAntiga).toBe(false);
    }
    // a contagem do retrato é por endereço distinto: nenhuma página se repete dentro do observatório
    expect(familias.proprias + familias.deOutros).toBe(daFamilia.size);
    expect(economia.proprias + economia.deOutros).toBe(daEconomia.size);
    expect(familias.proprias).toBeGreaterThanOrEqual(PAINEIS_REESCRITOS.length);
  });
});
