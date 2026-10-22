import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  LEVA_2,
  ehRotaPublica,
  ehRotaPublicaCom,
  itemAprovado,
  leva2Aprovada,
  type IdLeva2,
  type ItemLeva2,
} from "@/lib/rotasPublicas";
import { artefatosLeva2, consultasLeva2, metodosLeva2 } from "@/lib/perguntas/leva2";

/**
 * Leva 2 da estratégia "aberto e com conta" (docs/BANCA_2026-10-19.md, Onda 2): preparada e desligada.
 * Nada abre, nada é anunciado e nada entra no sitemap antes da data da aprovação do dono em LEVA_2
 * (src/lib/rotasPublicas.ts). Com a aprovação preenchida, abrem as rotas e só os arquivos exatos, nunca a pasta.
 */
const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  // a busca do município empurra a ficha pelo roteador; fora do App Router, um roteador vazio basta
  useRouter: () => ({ push: () => undefined, prefetch: () => undefined }),
}));

const raiz = process.cwd();
const DATA = "2026-11-30";
const desligada: ItemLeva2[] = LEVA_2.map((i) => ({ ...i, aprovadaEm: null }));
const ligada: ItemLeva2[] = LEVA_2.map((i) => ({ ...i, aprovadaEm: DATA }));
const so = (id: IdLeva2): ItemLeva2[] => LEVA_2.map((i) => ({ ...i, aprovadaEm: i.id === id ? DATA : null }));
/** Abertura que não depende da leva 2 (leva 1, métodos, vitrine): o que já era público antes dela. */
const semLeva2 = (c: string) => ehRotaPublicaCom([], c);

const FICHA = "/territorio/queimadas/municipio/5103254";

/** Rota do App Router: page.tsx no caminho literal ou num segmento dinâmico qualquer. */
function paginaExiste(href: string): boolean {
  const partes = href.split("/").filter(Boolean);
  const busca = (dir: string, i: number): boolean => {
    if (i === partes.length) return existsSync(join(dir, "page.tsx"));
    if (existsSync(join(dir, partes[i])) && busca(join(dir, partes[i]), i + 1)) return true;
    if (!existsSync(dir)) return false;
    return readdirSync(dir).some((d) => /^\[[^.\]]+\]$/.test(d) && busca(join(dir, d), i + 1));
  };
  return busca(join(raiz, "src", "app"), 0);
}

/** Caminhos que cada item abriria: rotas, uma ficha de exemplo e os arquivos. */
function caminhosDo(item: ItemLeva2): string[] {
  return [...item.rotas, ...item.rotas.map((r) => r + "/"), ...(item.fichasIbge ? [`${item.fichasIbge}/5103254`] : []), ...item.arquivos];
}

describe("leva 2: a lista declarativa", () => {
  it("registra as ferramentas da tabela da banca, com pergunta, forma, porta, rotas e arquivos exatos", () => {
    // as quatro da Onda 2, a consulta do painel Combustíveis nos postos (19/10/2026) a do painel Despesa por área e a do painel Inflação por cidade (20/10/2026)
    expect(LEVA_2.map((i) => i.id)).toEqual([
      "quanto-meu-banco-cobra",
      "teve-fogo-perto-de-mim",
      "cem-reais-dos-impostos",
      "metodologia-do-credito",
      "quanto-custa-encher-o-tanque",
      "cem-reais-por-area",
      "quanto-subiu-o-custo-de-vida",
    ]);
    expect(Object.isFrozen(LEVA_2)).toBe(true);
    for (const i of LEVA_2) {
      expect(i.pergunta.trim().endsWith("?"), i.id).toBe(true);
      expect(i.resumo.trim(), i.id).not.toBe("");
      expect(i.portas.length, i.id).toBeGreaterThan(0);
      for (const r of [...i.rotas, ...i.arquivos]) expect(r, i.id).toMatch(/^\/[a-z0-9_\-/.]+[^/]$/);
      // nunca uma pasta: arquivo tem extensão
      for (const a of i.arquivos) expect(a, i.id).toMatch(/\.[a-z]+$/);
      if (i.forma !== "artefato") expect(i.rotas.length, i.id).toBeGreaterThan(0);
    }
    const porId = Object.fromEntries(LEVA_2.map((i) => [i.id, i]));
    expect(porId["quanto-meu-banco-cobra"].rotas).toEqual(["/observatorio-do-credito/quanto-meu-banco-cobra"]);
    expect(porId["metodologia-do-credito"].rotas).toEqual(["/observatorio-do-credito/metodologia"]);
    expect(porId["teve-fogo-perto-de-mim"].rotas).toEqual(["/territorio/queimadas/municipio"]);
    expect(porId["teve-fogo-perto-de-mim"].fichasIbge).toBe("/territorio/queimadas/municipio");
    // a ficha é montada no servidor: a gold municipal inteira continua com conta
    expect(porId["teve-fogo-perto-de-mim"].arquivos).toEqual(["/saneamento/gold/indice.json"]);
    expect(porId["cem-reais-dos-impostos"].portas).toEqual(["contas-publicas"]);
    // a consulta por área é artefato da porta aberta das Contas Públicas: nenhuma rota e nenhum arquivo abrem; o painel segue com conta
    expect(porId["cem-reais-por-area"]).toMatchObject({ forma: "artefato", portas: ["contas-publicas"], rotas: [], arquivos: [], aprovadaEm: null });
    expect(porId["cem-reais-por-area"].pergunta).toBe("Quanto de cada R$ 100 do governo federal vai para cada área?");
    // a consulta do tanque é só a rota exata, montada no servidor: nenhum arquivo abre, e o painel /combustiveis continua com conta
    expect(porId["quanto-custa-encher-o-tanque"].rotas).toEqual(["/combustiveis/no-meu-estado"]);
    expect(porId["quanto-custa-encher-o-tanque"].arquivos).toEqual([]);
    expect(porId["quanto-custa-encher-o-tanque"].portas).toEqual(["energia-e-infraestrutura", "familias"]);
    // a consulta do custo de vida também é só a rota exata, montada no servidor: a gold, as séries e o painel seguem com conta
    expect(porId["quanto-subiu-o-custo-de-vida"].rotas).toEqual(["/custo-de-vida/na-minha-cidade"]);
    expect(porId["quanto-subiu-o-custo-de-vida"].arquivos).toEqual([]);
    expect(porId["quanto-subiu-o-custo-de-vida"].portas).toEqual(["familias"]);
    expect(porId["quanto-subiu-o-custo-de-vida"].aprovadaEm).toBeNull();
  });

  it("a aprovação só vale com data real no formato AAAA-MM-DD", () => {
    expect(itemAprovado({ aprovadaEm: null })).toBe(false);
    for (const d of ["", " ", "sim", "true", "19/10/2026", "2026-13-01", "2026-02-30", "2026-11-30T00:00", "2026-1-30"]) {
      expect(itemAprovado({ aprovadaEm: d }), d).toBe(false);
    }
    expect(itemAprovado({ aprovadaEm: "2026-11-30" })).toBe(true);
    expect(itemAprovado({ aprovadaEm: "2028-02-29" })).toBe(true);
  });
});

describe("leva 2 desligada (aprovação null)", () => {
  it("nenhuma rota, ficha ou arquivo exclusivo da leva 2 é público, nem a imagem social nem uma irmã inglesa", () => {
    for (const item of desligada) {
      for (const c of caminhosDo(item)) {
        // o índice de nomes do IBGE já é aberto pela leva 1; o resto só abre com a aprovação
        expect(ehRotaPublicaCom(desligada, c), `${item.id}: ${c}`).toBe(semLeva2(c));
      }
      for (const r of item.rotas) {
        expect(ehRotaPublicaCom(desligada, r), r).toBe(false);
        expect(ehRotaPublicaCom(desligada, `${r}/opengraph-image`), r).toBe(false);
        expect(ehRotaPublicaCom(desligada, `/en${r}`), r).toBe(false);
      }
    }
    expect(ehRotaPublicaCom(desligada, FICHA)).toBe(false);
  });

  it("o estado registrado manda: item sem data fica fechado no middleware de verdade", () => {
    for (const item of LEVA_2) {
      for (const c of caminhosDo(item)) expect(ehRotaPublica(c), `${item.id}: ${c}`).toBe(itemAprovado(item) || semLeva2(c));
    }
  });

  it("o middleware manda ao login quem chega sem sessão a uma rota não aprovada", async () => {
    const { middleware } = await import("@/middleware");
    for (const item of LEVA_2.filter((i) => !itemAprovado(i))) {
      for (const c of [...item.rotas, ...(item.fichasIbge ? [`${item.fichasIbge}/5103254`] : [])]) {
        const r = await middleware(new NextRequest(`https://scrutiniums.com${c}`, { headers: { accept: "text/html" } }));
        expect(r.status, c).toBe(307);
        expect(new URL(r.headers.get("location")!).pathname, c).toBe("/entrar");
      }
    }
  });

  it("nada da leva 2 sem aprovação aparece na camada aberta nem no sitemap", async () => {
    const { portas } = await import("@/lib/perguntas/portas");
    const { default: sitemap } = await import("@/app/sitemap");
    const urls = new Set(sitemap().map((u) => new URL(u.url).pathname));
    for (const item of LEVA_2.filter((i) => !itemAprovado(i))) {
      for (const p of portas()) {
        expect(p.paraOSeuCaso.map((c) => c.href), `${p.id}: ${item.id}`).not.toContain(item.rotas[0]);
        expect(p.paraOSeuCaso.map((c) => c.pergunta), `${p.id}: ${item.id}`).not.toContain(item.pergunta);
        expect(p.metodos.map((m) => m.href), `${p.id}: ${item.id}`).not.toContain(item.rotas[0]);
      }
      for (const r of item.rotas) expect(urls.has(r), r).toBe(false);
      if (item.fichasIbge) expect([...urls].some((u) => u.startsWith(item.fichasIbge + "/")), item.id).toBe(false);
    }
    for (const p of ["familias", "economia", "territorio-e-clima", "contas-publicas"] as const) {
      expect(consultasLeva2(p, desligada), p).toEqual([]);
      expect(metodosLeva2(p, desligada), p).toEqual([]);
      expect(artefatosLeva2(p, desligada), p).toEqual([]);
    }
  });
});

describe("leva 2 ligada num teste (aprovação preenchida)", () => {
  it("abre as rotas, as fichas de sete dígitos e só os arquivos exatos", () => {
    for (const item of ligada) for (const c of caminhosDo(item)) expect(ehRotaPublicaCom(ligada, c), `${item.id}: ${c}`).toBe(true);
    expect(ehRotaPublicaCom(ligada, "/territorio/queimadas/municipio/opengraph-image")).toBe(true);
    expect(ehRotaPublicaCom(ligada, "/territorio/queimadas/municipio/5103254/")).toBe(true);
  });

  it("nunca a pasta, as vizinhas, os painéis, as golds nem caminho disfarçado", () => {
    for (const p of [
      // Território: a entrada, o painel, as golds inteiras e a pasta
      "/territorio", "/territorio/", "/territorio/queimadas", "/territorio/queimadas/", "/territorio/desastres", "/territorio/emissoes",
      "/territorio/gold", "/territorio/gold/", "/territorio/gold/queimadas_municipios.json", "/territorio/gold/queimadas.json",
      // fichas e buscas disfarçadas
      "/territorio/queimadas/municipiox", "/territorio/queimadas/municipio/x", "/territorio/queimadas/municipio/510325",
      "/territorio/queimadas/municipio/51032540", "/territorio/queimadas/municipio/5103254/x", "/territorio/queimadas/municipio/abc1234",
      "/territorio/queimadas/municipio/5103254.json", "/territorio/queimadas/municipio//5103254", "/territorio/queimadas/municipio/../../gold/queimadas.json",
      "/Territorio/queimadas/municipio", "/en/territorio/queimadas/municipio", "/en/territorio/queimadas/municipio/5103254",
      // Crédito: o painel de juros, a gold, a aplicação de página única e as subpáginas
      "/observatorio-do-credito/quanto-meu-banco-cobra/x", "/observatorio-do-credito/quanto-meu-banco-cobrax", "/observatorio-do-credito/metodologia/x",
      "/observatorio-do-credito/metodologiax", "/obs/data/gold/juros.json", "/obs/data/gold", "/obs/data/gold/", "/observatorio", "/observatorio/methodology",
      // Contas Públicas: o painel, os capítulos e os arquivos
      "/contas-publicas", "/contas-publicas/execucao", "/contas-publicas/serie.json",
      // Combustíveis: o painel, as vizinhas e os arquivos da gold
      "/combustiveis", "/combustiveis/", "/combustiveis/no-meu-estadox", "/combustiveis/no-meu-estado/SP", "/en/combustiveis/no-meu-estado",
      "/gas/gold/combustiveis.json", "/gas/series/preco-combustiveis-por-uf.csv", "/gas/gold", "/gas-natural",
      // Custo de vida: o painel, as vizinhas e os arquivos da gold
      "/custo-de-vida", "/custo-de-vida/", "/custo-de-vida/na-minha-cidadex", "/custo-de-vida/na-minha-cidade/3501", "/en/custo-de-vida/na-minha-cidade",
      "/inflacao/gold/ipca.json", "/inflacao/gold", "/inflacao/series/ipca-geral-e-grupos-mensal.csv", "/inflacao/series/ipca-subitens-12-meses.csv",
      // pastas e variações dos arquivos abertos
      "/saneamento/gold", "/saneamento/gold/", "/saneamento/gold/indice.json/", "/saneamento/gold/indice.jsonx", "/saneamento/gold/municipios.json",
    ]) expect(ehRotaPublicaCom(ligada, p), p).toBe(false);
    for (const item of ligada) {
      for (const a of item.arquivos) {
        for (const pasta of [dirname(a), dirname(a) + "/"]) expect(ehRotaPublicaCom(ligada, pasta), pasta).toBe(false);
        expect(ehRotaPublicaCom(ligada, a + "/"), a).toBe(false);
      }
    }
  });

  it("ligar um item não abre os outros", () => {
    for (const alvo of LEVA_2) {
      const leva = so(alvo.id);
      for (const outro of LEVA_2.filter((i) => i.id !== alvo.id)) {
        for (const r of outro.rotas) expect(ehRotaPublicaCom(leva, r), `${alvo.id} abriu ${r}`).toBe(false);
      }
      for (const r of alvo.rotas) expect(ehRotaPublicaCom(leva, r), r).toBe(true);
    }
  });

  it("a camada aberta lista cada item aprovado na porta do tema, na forma registrada", () => {
    expect(consultasLeva2("territorio-e-clima", ligada)).toEqual([
      { pergunta: "Teve fogo perto de mim?", resumo: LEVA_2[1].resumo, href: "/territorio/queimadas/municipio" },
    ]);
    for (const p of ["familias", "economia"] as const) {
      expect(consultasLeva2(p, ligada).map((c) => c.href), p).toEqual(
        p === "familias"
          ? ["/observatorio-do-credito/quanto-meu-banco-cobra", "/combustiveis/no-meu-estado", "/custo-de-vida/na-minha-cidade"]
          : ["/observatorio-do-credito/quanto-meu-banco-cobra"],
      );
      expect(metodosLeva2(p, ligada).map((m) => m.href), p).toEqual(["/observatorio-do-credito/metodologia"]);
    }
    expect(consultasLeva2("energia-e-infraestrutura", ligada).map((c) => c.href)).toEqual(["/combustiveis/no-meu-estado"]);
    expect(artefatosLeva2("contas-publicas", ligada)).toEqual(["cem-reais-dos-impostos", "cem-reais-por-area"]);
    expect(artefatosLeva2("contas-publicas", so("cem-reais-por-area"))).toEqual(["cem-reais-por-area"]);
    expect(consultasLeva2("contas-publicas", ligada)).toEqual([]);
    expect(consultasLeva2("territorio-e-clima", so("quanto-meu-banco-cobra"))).toEqual([]);
    // toda consulta aprovada leva a rota que a própria aprovação abre
    for (const p of ["familias", "economia", "territorio-e-clima", "energia-e-infraestrutura"] as const) {
      for (const c of consultasLeva2(p, ligada)) expect(ehRotaPublicaCom(ligada, c.href), c.href).toBe(true);
    }
  });
});

describe("leva 2: só se liga o que existe", () => {
  it("item aprovado tem página para cada rota e cada arquivo em public/", () => {
    for (const item of LEVA_2.filter(itemAprovado)) {
      for (const r of item.rotas) expect(paginaExiste(r), `${item.id}: ${r} não existe`).toBe(true);
      if (item.fichasIbge) expect(paginaExiste(`${item.fichasIbge}/5103254`), item.id).toBe(true);
      for (const a of item.arquivos) expect(existsSync(join(raiz, "public", a)), `${item.id}: ${a}`).toBe(true);
    }
  });

  it("a consulta do Território e o artefato das Contas Públicas já estão prontos para ligar", () => {
    expect(paginaExiste("/territorio/queimadas/municipio")).toBe(true);
    expect(paginaExiste(FICHA)).toBe(true);
    expect(existsSync(join(raiz, "public", "saneamento", "gold", "indice.json"))).toBe(true);
    expect(existsSync(join(raiz, "src", "components", "perguntas", "CemReaisAberto.tsx"))).toBe(true);
    expect(existsSync(join(raiz, "src", "components", "perguntas", "CemReaisPorAreaAberto.tsx"))).toBe(true);
  });

  it("a navegação de Território, a faixa de consulta aberta e o artefato só aparecem com a aprovação", () => {
    const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
    expect(ler("src/app/territorio/page.tsx")).toMatch(/leva2Aprovada\("teve-fogo-perto-de-mim"\) && \(/);
    for (const p of ["src/app/territorio/queimadas/municipio/page.tsx", "src/app/territorio/queimadas/municipio/[ibge]/page.tsx"]) {
      expect(ler(p), p).toMatch(/const aberta = leva2Aprovada\("teve-fogo-perto-de-mim"\)/);
      expect(ler(p), p).toMatch(/\{aberta && \(\s*<AvisoConsultaAberta/);
    }
    expect(ler("src/app/perguntas/[porta]/page.tsx")).toContain("artefatosLeva2(porta.id)");
    // no navegador, a consulta só baixa o índice de nomes; a gold municipal não sai do servidor
    for (const p of ["src/components/territorio/BuscaFocos.tsx", "src/lib/territorio/consultaFocos.ts"]) expect(ler(p), p).not.toContain("queimadas_municipios");
  });
});

describe("leva 2: o artefato dos R$ 100 na página aberta das Contas Públicas", () => {
  it("com a aprovação ligada, mostra cada R$ 100 pagos com fonte, exercício, datas e o painel com selo", async () => {
    caminho.atual = "/perguntas/contas-publicas";
    const { CemReaisAberto } = await import("@/components/perguntas/CemReaisAberto");
    const { ultimoExercicioEncerrado, parcelasPagas, capturaSiop } = await import("@/lib/contas-publicas/cemReais");
    const { dataFonte } = await import("@/lib/contas-publicas/dados");
    const { dividirEmCem, numero } = await import("@/lib/contas-publicas/formato");
    const ex = ultimoExercicioEncerrado()!;
    expect(ex.ano).toBe(2025);
    const parcelas = parcelasPagas(ex.ano)!;
    const partes = dividirEmCem(parcelas.map((p) => p.valor));
    expect(partes.reduce((s, v) => s + v, 0)).toBeCloseTo(100, 6);

    const html = renderToStaticMarkup(createElement(CemReaisAberto));
    expect(html).toContain('data-leva2="cem-reais-dos-impostos"');
    expect(html).toContain(`Cada R$ 100 que o governo federal pagou em ${ex.ano}`);
    for (const [i, p] of parcelas.entries()) {
      expect(html, p.nome).toContain(p.nome);
      expect(html, p.nome).toContain(`R$ ${numero(partes[i])}`);
    }
    expect(html).toContain("SIOP, dados abertos");
    expect(html).toContain(`base atualizada em ${dataFonte(ex.atualizacao)}`);
    expect(html).toContain(`capturada em ${capturaSiop()}`);
    expect(html).toContain("valores nominais");
    // é cálculo sobre valores pagos, não modelo nem estimativa, e diz que o orçamento não é pago só com impostos
    expect(html).toContain("Cálculo sobre os valores pagos, não estimativa");
    expect(html).toContain("não é pago só com impostos");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    // o painel (fechado) leva o selo; nada fechado sem aviso
    const fechados = [...html.matchAll(/<a [^>]*href="(\/[^"#?]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].filter(([, href]) => !ehRotaPublica(href));
    expect(fechados.length).toBeGreaterThan(0);
    for (const [, href, corpo] of fechados) expect(corpo, href).toContain("com conta");
  });

  it("a página da porta mostra o artefato só quando ele está aprovado", async () => {
    caminho.atual = "/perguntas/contas-publicas";
    const { PaginaPorta } = await import("@/components/perguntas/PaginaPorta");
    const { CemReaisAberto } = await import("@/components/perguntas/CemReaisAberto");
    const { portas } = await import("@/lib/perguntas/portas");
    const todas = portas();
    const porta = todas.find((p) => p.id === "contas-publicas")!;
    // a mesma montagem da rota (src/app/perguntas/[porta]/page.tsx), sem o cabeçalho, que lê o cookie da requisição
    const pagina = (leva: readonly ItemLeva2[]) =>
      renderToStaticMarkup(
        createElement(PaginaPorta, {
          porta,
          outras: todas.filter((p) => p.id !== porta.id),
          colecoes: [],
          artefato: artefatosLeva2("contas-publicas", leva).map((id) => (id === "cem-reais-dos-impostos" ? createElement(CemReaisAberto, { key: id }) : null)),
        }),
      );
    expect(pagina(LEVA_2).includes('data-leva2="cem-reais-dos-impostos"')).toBe(leva2Aprovada("cem-reais-dos-impostos"));
    expect(pagina(desligada)).not.toContain('data-leva2="cem-reais-dos-impostos"');
    const comArtefato = pagina(ligada);
    expect(comArtefato).toContain('data-leva2="cem-reais-dos-impostos"');
    // a régua vem depois dos números da porta e antes do convite aos painéis
    expect(comArtefato.indexOf('data-leva2="cem-reais-dos-impostos"')).toBeGreaterThan(comArtefato.indexOf("porta-titulo"));
    expect(comArtefato.indexOf('data-leva2="cem-reais-dos-impostos"')).toBeLessThan(comArtefato.indexOf("caminhos-titulo"));
  });
});

describe("leva 2: a consulta por área na página aberta das Contas Públicas", () => {
  it("mostra cada R$ 100 pagos no último exercício encerrado, por área, com a dívida à parte, fonte e datas, e o painel com selo", async () => {
    caminho.atual = "/perguntas/contas-publicas";
    const { CemReaisPorAreaAberto, linhasDaConsulta } = await import("@/components/perguntas/CemReaisPorAreaAberto");
    const { composicao, datasDoExercicio, emCem, ultimoEncerrado, ROTA_AREAS } = await import("@/lib/contas-publicas/areas");
    const { numero } = await import("@/lib/contas-publicas/formato");
    const ano = ultimoEncerrado()!;
    expect(ano).toBe(2025);
    const linhas = linhasDaConsulta(emCem(composicao(ano, "pago", "total")!)!);
    expect(linhas.reduce((s, l) => s + l.cem, 0)).toBeCloseTo(100, 6);
    // a dívida numa linha só, primeiro; as áreas nunca somadas a ela
    expect(linhas[0]).toMatchObject({ id: "divida", tom: "divida" });
    expect(linhas.filter((l) => l.tom === "area").map((l) => l.nome)).toContain("Previdência Social");

    const html = renderToStaticMarkup(createElement(CemReaisPorAreaAberto));
    expect(html).toContain('data-leva2="cem-reais-por-area"');
    expect(html).toContain(`Cada R$ 100 pagos em ${ano}, por área de governo`);
    for (const l of linhas) {
      expect(html, l.nome).toContain(l.nome);
      expect(html, l.nome).toContain(`R$ ${numero(l.cem)}`);
    }
    const d = datasDoExercicio(ano)!;
    expect(html).toContain("SIOP, dados abertos");
    expect(html).toContain(`base atualizada em ${d.atualizacao}`);
    expect(html).toContain(`capturada em ${d.captura}`);
    expect(html).toContain("valores nominais");
    expect(html).toContain("Cálculo sobre os valores pagos, não estimativa");
    expect(html).not.toMatch(/NaN|undefined|Infinity|—/);
    // modo de consulta: sem série, sem download, sem outro exercício
    expect(html).not.toMatch(/\.csv|funcoes\.json|role="img"|<table/);
    expect(html).not.toMatch(/parcial|em andamento/);
    const fechados = [...html.matchAll(/<a [^>]*href="(\/[^"#?]*)[^"]*"[^>]*>([\s\S]*?)<\/a>/g)].filter(([, href]) => !ehRotaPublica(href));
    expect(fechados.map(([, href]) => href)).toEqual([ROTA_AREAS]);
    for (const [, href, corpo] of fechados) expect(corpo, href).toContain("com conta");
  });

  it("a página da porta mostra a consulta só quando ela está aprovada, entre os números e os caminhos", async () => {
    caminho.atual = "/perguntas/contas-publicas";
    const { PaginaPorta } = await import("@/components/perguntas/PaginaPorta");
    const { CemReaisPorAreaAberto } = await import("@/components/perguntas/CemReaisPorAreaAberto");
    const { portas } = await import("@/lib/perguntas/portas");
    const todas = portas();
    const porta = todas.find((p) => p.id === "contas-publicas")!;
    const pagina = (leva: readonly ItemLeva2[]) =>
      renderToStaticMarkup(
        createElement(PaginaPorta, {
          porta,
          outras: todas.filter((p) => p.id !== porta.id),
          colecoes: [],
          artefato: artefatosLeva2("contas-publicas", leva).map((id) => (id === "cem-reais-por-area" ? createElement(CemReaisPorAreaAberto, { key: id }) : null)),
        }),
      );
    expect(pagina(LEVA_2).includes('data-leva2="cem-reais-por-area"')).toBe(leva2Aprovada("cem-reais-por-area"));
    expect(pagina(desligada)).not.toContain('data-leva2="cem-reais-por-area"');
    const ligado = pagina(so("cem-reais-por-area"));
    expect(ligado).toContain('data-leva2="cem-reais-por-area"');
    expect(ligado.indexOf('data-leva2="cem-reais-por-area"')).toBeGreaterThan(ligado.indexOf("porta-titulo"));
    expect(ligado.indexOf('data-leva2="cem-reais-por-area"')).toBeLessThan(ligado.indexOf("caminhos-titulo"));
    // a rota da página aberta registra o componente
    expect(readFileSync(join(raiz, "src/app/perguntas/[porta]/page.tsx"), "utf-8")).toContain('"cem-reais-por-area": CemReaisPorAreaAberto');
  });
});

describe("leva 2: a ficha \"Teve fogo perto de mim?\"", () => {
  type Gold = { campos: string[]; linhas: (string | number | null)[][]; semCoberturaNaFonte: { ids: string[] } };
  const gold = JSON.parse(readFileSync(join(raiz, "public", "territorio", "gold", "queimadas_municipios.json"), "utf-8")) as Gold;
  const indice = JSON.parse(readFileSync(join(raiz, "public", "saneamento", "gold", "indice.json"), "utf-8")) as [string, string, string][];
  const col = (c: string) => gold.campos.indexOf(c);

  it("os números são os da gold, e o estado é a soma dos seus municípios na mesma contagem", async () => {
    const { fichaFocos } = await import("@/lib/territorio/focosMunicipio");
    const linha = gold.linhas.find((l) => l[col("id")] === "5103254")!;
    const f = fichaFocos("5103254")!;
    expect(f.nome).toBe(linha[col("nome")]);
    expect(f.focos.ultimoAnoCompleto).toBe(linha[col("focos_ultimoAnoCompleto")]);
    expect(f.focos.acumuladoAnoCorrente).toBe(linha[col("focos_acumuladoAnoCorrente")]);
    expect(f.focos.mesmoPeriodoAnoAnterior).toBe(linha[col("focos_mesmoPeriodoAnoAnterior")]);
    expect(f.porMilKm2).toBeCloseTo((1000 * (linha[col("focos_ultimoAnoCompleto")] as number)) / (linha[col("areaKm2")] as number), 9);
    const daUf = gold.linhas.filter((l) => l[col("uf")] === f.uf);
    expect(f.focosUf.ultimoAnoCompleto).toBe(daUf.reduce((s, l) => s + ((l[col("focos_ultimoAnoCompleto")] as number | null) ?? 0), 0));
    expect(f.posicaoUf).toBeGreaterThanOrEqual(1);
    expect(f.posicaoUf!).toBeLessThanOrEqual(f.comFocoUf);
    expect(f.posicaoBrasil).toBeGreaterThanOrEqual(f.posicaoUf!);
  });

  it("zero só quando a regra da gold o calcula; município fora da malha da fonte fica indisponível; código desconhecido não tem ficha", async () => {
    const { fichaFocos } = await import("@/lib/territorio/focosMunicipio");
    const naGold = new Set(gold.linhas.map((l) => l[col("id")]));
    const semFoco = indice.find(([id]) => !naGold.has(id) && !gold.semCoberturaNaFonte.ids.includes(id))!;
    const z = fichaFocos(semFoco[0])!;
    expect(z.focos.ultimoAnoCompleto).toBe(0);
    expect(z.porMilKm2).toBe(0);
    expect(z.areaKm2).toBeNull();
    expect(z.posicaoBrasil).toBeNull();
    for (const id of gold.semCoberturaNaFonte.ids.filter((x) => indice.some(([i]) => i === x))) {
      const s = fichaFocos(id)!;
      expect(s.semCobertura, id).toBeTruthy();
      expect(Object.values(s.focos), id).toEqual([null, null, null]);
    }
    for (const id of ["1234567", "510325", "51032540", "abc1234", "../gold"]) expect(fichaFocos(id), id).toBeNull();
  });

  it("renderiza a ficha com número, período, fonte INPE com data e comparação com a UF, sem série nem ranking", async () => {
    caminho.atual = FICHA;
    const { default: Ficha } = await import("@/app/territorio/queimadas/municipio/[ibge]/page");
    const html = renderToStaticMarkup(createElement(Ficha, { params: { ibge: "5103254" } }));
    expect(html).toContain("Focos de calor em Colniza (MT)");
    expect(html).toContain("Comparado com Mato Grosso");
    expect(html).toMatch(/Focos em 2025/);
    expect(html).toContain("Focos por 1.000 km²");
    expect(html).toContain("INPE, Programa Queimadas");
    expect(html).toMatch(/Captura em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain("indisponível, porque esta publicação traz a área só dos municípios que tiveram foco");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    // modo de consulta: sem a tabela de municípios do painel nem download da gold
    expect(html).not.toContain("<caption class=\"sr-only\">Os 15 municípios");
    expect(html).not.toContain("queimadas_municipios.json");
    // a faixa "Consulta aberta" acompanha a aprovação
    expect(html.includes("data-aviso-consulta-aberta")).toBe(leva2Aprovada("teve-fogo-perto-de-mim"));

    const naGold = new Set(gold.linhas.map((l) => l[col("id")]));
    const semFoco = indice.find(([id]) => !naGold.has(id) && !gold.semCoberturaNaFonte.ids.includes(id))!;
    caminho.atual = `/territorio/queimadas/municipio/${semFoco[0]}`;
    const zero = renderToStaticMarkup(createElement(Ficha, { params: { ibge: semFoco[0] } }));
    expect(zero).toContain("não detectou foco de calor");
    expect(zero).toContain("zero focos não prova que não houve fogo");
    expect(() => renderToStaticMarkup(createElement(Ficha, { params: { ibge: "1234567" } }))).toThrow();
  });

  it("a busca renderiza com o ano da gold e o modelo didático do foco", async () => {
    caminho.atual = "/territorio/queimadas/municipio";
    const { default: Busca } = await import("@/app/territorio/queimadas/municipio/page");
    const html = renderToStaticMarkup(createElement(Busca));
    expect(html).toContain("Teve fogo perto de mim?");
    expect(html).toContain("Do satélite ao foco de calor");
    expect(html).toContain("Modelo didático");
    expect(html).toMatch(/focos de calor de 2025/);
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    expect(html.includes("data-aviso-consulta-aberta")).toBe(leva2Aprovada("teve-fogo-perto-de-mim"));
  });
});

describe("leva 2: a consulta \"Quanto custa encher o tanque no meu estado?\"", () => {
  it("rota pronta para ligar, fechada enquanto a aprovação for null, com a faixa e a navegação presas à aprovação", () => {
    expect(paginaExiste("/combustiveis/no-meu-estado")).toBe(true);
    const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
    const pagina = ler("src/app/combustiveis/no-meu-estado/page.tsx");
    expect(pagina).toMatch(/const aberta = leva2Aprovada\("quanto-custa-encher-o-tanque"\)/);
    expect(pagina).toMatch(/\{aberta && \(\s*<AvisoConsultaAberta/);
    // a navegação da coleção sai do catálogo único (Iniciativa 2), que prende a consulta à aprovação
    expect(ler("src/lib/observatorios/navegacaoColecao.ts")).toContain('leva2Aprovada("quanto-custa-encher-o-tanque")');
    // modo de consulta: o último mês vai no HTML; a página não busca a gold nem as séries no navegador
    for (const p of ["src/components/combustiveis/PrecoNoEstado.tsx", "src/app/combustiveis/no-meu-estado/page.tsx"]) {
      expect(ler(p), p).not.toMatch(/fetch\(|["`]\/gas\/(gold|series)|DownloadsGas|GraficoLinhas/);
    }
  });

  it("renderiza o último mês por UF com fonte, data, distância para o Brasil e o painel com selo, sem série nem download", async () => {
    caminho.atual = "/combustiveis/no-meu-estado";
    const { default: Consulta } = await import("@/app/combustiveis/no-meu-estado/page");
    const html = renderToStaticMarkup(createElement(Consulta));
    expect(html).toContain("Quanto custa encher o tanque no meu estado?");
    expect(html).toContain("ANP, Levantamento de Preços de Combustíveis");
    expect(html).toMatch(/Dados capturados\s+em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain("Gasolina comum");
    expect(html).toContain("postos pesquisados");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).not.toContain(".csv");
    expect(html.includes("data-aviso-consulta-aberta")).toBe(leva2Aprovada("quanto-custa-encher-o-tanque"));
  });
});

describe("leva 2: a consulta \"Quanto subiu o custo de vida na minha cidade?\"", () => {
  it("rota pronta para ligar, fechada enquanto a aprovação for null, com a faixa e a navegação presas à aprovação", () => {
    expect(paginaExiste("/custo-de-vida/na-minha-cidade")).toBe(true);
    const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
    const pagina = ler("src/app/custo-de-vida/na-minha-cidade/page.tsx");
    expect(pagina).toMatch(/const aberta = leva2Aprovada\("quanto-subiu-o-custo-de-vida"\)/);
    expect(pagina).toMatch(/\{aberta && \(\s*<AvisoConsultaAberta/);
    expect(ler("src/lib/observatorios/navegacaoColecao.ts")).toContain('leva2Aprovada("quanto-subiu-o-custo-de-vida")');
    // modo de consulta: o último mês vai no HTML; a página não busca a gold nem as séries no navegador, nem desenha série
    for (const p of ["src/components/inflacao/InflacaoNaArea.tsx", "src/app/custo-de-vida/na-minha-cidade/page.tsx"]) {
      expect(ler(p), p).not.toMatch(/fetch\(|["`]\/inflacao\/(gold|series)|DownloadsInflacao|GraficoLinhas|SerieArea|ComparacaoAreas|Destaques|ComoPesa/);
    }
  });

  it("renderiza o último mês da área com fonte, data, os nove grupos e o painel com selo, sem série nem download", async () => {
    caminho.atual = "/custo-de-vida/na-minha-cidade";
    const { default: Consulta } = await import("@/app/custo-de-vida/na-minha-cidade/page");
    const html = renderToStaticMarkup(createElement(Consulta));
    expect(html).toContain("Quanto subiu o custo de vida na minha cidade?");
    expect(html).toContain("IBGE, Índice Nacional de Preços ao Consumidor Amplo (IPCA), tabela 7060 do SIDRA");
    expect(html).toMatch(/Dados capturados em \d{2}\/\d{2}\/\d{4}/);
    expect(html).toContain("Os nove grupos de despesa");
    expect(html).toContain("1 a 40 salários mínimos");
    expect(html).not.toMatch(/NaN|undefined|Infinity/);
    expect(html).not.toContain(".csv");
    expect(html).not.toContain("data-artefato");
    expect(html.includes("data-aviso-consulta-aberta")).toBe(leva2Aprovada("quanto-subiu-o-custo-de-vida"));
  });
});
