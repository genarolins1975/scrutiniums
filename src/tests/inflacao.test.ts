import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

/**
 * Painel "Inflação por cidade" (autorizado pelo dono em 20/10/2026): coleção Custo de vida do Observatório das Famílias,
 * com pipeline e gold próprios (pipeline/inflacao, public/inflacao/gold/ipca.json). Confere o lugar no registro, o acesso
 * (painel com conta; consulta por cidade preparada e desligada na LEVA_2), os números contra a gold, as unidades
 * (variação percentual e pontos percentuais), as ressalvas e as entradas que citam o painel.
 */
const caminho = vi.hoisted(() => ({ atual: "/custo-de-vida" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
}));

const raiz = process.cwd();
type Gold = {
  ultimo_mes: string;
  inicio_janela: string;
  areas: { id: string; nome: string }[];
  grupos: { id: string; nome: string }[];
  ultimo: Record<string, { geral: { doze: number }; grupos: Record<string, { doze: number; peso: number }>; soma_contribuicoes_pp: number }>;
  fonte: { divulgado_em: string };
};
const gold = JSON.parse(readFileSync(join(raiz, "public", "inflacao", "gold", "ipca.json"), "utf-8")) as Gold;
const pct = (v: number) => `${v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const mesExtenso = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} de ${m.slice(0, 4)}`;
const textoDe = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");

async function painel(): Promise<string> {
  caminho.atual = "/custo-de-vida";
  const { default: Painel } = await import("@/app/custo-de-vida/page");
  return renderToStaticMarkup(createElement(Painel));
}

describe("inflação por cidade: lugar no registro e acesso", () => {
  it("painel próprio do Observatório das Famílias, na coleção Custo de vida, antes da comida", async () => {
    const { donoDaRota, observatorio } = await import("@/lib/observatorios/registro");
    const { colecoesDe } = await import("@/lib/observatorios/colecoes");
    expect(donoDaRota("/custo-de-vida")).toMatchObject({ observatorio: "familias", colecao: "custo-de-vida", origem: null, titulo: "Inflação por cidade" });
    expect(donoDaRota("/custo-de-vida/na-minha-cidade")?.rota).toBe("/custo-de-vida");
    expect(observatorio("familias").colecoes.find((c) => c.id === "custo-de-vida")?.href).toBe("/custo-de-vida");
    // o mapa do observatório: o painel novo abre a coleção, e a comida item por item continua nela, no painel canônico
    const hrefs = colecoesDe("familias").find((c) => c.id === "custo-de-vida")!.paineis.map((p) => p.href);
    expect(hrefs[0]).toBe("/custo-de-vida");
    expect(hrefs).toContain("/agronegocio/prato");
    expect(hrefs).not.toContain("/custo-de-vida/na-minha-cidade");
  });

  it("o painel, a consulta (enquanto não aprovada), a gold e os arquivos ficam com conta", async () => {
    const { ehRotaPublica, LEVA_2, leva2Aprovada } = await import("@/lib/rotasPublicas");
    for (const r of ["/custo-de-vida", "/custo-de-vida/", "/inflacao/gold/ipca.json", "/inflacao/series/ipca-geral-e-grupos-mensal.csv", "/inflacao/series/ipca-subitens-12-meses.csv"]) {
      expect(ehRotaPublica(r), r).toBe(false);
    }
    const item = LEVA_2.find((i) => i.id === "quanto-subiu-o-custo-de-vida")!;
    expect(item.aprovadaEm).toBeNull();
    expect(item.pergunta).toBe("Quanto subiu o custo de vida na minha cidade?");
    expect(ehRotaPublica("/custo-de-vida/na-minha-cidade")).toBe(leva2Aprovada("quanto-subiu-o-custo-de-vida"));
  });

  it("o cabeçalho é o comum, com as Famílias marcadas e a fonte de frescor do IPCA", () => {
    // Iniciativa 2: as duas páginas montam a barra comum e a navegação da coleção, sem cabeçalho próprio
    for (const f of ["page.tsx", "na-minha-cidade/page.tsx"]) {
      const cab = readFileSync(join(raiz, "src", "app", "custo-de-vida", f), "utf-8");
      expect(cab, f).toContain('<CabecalhoPlataforma observatorio="familias" destinoConta="/custo-de-vida" fontes={["inflacao"]} />');
      expect(cab, f).toContain('<NavegacaoColecao colecao="custo-de-vida" />');
    }
    const layout = readFileSync(join(raiz, "src", "app", "custo-de-vida", "layout.tsx"), "utf-8");
    expect(layout).toContain("<ParaIrAlem mapa={mapaParaIrAlem()} />");
  });

  it("as duas páginas registram a visita em seções da allowlist", async () => {
    const { isViewSection, SECTION_LABELS } = await import("@/lib/telemetry");
    const { PAGINAS_INFLACAO } = await import("@/lib/inflacao/paginas");
    for (const p of PAGINAS_INFLACAO) {
      expect(isViewSection(p.secao), p.secao).toBe(true);
      expect(SECTION_LABELS[p.secao as keyof typeof SECTION_LABELS]).toMatch(/^Custo de vida · /);
    }
  });

  it("domínio de frescor próprio, lido na entrada das Famílias", async () => {
    const limiares = JSON.parse(readFileSync(join(raiz, "src", "lib", "frescor", "limiares.json"), "utf-8"));
    const d = Object.values(limiares).find((x) => typeof x === "object" && x !== null && "inflacao" in x) as Record<string, { cadencia: string; publicacao: { arquivo: string }[] }>;
    expect(d.inflacao.cadencia).toBe("mensal");
    expect(d.inflacao.publicacao[0].arquivo).toBe("public/inflacao/gold/ipca.json");
    const { FRESCOR_DOS_OBSERVATORIOS } = await import("@/lib/frescor/entradas");
    expect(FRESCOR_DOS_OBSERVATORIOS.familias).toContain("inflacao");
  });
});

describe("inflação por cidade: o painel", () => {
  it("primeira tela com a pergunta, o seletor, o Brasil em 12 meses com mês e fonte e os nove grupos com peso", async () => {
    const html = await painel();
    const br = gold.ultimo["1"];
    expect(html).toContain("Quanto subiu o custo de vida na minha cidade?");
    expect(html).toContain("Sua cidade ou região");
    expect(html).toContain(`Inflação em 12 meses: Brasil, até ${mesExtenso(gold.ultimo_mes)}`);
    expect(html).toContain(pct(br.geral.doze));
    expect(html).toContain("IBGE, IPCA, tabela 7060 do SIDRA");
    for (const g of gold.grupos) {
      expect(html, g.nome).toContain(g.nome);
      expect(html, g.nome).toContain(`${pct(br.grupos[g.id].peso)} do orçamento`);
    }
    // as 16 áreas e o Brasil no seletor
    for (const a of gold.areas) expect(html, a.nome).toContain(a.nome);
    expect(gold.areas).toHaveLength(17);
  });

  it("seções na ordem da pergunta, com o método recolhido no fim", async () => {
    const html = await painel();
    // molde único de entrada (Iniciativa 4, 22/10/2026): a consulta, o modelo didático, as seções recolhidas e o método no
    // <details> único do molde; a ordem pelas âncoras, porque os títulos também aparecem nos caminhos por pergunta
    const ordem = ["Inflação em 12 meses: Brasil", 'id="como-pesa"', 'id="serie"', 'id="areas"', 'id="itens"', 'data-fatia="metodo"'].map((t) => html.indexOf(t));
    expect(ordem.every((p) => p > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    for (const t of ["Como o IPCA pesa o seu orçamento", "A inflação mês a mês desde 2020", "As 16 áreas lado a lado", "Os produtos e serviços que mais subiram e mais caíram", "Método e fontes"]) expect(html).toContain(t);
    expect(html).toMatch(/<details[^>]*data-fatia="metodo"/);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
  });

  it("o artefato explica a conta dos pesos, o universo do IPCA e a diferença para o custo de uma família", async () => {
    const texto = textoDe(await painel());
    expect(texto).toContain("famílias com renda de 1 a 40 salários mínimos");
    expect(texto).toContain("não o custo de vida de uma família específica");
    expect(texto).toContain("Modelo didático");
    expect(texto).toContain("Não é uma medida oficial");
    // a soma das nove contribuições aparece em pontos percentuais, ao lado do índice publicado
    const soma = gold.ultimo["1"].soma_contribuicoes_pp;
    expect(texto).toContain(`${pct(soma).replace("%", "")} p.p.`);
    expect(texto).toContain(`publicada pelo IBGE: ${pct(gold.ultimo["1"].geral.doze)}`);
    expect(texto).not.toMatch(/p\.p\.\s*\./);
  });

  it("variação em %, diferença e contribuição em pontos percentuais, nunca em %", async () => {
    const texto = textoDe(await painel());
    expect(texto).toContain("Diferença para o Brasil");
    expect(texto).toMatch(/[+−]?\d+,\d{2} p\.p\./);
    // a diferença entre área e Brasil nunca aparece como "%" na tabela das áreas
    const linhas = [...(await painel()).matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].map((m) => textoDe(m[1]));
    const sp = linhas.find((l) => l.includes("São Paulo (SP)"))!;
    expect(sp).toMatch(/p\.p\./);
    expect(linhas.filter((l) => /\((AC|AL|BA|CE|DF|ES|GO|MA|MG|MS|PA|PE|PR|RJ|RS|SE|SP)\)/.test(l))).toHaveLength(16);
  });

  it("a comida item por item fica no painel canônico, citado com link e selo de conta", async () => {
    const html = await painel();
    expect(html).toContain('href="/agronegocio/prato"');
    expect(html).toContain("Comida no prato");
  });

  it("downloads com conta: as duas séries do painel", async () => {
    const html = await painel();
    for (const s of ["ipca-geral-e-grupos-mensal", "ipca-subitens-12-meses"]) expect(html).toContain(`/inflacao/series/${s}.csv`);
  });

  it("textos sem travessão nem hífen como pontuação", async () => {
    const pastas = [
      join(raiz, "src", "app", "custo-de-vida"),
      join(raiz, "src", "app", "custo-de-vida", "na-minha-cidade"),
      join(raiz, "src", "components", "inflacao"),
      join(raiz, "src", "lib", "inflacao"),
    ];
    for (const pasta of pastas) {
      for (const f of readdirSync(pasta).filter((x) => /\.tsx?$/.test(x))) expect(readFileSync(join(pasta, f), "utf-8"), f).not.toContain("—");
    }
    caminho.atual = "/custo-de-vida/na-minha-cidade";
    const { default: Consulta } = await import("@/app/custo-de-vida/na-minha-cidade/page");
    for (const html of [await painel(), renderToStaticMarkup(createElement(Consulta))]) {
      const texto = textoDe(html);
      expect(texto).not.toContain("—");
      expect(texto).not.toMatch(/\s-\s/);
    }
  });
});

describe("inflação por cidade: quem cita o painel", () => {
  it("camada aberta e home: o número da gold abre a porta das Famílias, o caminho leva ao painel e a lacuna saiu", async () => {
    const { portas } = await import("@/lib/perguntas/portas");
    const familias = portas().find((p) => p.id === "familias")!;
    expect(familias.numeros[0].href).toBe("/custo-de-vida");
    expect(familias.numeros[0].valor).toBe(pct(gold.ultimo["1"].geral.doze).replace("%", ""));
    expect(familias.numeros[0].periodo).toContain(gold.ultimo_mes.slice(0, 4));
    expect(familias.caminhos.find((c) => c.href === "/custo-de-vida")?.colecao).toBe("Custo de vida");
    expect(familias.lacunas.join(" ")).not.toMatch(/Inflação de todos os itens/);
    // a comida continua a um clique, no painel canônico
    expect(familias.caminhos.map((c) => c.href)).toContain("/agronegocio/prato");
  });

  it("entrada das Famílias: número de escala, elo do orçamento e Para você", async () => {
    const { escalaFamilias, orcamentoFamilia } = await import("@/lib/observatorios/entradas/familias");
    expect(escalaFamilias().map((n) => n.href)).toContain("/custo-de-vida");
    expect(orcamentoFamilia().flatMap((e) => e.elos.map((l) => l.href))).toContain("/custo-de-vida");
    const { PARA_VOCE, paraVoce } = await import("@/lib/observatorios/paraVoce");
    expect(PARA_VOCE["/observatorios/familias"][0]).toBe("custo-de-vida");
    const p = paraVoce("/observatorios/familias").find((x) => x.id === "custo-de-vida")!;
    expect(p.href).toBe("/custo-de-vida");
    expect(p.numero?.origem).toBe("/custo-de-vida");
    expect(p.numero?.valor).toBe(pct(gold.ultimo["1"].geral.doze).replace("%", ""));
  });
});
