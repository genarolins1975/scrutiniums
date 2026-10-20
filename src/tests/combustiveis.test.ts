import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Painel "Combustíveis nos postos" (aprovado pelo dono em 19/10/2026): coleção própria do Observatório de Energia e
 * Infraestrutura, gold do pipeline do Gás. Confere o lugar no registro, o acesso (painel e consulta nascem fechados), os
 * números contra a gold, a lacuna de 2020 e as entradas que citam o painel (Para você, camada aberta, home, busca).
 */
const caminho = vi.hoisted(() => ({ atual: "/combustiveis" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
}));

const raiz = process.cwd();
type Gold = {
  ultimo_mes: string;
  produtos: { id: string; nome: string }[];
  indicadores: Record<string, { valor: number; periodo: string }>;
  serie: Record<string, string | number | null>[];
  por_uf: (Record<string, unknown> & { uf: string; nome: string })[];
  pesquisa: { meses_sem_pesquisa: string[]; notas: string[] };
};
const gold = JSON.parse(readFileSync(join(raiz, "public", "gas", "gold", "combustiveis.json"), "utf-8")) as Gold;
const reais = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

describe("combustíveis: lugar no registro e acesso", () => {
  it("coleção própria no Observatório de Energia e Infraestrutura, com origem no pipeline do Gás", async () => {
    const { donoDaRota, observatorio } = await import("@/lib/observatorios/registro");
    const { colecoesDe } = await import("@/lib/observatorios/colecoes");
    const dono = donoDaRota("/combustiveis")!;
    expect(dono).toMatchObject({ observatorio: "energia-e-infraestrutura", colecao: "combustiveis", origem: "gas", titulo: "Combustíveis nos postos" });
    expect(donoDaRota("/combustiveis/no-meu-estado")?.rota).toBe("/combustiveis");
    expect(observatorio("energia-e-infraestrutura").colecoes.find((c) => c.id === "combustiveis")?.href).toBe("/combustiveis");
    // o mapa do observatório mostra o painel; a consulta só entra nas listas com a aprovação
    const colecao = colecoesDe("energia-e-infraestrutura").find((c) => c.id === "combustiveis")!;
    expect(colecao.paineis.map((p) => p.href)).toEqual(["/combustiveis"]);
  });

  it("painel e consulta nascem fechados; a gold e as séries também", async () => {
    const { ehRotaPublica } = await import("@/lib/rotasPublicas");
    for (const r of ["/combustiveis", "/combustiveis/", "/combustiveis/no-meu-estado", "/gas/gold/combustiveis.json", "/gas/series/preco-combustiveis-uf-mensal.csv"]) {
      expect(ehRotaPublica(r), r).toBe(false);
    }
  });

  it("o cabeçalho é o comum, com o observatório marcado e as fontes do domínio gas", () => {
    const cab = readFileSync(join(raiz, "src", "components", "combustiveis", "CabecalhoCombustiveis.tsx"), "utf-8");
    expect(cab).toContain('<CabecalhoPlataforma observatorio="energia-e-infraestrutura" destinoConta="/combustiveis" fontes={["gas"]} />');
    const layout = readFileSync(join(raiz, "src", "app", "combustiveis", "layout.tsx"), "utf-8");
    expect(layout).toContain("<ParaIrAlem mapa={mapaParaIrAlem()} />");
  });

  it("as duas páginas registram a visita em seções da allowlist", async () => {
    const { isViewSection, SECTION_LABELS } = await import("@/lib/telemetry");
    const { PAGINAS_COMBUSTIVEIS } = await import("@/lib/combustiveis/paginas");
    for (const p of PAGINAS_COMBUSTIVEIS) {
      expect(isViewSection(p.secao), p.secao).toBe(true);
      expect(SECTION_LABELS[p.secao as keyof typeof SECTION_LABELS]).toMatch(/^Combustíveis · /);
    }
  });
});

describe("combustíveis: o painel", () => {
  it("primeira tela com a pergunta, o seletor e o preço Brasil de cada combustível com mês, postos e fonte", async () => {
    caminho.atual = "/combustiveis";
    const { default: Painel } = await import("@/app/combustiveis/page");
    const html = renderToStaticMarkup(createElement(Painel));
    expect(html).toContain("Quanto custa encher o tanque no meu estado?");
    expect(html).toContain("Seu estado");
    expect(html).toContain("Brasil (média nacional)");
    for (const p of gold.produtos) {
      expect(html, p.id).toContain(p.nome);
      expect(html, p.id).toContain(reais(gold.indicadores[`${p.id}_medio_mes`].valor));
    }
    expect(html).toContain(`${gold.indicadores.gasolina_postos_mes.valor.toLocaleString("pt-BR")} postos pesquisados`);
    expect(html).toContain("ANP, Levantamento de Preços de Combustíveis");
    // a ordem das seções: primeira tela, mecanismo, série, estados, etanol, método recolhido no fim
    const ordem = ["Preço médio do litro: Brasil", "Como a ANP mede o preço nos postos", "O preço do litro desde 2013", "Como os estados se comparam",
      "Quanto o litro de etanol custa em relação ao de gasolina", "Método, fontes, notas da planilha e downloads"].map((t) => html.indexOf(t));
    expect(ordem.every((p) => p > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(html).toMatch(/<details class="group"><summary[^>]*><h2 id="metodo-h"/);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("a lacuna de 2020, as notas da planilha e a ausência por UF aparecem como estão", async () => {
    const { default: Painel } = await import("@/app/combustiveis/page");
    const html = renderToStaticMarkup(createElement(Painel));
    expect(gold.pesquisa.meses_sem_pesquisa).toEqual(["2020-09"]);
    expect(html).toContain("Não houve pesquisa de preços de 18/08/2020 a 17/10/2020");
    for (const n of gold.pesquisa.notas) expect(html).toContain(n.replace(/'/g, "&#x27;"));
    const semDiesel = gold.por_uf.filter((u) => u.diesel === null).map((u) => u.nome);
    for (const nome of semDiesel) expect(html).toContain(`óleo diesel em ${nome}`);
    // o 70% não é citado: a página não recomenda combustível
    expect(html).not.toMatch(/70\s?%|compensa abastecer com/);
    expect(html).toContain("não indica qual compensa abastecer");
  });

  it("downloads com conta: as três séries do painel", async () => {
    const { default: Painel } = await import("@/app/combustiveis/page");
    const html = renderToStaticMarkup(createElement(Painel));
    for (const s of ["preco-combustiveis-brasil-mensal", "preco-combustiveis-por-uf", "preco-combustiveis-uf-mensal"]) {
      expect(html).toContain(`/gas/series/${s}.csv`);
    }
  });

  it("textos sem travessão nem hífen como pontuação", async () => {
    const pastas = [join(raiz, "src", "app", "combustiveis"), join(raiz, "src", "app", "combustiveis", "no-meu-estado"), join(raiz, "src", "components", "combustiveis")];
    for (const pasta of pastas) {
      for (const f of readdirSync(pasta).filter((x) => x.endsWith(".tsx"))) expect(readFileSync(join(pasta, f), "utf-8"), f).not.toContain("—");
    }
    const { default: Painel } = await import("@/app/combustiveis/page");
    const { default: Consulta } = await import("@/app/combustiveis/no-meu-estado/page");
    for (const pagina of [Painel, Consulta]) {
      const texto = renderToStaticMarkup(createElement(pagina)).replace(/<[^>]+>/g, " ");
      expect(texto).not.toContain("—");
      expect(texto).not.toMatch(/\s-\s/);
    }
  });
});

describe("combustíveis: quem cita o painel", () => {
  it("Para você da Energia e Infraestrutura: o tanque com o número da gold do destino", async () => {
    const { PARA_VOCE, paraVoce } = await import("@/lib/observatorios/paraVoce");
    expect(PARA_VOCE["/observatorios/energia-e-infraestrutura"]).toEqual(["luz", "tanque", "municipio"]);
    const t = paraVoce("/observatorios/energia-e-infraestrutura").find((p) => p.id === "tanque")!;
    expect(t.href).toBe("/combustiveis");
    expect(t.numero?.origem).toBe("/combustiveis");
    expect(t.numero?.valor).toBe(`R$ ${gold.indicadores.gasolina_medio_mes.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`);
  });

  it("camada aberta, home e frescor", async () => {
    const { portas } = await import("@/lib/perguntas/portas");
    const energia = portas().find((p) => p.id === "energia-e-infraestrutura")!;
    expect(energia.caminhos.map((c) => c.href)).toContain("/combustiveis");
    expect(energia.caminhos.find((c) => c.href === "/combustiveis")?.colecao).toBe("Combustíveis");
    expect(energia.lacunas.join(" ")).not.toMatch(/gasolina/i);
    const { vitrines } = await import("@/lib/vitrine");
    expect(vitrines().gas.paineis.map((p) => p.href)).toContain("/combustiveis");
    const meta = JSON.parse(readFileSync(join(raiz, "public", "gas", "gold", "meta.json"), "utf-8"));
    expect(meta.ultimos_meses.combustiveis).toBe(gold.ultimo_mes);
  });
});
