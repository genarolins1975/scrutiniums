import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CORTES_FOCOS_AREA, densidadePorUf, lerAreasUf, lerQueimadas, lerQueimadasMunicipios, municipiosDeFocos, municipiosParaMetade, NOME_UF, recorte } from "@/lib/territorio/queimadas";
import { portas } from "@/lib/perguntas/portas";
import { donoDaRota } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { cartoesTerritorio, escalaTerritorio } from "@/lib/observatorios/entradas/territorio";

const caminho = vi.hoisted(() => ({ atual: "/territorio/queimadas" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("queimadas do Território e Clima", () => {
  const g = lerQueimadas();

  it("série anual contínua desde 2003, só o satélite de referência e um único ano parcial", () => {
    expect(g.sateliteReferencia.id).toBe("AQUA_M-T");
    const anos = g.anual.map((a) => a.ano);
    expect(anos[0]).toBe(2003);
    anos.forEach((a, i) => i > 0 && expect(a - anos[i - 1]).toBe(1));
    expect(g.anual.filter((a) => a.parcial)).toHaveLength(1);
    for (const a of g.anual.filter((x) => !x.parcial)) expect(a.focos, String(a.ano)).toBeGreaterThan(0);
  });

  it("estados e biomas somam o total de cada recorte, e a comparação usa os mesmos recortes", () => {
    for (const r of g.recortes.filter((x) => x.focos !== null)) {
      expect(r.porUF!.reduce((s, x) => s + x.focos, 0), r.rotulo).toBe(r.focos);
      expect(r.porBioma!.reduce((s, x) => s + x.focos, 0), r.rotulo).toBe(r.focos);
    }
    const c = g.comparacao!;
    expect(c.focosAtual).toBe(recorte(g, "acumuladoAnoCorrente")!.focos);
    expect(c.focosAnterior).toBe(recorte(g, "mesmoPeriodoAnoAnterior")!.focos);
    expect(c.periodoAtual.inicio.slice(5)).toBe(c.periodoAnterior.inicio.slice(5));
    expect(c.periodoAtual.fim.slice(5)).toBe(c.periodoAnterior.fim.slice(5));
  });

  it("mês sem arquivo na fonte aparece como ausente, nunca como zero, e todo original tem sha256", () => {
    for (const meses of Object.values(g.mensal)) for (const m of meses ?? []) {
      if (m.motivo) expect(m.focos, m.mes).toBeNull();
    }
    for (const [url, o] of Object.entries(g.originais)) expect(o.sha256, url).toMatch(/^[0-9a-f]{64}$/);
    expect(g.areaQueimada?.maturidade).toMatch(/Provisório/);
  });

  // a coleção "fogo" chama-se Fogo e desastres desde a fusão decidida pelo dono em 10/11/2026
  it("o painel é fechado, pertence à coleção Fogo e desastres e diz junto ao número que foco não é incêndio", () => {
    expect(ehRotaPublica("/territorio/queimadas")).toBe(false);
    expect(donoDaRota("/territorio/queimadas")).toMatchObject({ observatorio: "territorio-e-clima", colecao: "fogo", origem: null });
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "queimadas", "page.tsx"), "utf-8");
    expect(fonte).toContain("Foco de calor não é incêndio nem área queimada");
    expect(existsSync(join(process.cwd(), "src", "app", "territorio", "layout.tsx"))).toBe(true);
  });

  it("a entrada do observatório lê os focos da gold e não anuncia mais queimadas como lacuna", () => {
    const focos = escalaTerritorio().find((x) => x.href === "/territorio/queimadas");
    expect(focos?.valor).not.toBeNull();
    expect(cartoesTerritorio().map((c) => c.href)).toContain("/territorio/queimadas");
    const entrada = readFileSync(join(process.cwd(), "src", "app", "territorio", "page.tsx"), "utf-8");
    expect(entrada).not.toMatch(/queimadas e desastres da Defesa Civil ainda não/);
  });

  it("focos por município: códigos IBGE únicos, cada período reconcilia com o recorte e a área vem do Censo 2022", () => {
    const gm = lerQueimadasMunicipios()!;
    expect(gm).not.toBeNull();
    // lista atual do IBGE (5.571, com Boa Esperança do Norte, instalado depois do Censo 2022)
    expect(gm.municipiosIbge).toBe(5571);
    expect(gm.semCoberturaNaFonte.ids).toContain("5101837");
    const lista = municipiosDeFocos(gm);
    expect(new Set(lista.map((m) => m.id)).size).toBe(lista.length);
    for (const m of lista) expect(m.id, m.nome).toMatch(/^\d{7}$/);
    for (const p of ["ultimoAnoCompleto", "acumuladoAnoCorrente", "mesmoPeriodoAnoAnterior"] as const) {
      const per = gm.periodos[p];
      if (!per) continue;
      const soma = lista.reduce((s, m) => s + (m.focos[p] ?? 0), 0) + gm.semMunicipio[p]!.focos;
      expect(soma, p).toBe(per.focos);
      expect(per.focos, p).toBe(recorte(g, p)!.focos);
    }
    expect(gm.fonteArea.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(gm.fonteArea.fonte).toMatch(/Censo Demográfico 2022/);
  });

  it("o painel mostra os municípios com densidade por área e a página aberta não anuncia mais focos por município como lacuna", () => {
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "queimadas", "page.tsx"), "utf-8");
    expect(fonte).toContain("Mais focos por área em");
    expect(fonte).toContain("<FocosNoMunicipio");
    const busca = readFileSync(join(process.cwd(), "src", "components", "territorio", "FocosNoMunicipio.tsx"), "utf-8");
    expect(busca).toContain("semCoberturaNaFonte");
    const porta = portas().find((p) => p.id === "territorio-e-clima")!;
    expect(porta.lacunas.join(" ")).not.toMatch(/Focos de calor por município/);
    expect(porta.lacunas.join(" ")).toMatch(/Área queimada por estado/);
  });

  it("metade dos focos: menor número de municípios que, do maior para o menor, soma ao menos metade do total", () => {
    const m = (id: string, f: number) => ({ id, nome: id, uf: "PA", areaKm2: 1, porMilKm2: f, focos: { ultimoAnoCompleto: f, acumuladoAnoCorrente: null, mesmoPeriodoAnoAnterior: null } });
    expect(municipiosParaMetade([m("a", 1), m("b", 6), m("c", 3)], 10)).toBe(1);
    expect(municipiosParaMetade([m("a", 4), m("b", 3), m("c", 3)], 10)).toBe(2);
    expect(municipiosParaMetade([], 0)).toBeNull();
  });

  it("mapa por área: a densidade de cada UF é focos ÷ área somada dos municípios do Censo 2022 × 1.000, e as UFs somam o recorte", () => {
    const ref = JSON.parse(readFileSync(join(process.cwd(), "pipeline", "territorio", "referencia", "municipios_ibge_2022.json"), "utf-8")) as { campos: string[]; linhas: (string | number | null)[][] };
    const [iUf, iArea] = [ref.campos.indexOf("uf"), ref.campos.indexOf("areaKm2")];
    const soma: Record<string, number> = {};
    for (const l of ref.linhas) if (typeof l[iArea] === "number") soma[l[iUf] as string] = (soma[l[iUf] as string] ?? 0) + (l[iArea] as number);
    const d = densidadePorUf(g, "ultimoAnoCompleto")!;
    expect(d.itens).toHaveLength(Object.keys(NOME_UF).length);
    for (const u of d.itens) {
      expect(u.areaKm2, u.uf).toBeCloseTo(soma[u.uf], 6);
      expect(u.porMilKm2, u.uf).toBeCloseTo((1000 * u.focos) / soma[u.uf], 9);
      expect(Number.isFinite(u.porMilKm2), u.uf).toBe(true);
    }
    // soma das UFs igual ao total do recorte, salvo os focos sem UF, declarados à parte
    expect(d.itens.reduce((s, u) => s + u.focos, 0) + d.semUf).toBe(d.recorte.focos);
    // ordenado da maior densidade para a menor
    d.itens.forEach((u, i) => i > 0 && expect(u.porMilKm2).toBeLessThanOrEqual(d.itens[i - 1].porMilKm2));
    // o município sem área na referência é o mesmo que a gold municipal declara sem cobertura (sem dado, nunca zero)
    expect(lerAreasUf().semArea.map((m) => m.id)).toEqual(lerQueimadasMunicipios()!.semCoberturaNaFonte.ids);
    expect([...CORTES_FOCOS_AREA]).toEqual([...CORTES_FOCOS_AREA].sort((a, b) => a - b));
  });

  it("o HTML do painel traz o mapa, a lista única de municípios com as duas tabelas e nenhum NaN, undefined ou data ISO", async () => {
    const { default: Pagina } = await import("@/app/territorio/queimadas/page");
    const html = renderToStaticMarkup(createElement(Pagina as never));
    expect(html).toContain('id="mapa-por-area"');
    expect(html).toContain('data-grafico="mapa"');
    // as duas listas viraram uma figura com alternância; as duas tabelas equivalentes seguem no HTML
    expect(html).not.toContain('id="municipios-area"-titulo');
    expect((html.match(/data-figura-analitica="municipios"/g) ?? []).length).toBe(1);
    expect(html).toContain("Os 15 municípios com mais focos de calor em ");
    expect(html).toContain("Os 15 municípios com mais focos de calor por 1.000 km² em ");
    expect(html).toContain("data-alternar-vista");
    // a gold municipal não vai no HTML (o mapa municipal e a busca a baixam só sob pedido)
    expect(html).not.toMatch(/"focos_ultimoAnoCompleto"/);
    const texto = html.replace(/<[^>]+>/g, " ");
    expect(texto).not.toMatch(/\bNaN\b|\bundefined\b/);
    expect(texto).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
  }, 60_000);
});
