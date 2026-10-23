/**
 * O Crédito na mesma casca (Iniciativa 2 do parecer de UX de 23/10/2026, docs/ux-2026-10-23/PARECER_UX_2026-10-23.md, I2,
 * etapa 1): a aplicação de página única (/observatorio, public/obs) deixa de ter navegação, marca e rodapé próprios e passa a
 * usar os da plataforma, gerados do registro. Este teste reprova:
 *
 * 1. HTML da casca diferente do dos componentes React (navegação da coleção, rótulo de contexto, "Para ir além", rodapé da
 *    coleção e rodapé da plataforma), endereço por endereço da aplicação: cascaPura.ts é a cópia em texto deles;
 * 2. index.html fora de sincronia com o gerador (node scripts/barra-spa.mjs) ou casca.css sem regra para uma classe da casca;
 * 3. no HTML que o servidor entrega para cada coleção servida pela aplicação: barra lateral, barra de celular, marca, rodapé ou
 *    alternador de tema próprios; botão de navegação (data-view); navegação que não seja a da coleção dona, com o atual
 *    marcado; fim de página sem "Para ir além", rodapé da coleção e rodapé da plataforma; data ISO ou "UTC" em texto visível;
 * 4. no app.js: a consulta a /api/admin/eu (o 403 do console), o tema escuro aplicado, a interceptação dos links da casca e a
 *    troca da casca a cada página;
 * 5. no build, com sessão (EXIGIR_BUILD_HTML=1 no CI): as mesmas regras na resposta real de uma página de cada coleção;
 * 6. (PR 2 da iniciativa) corpo de letra fora da escala da plataforma (--tipo-*), classe good/bad, --cor-credito-* ou tema escuro
 *    nas folhas da aplicação; selo fora da forma do SeloNatureza; faixa de números sem a natureza de cada número; data ISO ou
 *    "UTC" escritos na tela pelo app.js; seta ou travessão no lead das páginas.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const navegador = vi.hoisted(() => ({ caminho: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => navegador.caminho,
}));

import { NavegacaoColecaoCliente } from "@/components/layout/NavegacaoColecaoCliente";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { RodapeColecao } from "@/components/layout/RodapeColecao";
import { Footer } from "@/components/layout/Footer";
import { ParaIrAlem } from "@/components/observatorios/ParaIrAlem";
import { mapaParaIrAlem } from "@/lib/observatorios/mapaParaIrAlem";
import { navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";
import { ABAS_INSTITUCIONAIS_CREDITO } from "@/lib/observatorios/registro";
import { FIM_DA_PAGINA_CREDITO } from "@/lib/credito/navegacao";
import { htmlNavegacao, htmlParaIrAlem, htmlRodapeColecao, htmlRotulo } from "@/lib/observatorios/cascaPura";
import {
  CLASSE_ROTULO_SPA,
  MARCADOR_FIM_FIM,
  MARCADOR_FIM_INICIO,
  MARCADOR_NAV_FIM,
  MARCADOR_NAV_INICIO,
  MARCADOR_RODAPE_FIM,
  MARCADOR_RODAPE_INICIO,
  colecaoDaCasca,
  htmlFimSpa,
  htmlNavegacaoSpa,
  htmlRodapePlataformaSpa,
  indiceCasca,
} from "@/lib/observatorios/barraSpa";
import { montarHtml, resolverMeta } from "@/lib/observatorioHead";

/** HTML que o route handler de /observatorio entrega para um endereço (ele recebe o caminho sem o prefixo). */
const servido = (rota: string) => montarHtml(resolverMeta(rota.replace(/^\/observatorio/, "") || "/"));
import { exigirBuild, htmlDe, subirServidor, temBuild, type ServidorProducao } from "./suporte/servidor-producao";

const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const indexHtml = ler("public/obs/index.html");
const app = ler("public/obs/app.js");

/** Todo endereço da aplicação: as abas do catálogo, a raiz e uma ficha de cada rota dinâmica. */
const ENDERECOS = [
  "/observatorio",
  ...ABAS_OBSERVATORIO.map((a) => `/observatorio${a.caminho}`),
  "/observatorio/institutions/60701190",
  "/observatorio/sectors/C",
  "/observatorio/products/consignado",
  "/observatorio/states/SP",
  "/observatorio/presenca/3550308",
];
const casca = (r: string) => (r === "/observatorio" ? "/observatorio/map" : r);

describe("1. a casca da aplicação tem o mesmo HTML dos componentes da plataforma", () => {
  it.each(ENDERECOS)("%s", (r) => {
    const endereco = casca(r);
    navegador.caminho = endereco;
    const indice = indiceCasca();
    const colecao = colecaoDaCasca(r);
    const nav = indice.navs[colecao];
    expect(nav, `${r}: navegação da coleção ${colecao} fora do índice`).toBeTruthy();
    expect(htmlNavegacao(nav, endereco)).toBe(renderToStaticMarkup(createElement(NavegacaoColecaoCliente, { nav: navegacaoDaColecao(colecao), caminho: endereco, idioma: "pt" })));
    // as duas páginas institucionais da aplicação não estão no registro (ficam fora da navegação dos observatórios), e o
    // RotuloContexto das páginas Next nunca as desenha; na aplicação o rótulo e a trilha dizem o nome delas (achado do Codex no #369)
    const institucional = ABAS_OBSERVATORIO.find((a) => ABAS_INSTITUCIONAIS_CREDITO.has(a.caminho) && endereco === `/observatorio${a.caminho}`);
    if (institucional) expect(htmlRotulo(indice, endereco, CLASSE_ROTULO_SPA)).toContain(`<span>Observatório da Economia · Crédito e sistema financeiro · ${institucional.titulo}</span>`);
    else expect(htmlRotulo(indice, endereco, CLASSE_ROTULO_SPA)).toBe(renderToStaticMarkup(createElement(RotuloContexto, { rota: endereco, className: CLASSE_ROTULO_SPA })));
    expect(htmlParaIrAlem(indice, endereco)).toBe(renderToStaticMarkup(createElement(ParaIrAlem, { mapa: mapaParaIrAlem() })));
    const extras = [...FIM_DA_PAGINA_CREDITO];
    expect(htmlRodapeColecao(nav, "<p>fontes</p>", extras)).toBe(renderToStaticMarkup(createElement(RodapeColecao, { colecao, extras }, createElement("p", null, "fontes"))));
  });
});

describe("2. index.html e casca.css saem do gerador", () => {
  const trecho = (ini: string, fim: string) => indexHtml.slice(indexHtml.indexOf(ini), indexHtml.indexOf(fim) + fim.length);

  it("a navegação, o fim de página e o rodapé da plataforma do index.html são os gerados (node scripts/barra-spa.mjs)", () => {
    expect(trecho(MARCADOR_NAV_INICIO, MARCADOR_NAV_FIM), "rode node scripts/barra-spa.mjs").toBe(htmlNavegacaoSpa());
    expect(trecho(MARCADOR_FIM_INICIO, MARCADOR_FIM_FIM), "rode node scripts/barra-spa.mjs").toBe(htmlFimSpa());
    expect(trecho(MARCADOR_RODAPE_INICIO, MARCADOR_RODAPE_FIM), "rode node scripts/barra-spa.mjs").toBe(htmlRodapePlataformaSpa(renderToStaticMarkup(createElement(Footer, {}))));
  });

  it("casca.css tem regra para toda classe que a casca desenha, presa a .casca", () => {
    const css = ler("public/obs/casca.css");
    const classes = new Set<string>();
    const pecas = [indexHtml, ...ENDERECOS.flatMap((r) => [htmlNavegacaoSpa(r), htmlFimSpa(r)])].join("\n");
    for (const m of pecas.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) classes.add(c);
    // classes da própria aplicação ou da barra (public/obs/styles.css, public/observatorios.css), não utilitárias
    const DE_FORA = /^(observatorio-credito|bp|bp-.*|obs-.*|trilha|sr-only|skip|view|active|tooltip|casca|nav-colecao|nav-colecao-caixa|group)$/;
    // as classes com regra em casca.css, sem o escape do CSS ("\\:" e "\\2c ")
    const comRegra = new Set(
      Array.from(css.matchAll(/\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[\w-])+)/g)).map((m) =>
        m[1].replace(/\\([0-9a-fA-F]{1,6}) ?/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, "$1"),
      ),
    );
    const desescapar = (c: string) => c.replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<");
    const faltam = Array.from(classes).filter((c) => !DE_FORA.test(c) && !comRegra.has(desescapar(c)));
    expect(faltam, "rode node scripts/barra-spa.mjs").toEqual([]);
    expect(css).toMatch(/\.casca \.flex \{/);
  });

  it("o index.html carrega a folha e o script da casca antes do app, com versão", () => {
    expect(indexHtml).toMatch(/<link rel="stylesheet" href="\/obs\/casca\.css\?v=\d+">/);
    expect(indexHtml.indexOf("/obs/casca.min.js?v=")).toBeGreaterThan(-1);
    expect(indexHtml.indexOf("/obs/casca.min.js?v=")).toBeLessThan(indexHtml.indexOf("/obs/app.min.js?v="));
    expect(ler(".gitignore")).toContain("/public/obs/casca.min.js");
    expect(ler("scripts/minify-obs.mjs")).toContain('await import("./casca-spa.mjs");');
  });
});

/** Uma página de cada coleção servida pela aplicação, a coleção dona e o destino que a navegação marca. */
const POR_COLECAO = [
  { rota: "/observatorio/credit", colecao: "Crédito e sistema financeiro", observatorio: "Observatório da Economia", atual: "/observatorio/credit", grupo: "Ciclo do crédito" },
  { rota: "/observatorio/payroll-lending-aging", colecao: "Dívida e crédito das famílias", observatorio: "Observatório das Famílias", atual: "/observatorio/payroll-lending-aging" },
  { rota: "/observatorio/pix", colecao: "Pagamentos", observatorio: "Observatório da Economia", atual: "/observatorio/pix" },
  { rota: "/observatorio/sectors", colecao: "Empresas e risco", observatorio: "Observatório da Economia", atual: "/observatorio/sectors" },
  { rota: "/observatorio/subnational-credit", colecao: "Dívida e crédito dos governos", observatorio: "Observatório das Contas Públicas", atual: "/observatorio/subnational-credit" },
  { rota: "/observatorio/interest-rates", colecao: "Crédito e sistema financeiro", observatorio: "Observatório da Economia", atual: "/observatorio/interest-rates", grupo: "Produtos e preços" },
];

/** Texto visível de um HTML: sem scripts, estilos, comentários e marcação. */
const visivel = (h: string) =>
  h
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<head[\s\S]*?<\/head>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");

function conferirCasca(h: string, c: (typeof POR_COLECAO)[number]) {
  // uma navegação só, a da coleção dona; nenhuma peça da casca antiga
  for (const antigo of ['class="sidebar"', 'id="sidebar"', "mobilebar", 'class="scrim"', "sidefoot", 'class="brand"', "themeToggle", "sbToggle", "menuBtn", 'id="tabs"', "navgroup", "Setor Elétrico →"])
    expect(h, `${c.rota}: ${antigo}`).not.toContain(antigo);
  expect(h, `${c.rota}: botão de navegação`).not.toMatch(/data-view=/);
  const navs = Array.from(h.matchAll(/<nav aria-label="Navegação d[ao] (?:coleção|observatório) ([^"]+)"/g)).map((m) => m[1]);
  expect(navs, `${c.rota}: navegações de coleção`).toEqual([c.colecao]);
  expect(h).toMatch(new RegExp(`<a aria-current="page" data-atual="" class="[^"]*" href="${c.atual}">`));
  if (c.grupo) expect(h).toMatch(new RegExp(`<a data-atual="" class="[^"]*" href="[^"]*">${c.grupo}<span class="sr-only"> \\(grupo da página atual\\)</span>`));
  // a trilha e o seletor dizem a mesma coleção
  expect(h).toContain(`<summary aria-label="Coleção atual: ${c.colecao}.`);
  // fim de página: "Para ir além", o rodapé da coleção e o rodapé da plataforma, depois do conteúdo
  const main = h.indexOf("</main>");
  expect(h.indexOf('aria-labelledby="para-ir-alem"')).toBeGreaterThan(main);
  expect(h).toContain(`Este painel está no <a class="underline decoration-linha underline-offset-4 hover:decoration-carvao" href="`);
  expect(h).toMatch(new RegExp(`<aside aria-label="${c.colecao}: fontes, método e parceria"`));
  expect(h.lastIndexOf("<footer")).toBeGreaterThan(h.indexOf("data-rodape-colecao"));
  for (const x of FIM_DA_PAGINA_CREDITO) expect(h).toContain(`href="${x.href}">${x.rotulo}</a>`);
  // datas na forma da plataforma: nada de AAAA-MM-DD nem UTC em texto visível
  const texto = visivel(h);
  expect(texto, `${c.rota}: data ISO`).not.toMatch(/\b\d{4}-\d{2}-\d{2}\b/);
  expect(texto, `${c.rota}: UTC`).not.toMatch(/\bUTC\b/);
  expect(h, `${c.rota}: cor de julgamento`).not.toMatch(/class="[^"]*\b(good|bad)\b/);
}

describe("3. o HTML que o servidor entrega para cada coleção servida pela aplicação", () => {
  it.each(POR_COLECAO)("$rota: navegação de $colecao, rótulo e fim de página da plataforma", (c) => {
    conferirCasca(servido(c.rota), c);
    // o rótulo que o pageHead põe acima do título diz o observatório e a coleção donos
    expect(htmlRotulo(indiceCasca(), c.rota, CLASSE_ROTULO_SPA)).toContain(`<span>${c.observatorio} · ${c.colecao}`);
  });

  it("o leitor que vem das Famílias vê Famílias na trilha, no seletor, no rótulo e na navegação", () => {
    const h = servido("/observatorio/payroll-lending-aging");
    expect(h).toMatch(/<nav aria-label="Você está em"[^>]*><ol><li><a href="\/perguntas\/familias">Observatórios<\/a><\/li><li><span aria-hidden="true">\/<\/span><a href="\/perguntas\/familias">Famílias<\/a>/);
    expect(h).toContain('aria-label="Navegação da coleção Dívida e crédito das famílias"');
    expect(h).not.toContain('aria-label="Navegação da coleção Crédito e sistema financeiro"');
    expect(htmlRotulo(indiceCasca(), "/observatorio/payroll-lending-aging")).toContain("Observatório das Famílias · Dívida e crédito das famílias");
  });

  it("as páginas institucionais têm trilha e rótulo com o nome delas", () => {
    const h = servido("/observatorio/about");
    expect(h).toMatch(/<li><span aria-hidden="true">\/<\/span><span aria-current="page">Sobre o Observatório<\/span><\/li><\/ol><\/nav>/);
    expect(htmlRotulo(indiceCasca(), "/observatorio/suggestions")).toContain("· Sugestões</span>");
  });

  it("a raiz da aplicação marca o Início do painel, no grupo Começar", () => {
    const h = servido("/observatorio");
    expect(h).toMatch(/<a aria-current="page" data-atual="" class="[^"]*" href="\/observatorio\/map">Início do painel</);
  });

  it("a navegação do Crédito tem os grupos da jornada só com as páginas que o Crédito mantém", () => {
    const nav = navegacaoDaColecao("credito");
    expect(nav.itens.map((i) => i.rotulo)).toEqual([
      "Início",
      "Quanto meu banco cobra?",
      "Começar",
      "Ciclo do crédito",
      "Instituições",
      "Produtos e preços",
      "Território",
      "Marcos regulatórios",
    ]);
    expect(nav.atalhos).toEqual({ metodo: "/observatorio-do-credito/metodologia", glossario: "/glossario" });
    const produtos = nav.itens.find((i) => i.rotulo === "Produtos e preços")!;
    expect(produtos.subpaginas!.map((s) => s.href)).toContain("/observatorio-do-credito/simulador-da-parcela");
  });
});

describe("4. o app.js usa a casca da plataforma", () => {
  it("sem a consulta de administração (o 403 do console), sem tema escuro aplicado, sem barra lateral", () => {
    expect(app).not.toContain("/api/admin/eu");
    expect(app).not.toMatch(/applyTheme|obc_theme|prefers-color-scheme: dark/);
    expect(app).not.toMatch(/closeSidebar|sidebarEl|navSincroniza|#tabs/);
    expect(indexHtml).toContain('<meta name="color-scheme" content="light">');
  });

  it("os links da casca abrem pelo roteador interno, só para endereços da aplicação, sem tecla modificadora", () => {
    const ini = app.indexOf('document.addEventListener("click", e => {\n  if (e.defaultPrevented || e.button !== 0');
    expect(ini).toBeGreaterThan(-1);
    const trecho = app.slice(ini, app.indexOf("\n});", ini));
    expect(trecho).toContain("e.metaKey || e.ctrlKey || e.shiftKey || e.altKey");
    expect(trecho).toContain('a.closest(".casca")');
    expect(trecho).toContain('url.pathname === BASE || url.pathname.startsWith(BASE + "/")');
    expect(trecho).toContain("history.pushState(");
    expect(trecho).toContain("showViewSilent(v)");
  });

  it("a cada página, a casca é refeita pelo índice que o servidor embute", () => {
    expect(app).toMatch(/function showViewSilent\(v\) \{\n  refazTrilha\(\);\n  refazCasca\(\);/);
    expect(app).toContain('document.getElementById("navColecaoIndice")');
    expect(app).toContain("C.htmlNavegacao(nav, caminho)");
    expect(app).toContain("C.htmlParaIrAlem(ind, caminho)");
    expect(app).toContain("window.CascaCredito.htmlRotulo(ind, caminhoDaVista(), \"text-mineral\")");
    expect(app).not.toContain("Este painel faz parte do");
  });
});

describe("5. no build, com sessão, a resposta real de uma página de cada coleção", () => {
  let servidor: ServidorProducao | null = null;
  beforeAll(async () => {
    if (temBuild) servidor = await subirServidor("credito-casca");
  }, 60_000);
  afterAll(async () => {
    await servidor?.parar();
  });

  it.each(POR_COLECAO)("$rota", async (c) => {
    if (!temBuild) {
      expect(exigirBuild, "EXIGIR_BUILD_HTML=1 e sem build: rode npm run build").toBe(false);
      return;
    }
    const { status, html } = await htmlDe(servidor!, c.rota, true);
    expect(status).toBe(200);
    conferirCasca(html, c);
    // sem sessão, a aplicação continua fechada
    expect((await htmlDe(servidor!, c.rota, false)).status).toBe(307);
  }, 30_000);
});

describe("6. tipografia, números, selos, datas e tokens da plataforma (PR 2 da Iniciativa 2)", () => {
  const styles = ler("public/obs/styles.css");
  const atlas = ler("public/obs/atlas.css");
  const obs = ler("public/observatorios.css");
  const semComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, " ");
  // as regras de observatorios.css que valem para a aplicação: as presas a .observatorio-credito e as do herói do Início do painel
  const regrasCredito = semComentarios(obs)
    .split("}")
    .filter((r) => /\.observatorio-credito|\.obs-credit-hero|\.obs-index-search/.test(r) && !/dominio-energia/.test(r))
    .join("}");

  it("nenhum corpo de letra fora da escala: todo font-size e todo atalho font leem uma variável --tipo-*", () => {
    const fora: string[] = [];
    for (const [nome, css] of [["styles.css", semComentarios(styles)], ["atlas.css", semComentarios(atlas)], ["observatorios.css (Crédito)", regrasCredito]]) {
      for (const m of css.matchAll(/font-size\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        // --svg-fs é o corpo que o app.js calcula para o texto do SVG não ficar abaixo de 12 px na tela (avaliacao-set26)
        if (!/^var\(--tipo-[a-z0-9-]+\)$/.test(v) && v !== "var(--svg-fs)" && v !== "inherit") fora.push(`${nome}: ${m[0]}`);
      }
      for (const m of css.matchAll(/(?:^|[;{\s])font\s*:\s*([^;}]+)/g)) {
        const v = m[1].trim();
        if (v !== "inherit" && !/var\(--tipo-[a-z0-9-]+\)/.test(v)) fora.push(`${nome}: font: ${v}`);
      }
    }
    for (const m of app.matchAll(/font-size:\s*([^;"'`}]+)/g)) {
      if (!/^var\(--tipo-[a-z0-9-]+\)$/.test(m[1].trim())) fora.push(`app.js: ${m[0]}`);
    }
    expect(fora).toEqual([]);
  });

  it("a escala própria (--fs-*) e os tamanhos soltos saíram", () => {
    for (const [nome, t] of [["styles.css", styles], ["observatorios.css", obs], ["app.js", app]]) {
      expect(semComentarios(t), nome).not.toMatch(/--fs-[a-z0-9]+/);
    }
    expect(styles).not.toMatch(/13\.5px|14\.5px/);
  });

  it("as variáveis da escala vêm de globals.css pelo tokens.css derivado", () => {
    const tokens = ler("public/obs/tokens.css");
    for (const v of ["rotulo", "meta", "tabela", "corpo", "lead", "h3", "h2", "h1", "numero-p", "numero-m", "numero-g"]) {
      expect(tokens, v).toContain(`--tipo-${v}:`);
    }
  });

  it("sem --cor-credito-* e sem tema escuro em nenhuma folha da aplicação", () => {
    for (const [nome, t] of [["styles.css", styles], ["atlas.css", atlas], ["observatorios.css", obs], ["tokens.css", ler("public/obs/tokens.css")], ["globals.css", ler("src/app/globals.css")]]) {
      expect(t, nome).not.toContain("--cor-credito-");
      expect(t, nome).not.toContain('data-theme="dark"');
    }
  });

  it("alta e queda sem cor de julgamento: nenhuma classe good/bad", () => {
    expect(app).not.toMatch(/\b(?:up|down) (?:good|bad)\b/);
    expect(app).not.toMatch(/"(?:good|bad)"/);
    expect(styles).not.toMatch(/\.(?:good|bad)\b/);
  });

  // as funções puras do app.js, sem o resto do arquivo
  const trecho = (de: string, ate: string) => app.slice(app.indexOf(de), app.indexOf(ate, app.indexOf(de)));
  const attr = (v: unknown) => String(v == null ? "" : v).replace(/<[^>]*>/g, "").replace(/"/g, "&quot;").replace(/\s+/g, " ").trim();
  const selos = new Function("attr", `${trecho("const BADGES = {", "/* Renderização única do chip")}; return { badge, seloHtml };`)(attr) as {
    badge: (k: string, t?: string) => string;
  };
  const faixa = new Function(
    "attr",
    `${trecho("const BADGES = {", "/* Renderização única do chip")}; ${trecho("function seloTexto(nat)", "const _ult = s =>")}; return { placar, abertura };`,
  )(attr) as { placar: (i: unknown[], n?: string) => string; abertura: (o: unknown) => string };

  it("o selo tem o glifo, o rótulo e a borda do SeloNatureza da plataforma", () => {
    const casos: [string, string, string][] = [
      ["observado", "●", "OBSERVADO"],
      ["calculado", "◆", "CALCULADO"],
      ["estimado", "◐", "ESTIMADO"],
      ["previsao", "◌", "PREVISTO"],
      ["cenario", "◇", "CENARIO"],
    ];
    for (const [k, glifo, nat] of casos) {
      const h = selos.badge(k);
      expect(h, k).toContain(`data-natureza="${nat}"`);
      expect(h, k).toContain(`<span aria-hidden="true">${glifo}</span>`);
      expect(h, k).toContain('<span class="sr-only">Natureza do dado: </span>');
    }
    expect(selos.badge("observado")).toContain("Observado</span>");
    expect(app).not.toMatch(/DADO (?:OBSERVADO|CALCULADO|ESTIMADO)"\]/);
    expect(styles).toMatch(/\.seal\.prev \{[^}]*border-style: dashed/);
    expect(styles).toMatch(/\.seal\.cen \{[^}]*border-style: dotted/);
    expect(styles).toMatch(/\.seal\.obs \{[^}]*var\(--cor-natureza-observado\)/);
  });

  it("a faixa de números tem a forma do NumeroIndicador: valor em serifa, linha de recorte e selo de natureza", () => {
    const h = faixa.placar([{ l: "Saldo", v: "R$ 6,8 tri", sub: "BCB/SGS ago/2026" }, { nat: "previsao", l: "Projeção", v: "3,4%", sub: "banda" }, { nat: null, l: "Data-base", v: "2T2026" }], "observado");
    expect(h.match(/data-numero-indicador=""/g)).toHaveLength(3);
    expect(h).toContain('role="group" aria-label="Saldo"');
    expect(h).toContain('<div class="kpi-linha"><span>BCB/SGS ago/2026</span><span class="seal obs" data-natureza="OBSERVADO"');
    expect(h).toContain('data-natureza="PREVISTO"');
    // a data-base não é medida: fica sem selo
    expect(h).toMatch(/aria-label="Data-base" data-numero-indicador=""><h4>/);
    expect(styles).toMatch(/\.big, \.card \.big,[^{]*\{[^}]*font-family: var\(--serif\)[^}]*tabular-nums/);
  });

  it("toda abertura e toda faixa de números declara a natureza dos seus números", () => {
    const aberturas = [...app.matchAll(/abertura\(\{\s*natureza: "(observado|calculado|estimado|previsao|cenario)"/g)].length;
    expect(aberturas).toBe([...app.matchAll(/\babertura\(\{/g)].length);
    const faixas = [...app.matchAll(/placar\(\[/g)].length;
    expect(faixas).toBeGreaterThan(0);
    expect([...app.matchAll(/\], "(?:observado|calculado|estimado)"\)/g)].length).toBe(faixas);
  });

  it("datas em português: mmm/aaaa, dd/mm/aaaa e a hora no horário de Brasília", () => {
    const datas = new Function(`const fmt = { d: ${trecho("d: iso =>", "\n").replace(/^d: /, "").replace(/,$/, "")}, my: ${trecho("my: iso =>", "\n").replace(/^my: /, "").replace(/,$/, "")} }; ${trecho("function dataTela(v)", "function rerenderCurrent")}; return { fmt, dataTela, dataHoraBrasilia };`)() as {
      fmt: { my: (v: string) => string };
      dataTela: (v: string) => string;
      dataHoraBrasilia: (v: string) => string;
    };
    expect(datas.fmt.my("2026-08")).toBe("ago/2026");
    expect(datas.fmt.my("2026-12-01")).toBe("dez/2026");
    expect(datas.dataTela("2026-08")).toBe("ago/2026");
    expect(datas.dataTela("2026-10-18")).toBe("18/10/2026");
    expect(datas.dataTela("2026-10-18T15:09:35+00:00")).toBe("18/10/2026 às 12:09 (horário de Brasília)");
    expect(datas.dataTela("2T2026")).toBe("2T2026");
  });

  it("a data que vem do dado também chega à tela na forma da plataforma, sem mexer em intervalo de anos, CNPJ ou código", () => {
    const fmtSrc = `const fmt = { d: ${trecho("d: iso =>", "\n").replace(/^d: /, "").replace(/,$/, "")}, my: ${trecho("my: iso =>", "\n").replace(/^my: /, "").replace(/,$/, "")} };`;
    const conv = new Function(`${fmtSrc} ${trecho("function dataTela(v)", "function rerenderCurrent")}; ${trecho("const DATA_ISO_TELA", "function datasNaTela(")}; return dataIsoNoTexto;`)() as (t: string) => string;
    expect(conv("SCR.data 2026-08 · janela 2025-08 a 2026-07")).toBe("SCR.data ago/2026 · janela ago/2025 a jul/2026");
    expect(conv("status até 2026-10-22.")).toBe("status até 22/10/2026.");
    expect(conv("execução de 2026-10-22T15:47:03+00:00")).toBe("execução de 22/10/2026 às 12:47 (horário de Brasília)");
    // intervalo de anos, CNPJ, código de série e ano fora de 1900 a 2099 ficam como estão
    expect(conv("quebra em 2020-21 e safra 2011-12")).toBe("quebra em 2020-21 e safra 2011-12");
    expect(conv("15.124.464/0001-87 · SGS 21082 · 2100-01")).toBe("15.124.464/0001-87 · SGS 21082 · 2100-01");
    // roda a cada página e a cada re-render, junto com os outros ajustes da camada de apresentação
    expect(trecho("function agendaAcessibilidade()", "window.addEventListener(\"resize\"")).toContain("datasNaTela(ativa);");
  });

  it("o app.js não escreve carimbo ISO nem UTC na tela; a hora do processamento fica em Fontes, datas e siglas", () => {
    const codigo = semComentarios(app).replace(/(^|[\s;{}(),])\/\/[^\n]*/g, "$1");
    expect(codigo).not.toContain("UTC");
    expect(codigo).not.toContain('.slice(0, 16).replace("T", " ")');
    const recorte = trecho("function linhaRecorte(", "function pageHead(o)");
    expect(recorte).toContain("Dados até <b>${dataTela(vint)}</b>");
    expect(recorte).toContain('<details class="ph-fontes"><summary>Fontes, datas e siglas</summary>');
    expect(recorte.indexOf("dataHoraBrasilia(geradoEm)")).toBeGreaterThan(-1);
    expect(trecho("function pageHead(o)", "window.pvSave")).toContain("${linhaRecorte(vint, o.fontes, meta.gerado_em)}");
  });

  it("os leads das páginas não têm seta nem travessão", () => {
    const leads = [...app.matchAll(/^\s*desc: (["`])(.*)\1,?$/gm)].map((m) => m[2]);
    expect(leads.length).toBeGreaterThan(20);
    expect(leads.filter((d) => /[→—–]/.test(d))).toEqual([]);
  });
});
