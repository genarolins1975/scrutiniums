import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Comparador, type ComparadorProps, type ContextoComparador } from "@/components/energia/Comparador";
import { alternarSelecao, buscarEntidades } from "@/lib/energia/tabela";

/**
 * Comparador de até quatro entidades. O que este teste protege:
 *
 *  1. o limite de quatro vale em todo caminho (escolha, link, prop), sem
 *     apagar a seleção existente quando alguém tenta a quinta;
 *  2. a busca ignora acento e caixa e põe primeiro quem começa com o termo;
 *  3. o combobox chega do servidor com a estrutura ARIA completa (listbox
 *     existente para aria-controls, fichas com botão de remover nomeado,
 *     contagem "n de 4" ligada ao campo);
 *  4. um link com códigos desconhecidos abre só com os válidos; a seleção
 *     controlada pelo pai vence a URL;
 *  5. os pequenos múltiplos recebem UM domínio calculado sobre todas as
 *     selecionadas (mesma escala), e só sobre elas.
 */

const SUBMERCADOS = [
  { id: "SE", rotulo: "Sudeste/Centro-Oeste", sinonimos: ["SE/CO"] },
  { id: "S", rotulo: "Sul" },
  { id: "NE", rotulo: "Nordeste" },
  { id: "N", rotulo: "Norte" },
  { id: "SIN", rotulo: "Sistema Interligado Nacional" },
];

describe("seleção e busca (lógica pura)", () => {
  it("liga, desliga e respeita o limite sem perder a seleção", () => {
    expect(alternarSelecao(["N"], "S", 4)).toEqual({ ids: ["N", "S"], motivo: "entrou" });
    expect(alternarSelecao(["N", "S"], "N", 4)).toEqual({ ids: ["S"], motivo: "saiu" });
    const cheio = ["SE", "S", "NE", "N"];
    const r = alternarSelecao(cheio, "SIN", 4);
    expect(r).toEqual({ ids: cheio, motivo: "limite" });
    expect(r.ids).not.toBe(cheio);
    // no limite, remover continua possível
    expect(alternarSelecao(cheio, "S", 4).ids).toEqual(["SE", "NE", "N"]);
  });

  it("busca sem acento e caixa; quem começa com o termo vem antes; empates na ordem recebida", () => {
    const ents = [
      { id: "1", rotulo: "Energisa Sul-Sudeste" },
      { id: "2", rotulo: "Sulgipe" },
      { id: "3", rotulo: "CEEE Sul" },
      { id: "4", rotulo: "São João Energia", detalhe: "SP" },
      { id: "5", rotulo: "Norte Luz", sinonimos: ["Amazonas"] },
    ];
    expect(buscarEntidades(ents, "SUL").itens.map((e) => e.id)).toEqual(["2", "1", "3"]);
    expect(buscarEntidades(ents, "sao joao").itens.map((e) => e.id)).toEqual(["4"]);
    expect(buscarEntidades(ents, "energia sp").itens.map((e) => e.id)).toEqual(["4"]);
    expect(buscarEntidades(ents, "amazonas").itens.map((e) => e.id)).toEqual(["5"]);
    expect(buscarEntidades(ents, "zzz")).toEqual({ itens: [], total: 0 });
  });

  it("lista longa: devolve no máximo o limite e informa o total", () => {
    const muitas = Array.from({ length: 300 }, (_, i) => ({ id: `d${i}`, rotulo: `Distribuidora ${i}` }));
    const r = buscarEntidades(muitas, "distrib", 50);
    expect(r.itens).toHaveLength(50);
    expect(r.total).toBe(300);
  });
});

const html = (p: Partial<ComparadorProps> = {}) =>
  renderToStaticMarkup(createElement(Comparador, { rotulo: "Submercados para comparar", entidades: SUBMERCADOS, ...p }));
const texto = (h: string) => h.replace(/<[^>]+>/g, "");
const fichas = (h: string) => Array.from(h.matchAll(/aria-label="Remover ([^"]+) da comparação"/g)).map((m) => m[1]);

describe("Comparador no servidor", () => {
  it("combobox com listbox existente, rótulo e contagem ligados ao campo", () => {
    const h = html();
    const campo = h.match(/<input[^>]*role="combobox"[^>]*>/)?.[0] ?? "";
    expect(campo).toContain('aria-autocomplete="list"');
    expect(campo).toContain('aria-expanded="false"');
    const controla = campo.match(/aria-controls="([^"]+)"/)?.[1];
    const descrito = campo.match(/aria-describedby="([^"]+)"/)?.[1];
    const id = campo.match(/ id="([^"]+)"/)?.[1];
    expect(h).toMatch(new RegExp(`<ul id="${controla}" role="listbox" aria-label="Submercados para comparar" aria-multiselectable="true" hidden=""`));
    expect(h).toContain(`<label for="${id}"`);
    expect(texto(h.match(new RegExp(`<p id="${descrito}"[\\s\\S]*?</p>`))?.[0] ?? "")).toContain("0 de 4 selecionadas");
    expect(texto(h)).toContain("Nada selecionado. Escolha até 4 para comparar.");
  });

  it("padrão vira fichas removíveis com nome acessível, na ordem de escolha", () => {
    const h = html({ padrao: ["NE", "SE", "XX"] });
    expect(fichas(h)).toEqual(["Nordeste", "Sudeste/Centro-Oeste"]);
    expect(texto(h)).toContain("2 de 4 selecionadas");
    expect(Array.from(h.matchAll(/<button type="button" aria-label="Remover[^"]*" class="[^"]*min-h-\[44px\] min-w-\[44px\]/g))).toHaveLength(2);
  });

  it("limite nunca passa de 4, mesmo pedido maior; no limite o aviso aparece", () => {
    const h = html({ max: 9, padrao: ["SE", "S", "NE", "N", "SIN"] });
    expect(fichas(h)).toHaveLength(4);
    expect(texto(h)).toContain("4 de 4 selecionadas. Limite atingido: remova uma para escolher outra.");
    expect(texto(html({ max: 2 }))).toContain("0 de 2");
  });

  it("link: códigos desconhecidos e repetidos saem, o excesso é cortado, ?modo= é ignorado", () => {
    const h = html({ chaveUrl: "ent", buscaInicial: "?modo=analisar&ent=N,XX,SE,N,S,NE,SIN" });
    expect(fichas(h)).toEqual(["Norte", "Sudeste/Centro-Oeste", "Sul", "Nordeste"]);
    // sem nenhum código válido, vale o padrão
    expect(fichas(html({ chaveUrl: "ent", padrao: ["S"], buscaInicial: "?ent=XX" }))).toEqual(["Sul"]);
    // lista vazia explícita no link
    expect(fichas(html({ chaveUrl: "ent", padrao: ["S"], buscaInicial: "?ent=" }))).toEqual([]);
  });

  it("seleção controlada pelo pai vence a URL e também respeita o limite", () => {
    const h = html({ chaveUrl: "ent", buscaInicial: "?ent=N", selecionadas: ["S", "S", "SE", "NE", "N", "SIN"] });
    expect(fichas(h)).toEqual(["Sul", "Sudeste/Centro-Oeste", "Nordeste", "Norte"]);
  });

  it("pequenos múltiplos: um domínio para todas as selecionadas, e só para elas", () => {
    const series: Record<string, (number | null)[]> = { N: [10, null, 30], SE: [100, 250], NE: [9999] };
    const vistos: ContextoComparador[] = [];
    const h = html({
      padrao: ["N", "SE"],
      unidade: "MWmed",
      valores: (id) => series[id] ?? [],
      children: (ctx) => {
        vistos.push(ctx);
        return ctx.selecionadas.map((e) => createElement("figure", { key: e.id, "data-painel": e.id, "data-min": ctx.dominio?.min, "data-max": ctx.dominio?.max }));
      },
    });
    const paineis = Array.from(h.matchAll(/data-painel="([^"]+)" data-min="([^"]+)" data-max="([^"]+)"/g));
    expect(paineis.map((m) => m[1])).toEqual(["N", "SE"]);
    const dominios = new Set(paineis.map((m) => `${m[2]}:${m[3]}`));
    expect(dominios.size).toBe(1);
    const [min, max] = [Number(paineis[0][2]), Number(paineis[0][3])];
    expect(min).toBeLessThanOrEqual(10);
    expect(max).toBeGreaterThanOrEqual(250);
    expect(max).toBeLessThan(9999); // NE não está selecionado: não mexe na escala
    expect(texto(h)).toContain(`Mesma escala em todos os painéis: ${min} a ${max} MWmed.`);
    // a escala do contexto mapeia o domínio comum na faixa do painel
    const esc = vistos[0].escala([100, 0]);
    expect(esc?.(min)).toBe(100);
    expect(esc?.(max)).toBe(0);
  });

  it("renderizarItem: grade com um item por selecionada, na ordem de escolha", () => {
    const h = html({ padrao: ["S", "N"], renderizarItem: (e, ctx) => createElement("p", null, `${ctx.indice}:${e.id}`) });
    expect(h).toMatch(/<ul class="grid[^"]*" aria-label="Comparação: Sul, Norte">/);
    expect(Array.from(h.matchAll(/<li class="min-w-0"><p>([^<]+)<\/p><\/li>/g)).map((m) => m[1])).toEqual(["0:S", "1:N"]);
  });

  it("sem valores válidos não inventa escala (domínio nulo, sem texto de escala)", () => {
    const vistos: ContextoComparador[] = [];
    const h = html({ padrao: ["S"], valores: () => [null, undefined], children: (ctx) => (vistos.push(ctx), null) });
    expect(vistos[0].dominio).toBeNull();
    expect(vistos[0].escala([100, 0])).toBeNull();
    expect(texto(h)).not.toContain("Mesma escala");
  });
});
