import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { idsDasColecoes, navegacaoDaColecao, navegacaoDaConta, navegacaoDoObservatorio } from "@/lib/observatorios/navegacaoColecao";
import { MAX_A_VISTA, destinoAtual, dividirItens, type NavegacaoDaColecao } from "@/lib/observatorios/navegacaoPura";
import { NavegacaoColecaoCliente } from "@/components/layout/NavegacaoColecaoCliente";
import { leva2Aprovada } from "@/lib/rotasPublicas";

const navegador = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => navegador.caminho,
}));

/**
 * Uma só navegação de módulo em toda coleção (Iniciativa 2 do parecer de UX de 21/10/2026, docs/PARECER_UX_2026-10-21.md):
 * o catálogo único (src/lib/observatorios/navegacaoColecao.ts) e o componente que o desenha (NavegacaoColecao). As regras
 * valem para as 28 coleções do registro, e cada uma tem um caso que a reprova.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
/** O link para `href` está marcado como página atual (a ordem dos atributos no HTML não importa). */
const marcado = (h: string, href: string) => (h.match(/<a [^>]*>/g) ?? []).some((a) => a.includes(`href="${href}"`) && a.includes('aria-current="page"'));

/** Consulta pessoal de cada coleção que tem uma (o destino mais procurado): sempre o segundo item. */
const CONSULTAS: Record<string, string | null> = {
  "setor-eletrico": "/setor-eletrico/conta-de-luz",
  saneamento: "/saneamento/municipio",
  gas: "/gas-natural/gas-de-cozinha",
  combustiveis: leva2Aprovada("quanto-custa-encher-o-tanque") ? "/combustiveis/no-meu-estado" : null,
  credito: "/observatorio-do-credito/quanto-meu-banco-cobra",
  divida: "/observatorio-do-credito/quanto-meu-banco-cobra",
  federais: "/contas-publicas/previdencia",
  estaduais: "/contas-publicas-estaduais#ficha",
  // consulta da LEVA_2 sem aprovação do dono não aparece na navegação
  "custo-de-vida": leva2Aprovada("quanto-subiu-o-custo-de-vida") ? "/custo-de-vida/na-minha-cidade" : null,
};

/** A entrada da coleção é o "Início"; o Crédito começa pela apresentação, e o painel completo vem como item próprio. */
const ENTRADA: Record<string, string> = { credito: "/observatorio-do-credito" };

/** Problemas de uma navegação; lista vazia quando ela segue as regras. */
function problemas(nav: NavegacaoDaColecao, entrada: string, consulta: string | null | undefined): string[] {
  const p: string[] = [];
  const [primeiro, segundo] = nav.itens;
  if (!primeiro || !/^(Início|Home)$/.test(primeiro.rotulo) || primeiro.href !== entrada || !primeiro.publicado) p.push("o primeiro item não é a entrada da coleção (Início)");
  if (consulta) {
    if (segundo?.href !== consulta) p.push(`a consulta pessoal ${consulta} não é o segundo item`);
    if (nav.consulta !== consulta) p.push("a consulta declarada não é a esperada");
  } else if (consulta === null && nav.consulta) p.push(`consulta ${nav.consulta} que não deveria aparecer`);
  if (nav.consulta && segundo?.href !== nav.consulta) p.push("a consulta declarada está fora da segunda posição");
  for (let atual = -1; atual < nav.itens.length; atual++) {
    if (dividirItens(nav.itens, atual).aVista.length > MAX_A_VISTA) p.push(`mais de ${MAX_A_VISTA} destinos à vista`);
  }
  const hrefs = nav.itens.flatMap((i) => [i.href, ...(i.subpaginas ?? []).map((s) => s.href)]);
  for (const a of Object.values(nav.atalhos)) if (a && hrefs.includes(a)) p.push(`atalho ${a} repetido na lista`);
  for (const i of nav.itens) {
    if (i.subpaginas && i.publicado && !i.subpaginas.some((s) => s.publicado && s.href === i.href)) p.push(`grupo ${i.rotulo} não leva a uma página dele`);
    if (!i.rotulo.trim() || !i.href) p.push("item sem rótulo ou sem endereço");
  }
  return p;
}

/** Endereço que existe no app: uma página (ou rota) em src/app, com segmentos dinâmicos, ou a aplicação do Crédito. */
function existe(href: string): boolean {
  const caminho = href.split(/[?#]/)[0];
  const partes = caminho.split("/").filter(Boolean);
  const procura = (dir: string, i: number): boolean => {
    if (!existsSync(dir)) return false;
    const pagina = (d: string) => ["page.tsx", "route.ts"].some((f) => existsSync(join(d, f)));
    if (i === partes.length) {
      if (pagina(dir)) return true;
      // segmento opcional "[[...x]]" também atende o endereço sem ele
      return readdirSync(dir, { withFileTypes: true }).some((d) => d.isDirectory() && d.name.startsWith("[[...") && pagina(join(dir, d.name)));
    }
    const filhos = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
    if (filhos.includes(partes[i]) && procura(join(dir, partes[i]), i + 1)) return true;
    // grupos de rota "(x)" não entram no endereço
    if (filhos.some((f) => /^\(.*\)$/.test(f) && procura(join(dir, f), i))) return true;
    if (filhos.some((f) => /^\[[^.]/.test(f) && procura(join(dir, f), i + 1))) return true;
    return filhos.some((f) => /^\[\[?\.\.\./.test(f) && ["page.tsx", "route.ts"].some((x) => existsSync(join(dir, f, x))));
  };
  return procura(join(raiz, "src/app"), 0);
}

describe("catálogo único das 28 coleções", () => {
  const ids = idsDasColecoes();

  it("cobre as 28 coleções do registro, na ordem dos observatórios", () => {
    expect(ids).toHaveLength(28);
    expect(ids).toEqual(OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => c.id)));
  });

  for (const o of OBSERVATORIOS) {
    for (const c of o.colecoes) {
      it(`${o.nomeCurto} · ${c.nome}: Início, consulta em segundo, até ${MAX_A_VISTA} à vista, nada sem página como link`, () => {
        const nav = navegacaoDaColecao(c.id);
        expect(nav.nome).toBe(c.nome);
        expect(problemas(nav, ENTRADA[c.id] ?? c.href, CONSULTAS[c.id])).toEqual([]);
      });
    }
  }

  it("todo destino publicado e todo atalho levam a uma página que existe", () => {
    const faltam: string[] = [];
    for (const id of ids) {
      const nav = navegacaoDaColecao(id);
      const hrefs = [...nav.itens.flatMap((i) => [i, ...(i.subpaginas ?? [])]).filter((x) => x.publicado).map((x) => x.href), ...Object.values(nav.atalhos).filter(Boolean)] as string[];
      for (const h of hrefs) if (!existe(h)) faltam.push(`${id}: ${h}`);
    }
    expect(faltam).toEqual([]);
  });

  it("o Território e Clima, que mantém painéis próprios, tem a navegação do observatório: entrada, Queimadas, Desastres, Emissões e Método", () => {
    const nav = navegacaoDoObservatorio("territorio-e-clima");
    expect(nav.itens.map((i) => i.href)).toEqual(["/territorio", "/territorio/queimadas", "/territorio/desastres", "/territorio/emissoes"]);
    expect(nav.atalhos).toEqual({ metodo: "/territorio/metodologia" });
  });

  it("os grupos com menu suspenso (Setor Elétrico, Saneamento, Agronegócio, Gás) viram itens com subpáginas, e o capítulo em preparação vira texto", () => {
    for (const id of ["setor-eletrico", "saneamento", "agro", "gas"]) expect(navegacaoDaColecao(id).itens.some((i) => (i.subpaginas?.length ?? 0) > 1), id).toBe(true);
    const capitulos = navegacaoDaColecao("federais").itens.find((i) => i.rotulo === "Capítulos");
    expect(capitulos?.subpaginas?.some((s) => !s.publicado)).toBe(true);
  });
});

describe("regras reprovam o que não segue o padrão", () => {
  const base: NavegacaoDaColecao = {
    id: "teste", nome: "Teste", tipo: "colecao", acento: "energia", atalhos: { metodo: "/teste/metodo" },
    itens: [
      { rotulo: "Início", href: "/teste", publicado: true },
      { rotulo: "Minha cidade", href: "/teste/cidade", publicado: true },
      { rotulo: "Painel", href: "/teste/painel", publicado: true },
    ],
    consulta: "/teste/cidade",
  };

  it("a navegação de referência passa", () => {
    expect(problemas(base, "/teste", "/teste/cidade")).toEqual([]);
  });

  it("reprova consulta fora da segunda posição", () => {
    const fora = { ...base, itens: [base.itens[0], base.itens[2], base.itens[1]] };
    expect(problemas(fora, "/teste", "/teste/cidade").join(" ")).toContain("não é o segundo item");
  });

  it("reprova mais de oito à vista sem passar pelo Mais", () => {
    const muitos = Array.from({ length: 12 }, (_, i) => ({ rotulo: `P${i}`, href: `/teste/p${i}`, publicado: true }));
    expect(dividirItens(muitos, -1).aVista).toHaveLength(MAX_A_VISTA);
    expect(dividirItens(muitos, -1).mais).toHaveLength(4);
    // o atual nunca fica escondido no Mais
    expect(dividirItens(muitos, 10).aVista.map((x) => x.i)).toContain(10);
    expect(dividirItens(muitos, 10).aVista).toHaveLength(MAX_A_VISTA);
  });

  it("reprova item sem página como link: vira texto 'em preparação'", () => {
    const comPrep: NavegacaoDaColecao = { ...base, itens: [...base.itens, { rotulo: "Capítulo novo", href: "/teste/novo", publicado: false }] };
    navegador.caminho = "/teste";
    const h = renderToStaticMarkup(createElement(NavegacaoColecaoCliente, { nav: comPrep, caminho: "/teste", idioma: "pt" }));
    expect(h).not.toContain('href="/teste/novo"');
    // o estado sai do SeloProntidao (Iniciativa 4): glifo e texto, a forma única da plataforma
    expect(h).toMatch(/Capítulo novo<span data-prontidao="preparacao"[^>]*><span aria-hidden="true">○<\/span>em preparação/);
  });
});

describe("componente NavegacaoColecao", () => {
  const render = (nav: NavegacaoDaColecao, caminho: string) => {
    navegador.caminho = caminho;
    return renderToStaticMarkup(createElement(NavegacaoColecaoCliente, { nav, caminho, idioma: "pt" }));
  };

  it("aria-label padrão, atual com aria-current e filete do acento, alvos de 44 px", () => {
    const h = render(navegacaoDaColecao("gas"), "/gas-natural/gas-de-cozinha");
    expect(h).toContain('aria-label="Navegação da coleção Gás Natural"');
    expect(marcado(h, "/gas-natural/gas-de-cozinha")).toBe(true);
    expect((h.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(h).toContain("bg-gas");
    expect(h).toContain("min-h-[44px]");
  });

  it("linha 2 só quando o destino atual tem subpáginas, com a página atual marcada", () => {
    const nav = navegacaoDaColecao("gas");
    expect(render(nav, "/gas-natural")).not.toContain("Páginas de ");
    const h = render(nav, "/gas-natural/importacao");
    expect(h).toContain('aria-label="Páginas de De onde vem"');
    expect(marcado(h, "/gas-natural/importacao")).toBe(true);
    expect(h).toContain("(grupo da página atual)");
  });

  it("Dados, Método e Glossário à direita, nesta ordem, e o atalho atual marcado", () => {
    const h = render(navegacaoDaColecao("federais"), "/contas-publicas/glossario");
    const direita = h.slice(h.indexOf("border-l border-linha"));
    const ordem = ["/contas-publicas/dados", "/contas-publicas/metodologia", "/contas-publicas/glossario"].map((x) => direita.indexOf(`href="${x}"`));
    expect(ordem.every((x, i) => x > 0 && (i === 0 || x > ordem[i - 1]))).toBe(true);
    expect(marcado(h, "/contas-publicas/glossario")).toBe(true);
  });

  it("nas páginas abaixo de um atalho, o atalho fica destacado e Início não é anunciado como atual", () => {
    const nav = navegacaoDaColecao("setor-eletrico");
    for (const r of ["/setor-eletrico/dados/reproducao", "/setor-eletrico/dados/saude", "/en/setor-eletrico/dados/reproducao"])
      expect(destinoAtual(nav, r), r).toEqual({ item: -1, sub: null, atalho: "dados", abaixoDoAtalho: true });
    expect(destinoAtual(nav, "/setor-eletrico/metodologia/avaliacao")).toMatchObject({ item: -1, atalho: "metodo" });
    // o próprio atalho continua sendo a página atual; um destino mais próximo do endereço ganha do atalho acima dele
    expect(destinoAtual(nav, "/setor-eletrico/dados")).toEqual({ item: -1, sub: null, atalho: "dados" });
    expect(destinoAtual(nav, "/setor-eletrico/conta-de-luz")).toMatchObject({ item: 1, atalho: null });
    const h = render(nav, "/setor-eletrico/dados/reproducao");
    expect(h).not.toContain('aria-current="page"');
    expect((h.match(/<a [^>]*>/g) ?? []).some((a) => a.includes('href="/setor-eletrico/dados"') && a.includes("data-atual"))).toBe(true);
  });

  it("tema da Eficiência dentro de outra coleção leva para a linha 2 também as ações dele (dados, métodos, comparar)", () => {
    const subs = (id: string, rotulo: string) => navegacaoDaColecao(id).itens.find((i) => i.rotulo === rotulo)?.subpaginas?.map((s) => s.href) ?? [];
    expect(subs("protecao", "Segurança alimentar")).toEqual(expect.arrayContaining(["/eficiencia-estatal/seguranca-alimentar/dados", "/eficiencia-estatal/seguranca-alimentar/metodos"]));
    expect(subs("justica", "Acesso à Justiça")).toContain("/eficiencia-estatal/acesso-justica/dados");
    expect(subs("saneamento", "Nas capitais")).toContain("/eficiencia-estatal/saneamento/dados");
    expect(subs("conectividade", "Energia e conectividade nas capitais")).toContain("/eficiencia-estatal/energia-conectividade/metodos");
    expect(destinoAtual(navegacaoDaColecao("protecao"), "/eficiencia-estatal/seguranca-alimentar/dados")).toMatchObject({ sub: expect.any(Number), atalho: null });
  });

  it("'Mais' é um details fechável no desktop; no celular os mesmos itens entram no fim da faixa", () => {
    const nav = navegacaoDaColecao("saneamento");
    expect(nav.itens.length).toBeGreaterThan(MAX_A_VISTA);
    const h = render(nav, "/saneamento");
    expect(h).toContain("<details");
    expect(h).toMatch(/<summary[^>]*>Mais/);
    expect(h).toContain("sm:hidden");
    expect(h).not.toContain("Menu");
  });

  it("a consulta pessoal ganha da mesma página repetida num grupo, e a ficha abaixo dela continua marcando a consulta", () => {
    const nav = navegacaoDaColecao("saneamento");
    expect(destinoAtual(nav, "/saneamento/municipio")).toMatchObject({ item: 1, sub: null });
    expect(destinoAtual(nav, "/saneamento/municipio/3550308")).toMatchObject({ item: 1 });
    expect(destinoAtual(nav, "/aperitivo/saneamento")).toMatchObject({ item: 1 });
  });

  it("na primeira página de um grupo, que tem o mesmo endereço do grupo, a subpágina é a atual e o grupo só fica destacado", () => {
    const nav = navegacaoDaColecao("federais");
    const capitulos = nav.itens.findIndex((i) => i.rotulo === "Capítulos");
    expect(destinoAtual(nav, "/contas-publicas/panorama")).toMatchObject({ item: capitulos, sub: 0 });
    const h = render(nav, "/contas-publicas/panorama");
    const atuais = (h.match(/<a [^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/g) ?? []).map((a) => a.replace(/<[^>]+>/g, ""));
    expect(atuais).toEqual(["Panorama das contas"]);
    expect(h).toContain("(grupo da página atual)");
  });

  it("nenhum menu suspenso por grupo nem botão 'Menu' no componente", () => {
    const src = ler("src/components/layout/NavegacaoColecaoCliente.tsx");
    expect((src.match(/<DetalhesFechaveis/g) ?? []).length).toBe(1);
    expect(src).not.toMatch(/>\s*\{?tx\("Menu"/);
  });
});

describe("uma só navegação de módulo e um só cabeçalho em toda superfície (critério de conclusão da Iniciativa 2)", () => {
  const fontes = (dir: string): string[] =>
    readdirSync(join(raiz, dir), { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? fontes(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : [],
    );

  it("FocoHeader não existe nem é importado; /app usa a barra comum com a navegação da conta", () => {
    expect(existsSync(join(raiz, "src/components/layout/FocoHeader.tsx"))).toBe(false);
    expect(fontes("src").filter((f) => !f.includes("/tests/") && /FocoHeader/.test(ler(f)))).toEqual([]);
    const foco = ler("src/app/app/(foco)/layout.tsx");
    expect(foco).toContain('<CabecalhoPlataforma observatorio={null} destinoConta="/app/conta" />');
    expect(foco).toContain("nav={navegacaoDaConta(isAdmin(user))}");
    expect(foco).toMatch(/<form action="\/api\/auth\/sair" method="post"[^>]*>[\s\S]*?Sair[\s\S]*?<\/form>/);
  });

  it("navegação da conta: Encontre o painel e Conta; Admin só para quem administra", () => {
    const comum = navegacaoDaConta(false);
    expect(comum.itens.map((i) => [i.rotulo, i.href])).toEqual([["Encontre o painel", "/app/observatorios"], ["Conta", "/app/conta"]]);
    expect(navegacaoDaConta(true).itens.map((i) => i.rotulo)).toEqual(["Encontre o painel", "Conta", "Admin"]);
    for (const i of navegacaoDaConta(true).itens) expect(existsSync(join(raiz, "src/app/app/(foco)", i.href.replace("/app/", ""), "page.tsx")), i.href).toBe(true);
    navegador.caminho = "/app/conta";
    const h = renderToStaticMarkup(createElement(NavegacaoColecaoCliente, { nav: comum, caminho: "/app/conta", idioma: "pt" }));
    expect(h).toContain('aria-label="Navegação da conta"');
    expect(marcado(h, "/app/conta")).toBe(true);
  });

  it("nenhum componente de navegação de domínio além da navegação da coleção, e nenhum menu suspenso nos cabeçalhos", () => {
    // os componentes que desenham navegação de módulo: só os comuns de src/components/layout
    const restantes = fontes("src/components")
      .filter((f) => !f.startsWith("src/components/layout/") && /\/(Cabecalho|Navegacao)[A-Za-z]*\.tsx$/.test(f))
      .filter((f) => /<nav\b/.test(ler(f)));
    // ficam as abas dos seis observatórios (barra comum) e a NavegacaoLocal do Setor Elétrico, que não é navegação de módulo:
    // mora no conteúdo e lista os capítulos de uma página (ex.: "Capítulos de geração"), um nível abaixo da linha 2
    expect(restantes.filter((f) => !/NavegacaoObservatorios|energia\/NavegacaoLocal/.test(f))).toEqual([]);
    expect(ler("src/components/energia/NavegacaoLocal.tsx")).not.toMatch(/Navegação da coleção|DetalhesFechaveis/);
    for (const d of ["src/components/energia", "src/components/saneamento", "src/components/agro"])
      expect(fontes(d).filter((f) => /DetalhesFechaveis/.test(ler(f))), d).toEqual([]);
  });

  it("o bloco 'Para ir além' vem no HTML do servidor, sem esperar o navegador", async () => {
    const { ParaIrAlem } = await import("@/components/observatorios/ParaIrAlem");
    const { mapaParaIrAlem } = await import("@/lib/observatorios/mapaParaIrAlem");
    navegador.caminho = "/conectividade";
    const h = renderToStaticMarkup(createElement(ParaIrAlem, { mapa: mapaParaIrAlem() }));
    expect(h).toContain('id="para-ir-alem"');
    expect(h).toContain("Para ir além");
    expect(ler("src/components/observatorios/ParaIrAlem.tsx")).not.toMatch(/useEffect|useState/);
  });
});
