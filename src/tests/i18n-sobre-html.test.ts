import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse, parseFragment, serialize } from "parse5";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { PARES_DE_IDIOMA, type ParDeIdioma } from "@/lib/i18n-rotas";
import { attr, conteudo, elementos, filhos, links, meta, oculto, tag, texto, unico, vazamentos, type No } from "./suporte/i18n-dom";
import { documentoEstatico, modoDaPagina } from "./suporte/i18n-build";
import { criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";
import { verificarHomeParcial, verificarHeadHome } from "./suporte/i18n-home";

const APP = join(process.cwd(), ".next", "server", "app");
const EXIGIR = process.env.EXIGIR_BUILD_HTML === "1";
function documentos(ctx: TestContext) {
  if (!existsSync(APP) && !EXIGIR) ctx.skip("sem build local; rode npm run build para verificar o HTML PT/EN de Sobre");
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer .next/server/app").toBe(true);
  const arquivos = { pt: "sobre.html", en: "en/sobre.html", erro: "_not-found.html" };
  for (const arquivo of Object.values(arquivos)) {
    expect(existsSync(join(APP, arquivo)), `HTML ausente: ${arquivo}; gere um build completo`).toBe(true);
  }
  return { pt: parse(readFileSync(join(APP, arquivos.pt), "utf8")), en: parse(readFileSync(join(APP, arquivos.en), "utf8")), erro: parse(readFileSync(join(APP, arquivos.erro), "utf8")) };
}

describe("detector DOM de vazamento de idioma", () => {
  const aviso = '<p data-i18n-aviso lang="en">Portuguese only</p>';
  const ilha = '<div data-i18n-estado="portugues_marcado" lang="pt-BR"><p>Não são dados estimados: 1.234,50.</p></div>';

  it("aceita o fallback completo, preservando seus números, e reprova português fora dele", () => {
    expect(vazamentos(parseFragment(aviso + ilha), "en")).toEqual([]);
    const erros = vazamentos(parseFragment(aviso + ilha + "<p>São dados públicos.</p>"), "en");
    expect(erros).toEqual(["portugues-sem-marca: São dados públicos."]);
  });

  it("não aceita aviso escondido, idioma errado, marcador desconhecido ou aviso sem ilha", () => {
    for (const html of [
      ilha, aviso + ilha.replace('lang="pt-BR"', 'lang="en"'),
      aviso.replace("<p ", '<p hidden ') + ilha,
      aviso.replace("<p ", '<p class="sr-only" ') + ilha,
      '<div hidden>' + aviso + ilha + "</div>",
      aviso + ilha.replace("portugues_marcado", "ignorar"),
    ]) expect(vazamentos(parseFragment(html), "en"), html).toContain("ilha-sem-aviso-visivel-ou-idioma");
    expect(vazamentos(parseFragment(aviso), "en")).toContain("aviso-sem-ilha");
  });

  it("examina textos acessíveis e metadados que a ilha do corpo não cobre", () => {
    const html = '<html lang="en"><head><title>Dados oficiais</title><meta name="description" content="Informações públicas"></head>'
      + '<body><nav aria-label="Navegação principal"></nav>' + aviso + ilha + "</body></html>";
    const erros = vazamentos(parse(html), "en");
    expect(erros).toEqual(expect.arrayContaining([
      "portugues-sem-marca: Dados oficiais", "portugues-sem-marca: Informações públicas", "portugues-sem-marca: Navegação principal",
    ]));
  });

  it("exime somente o nome próprio completo, não o português ao redor", () => {
    // Nome sintético apenas para testar a fronteira da whitelist; o build usa o glossário real.
    const nomes = ["Instituto de Dados"];
    expect(vazamentos(parseFragment("<p>Instituto de Dados</p>"), "en", nomes)).toEqual([]);
    expect(vazamentos(parseFragment("<p>Instituto de Dados: não são estimativas.</p>"), "en", nomes))
      .toEqual(["portugues-sem-marca: Instituto de Dados: não são estimativas."]);
    expect(vazamentos(parseFragment("<p>SuperInstituto de Dados</p>"), "en", nomes))
      .toEqual(["portugues-sem-marca: SuperInstituto de Dados"]);
  });

  it("reprova inglês e chaves de catálogo na página portuguesa", () => {
    expect(vazamentos(parseFragment("<p>São dados oficiais.</p>"), "pt")).toEqual([]);
    expect(vazamentos(parseFragment('<button aria-label="Language">traducao.portugues_apenas</button>'), "pt"))
      .toEqual(["ingles-na-pagina-portuguesa: Language", "chave-na-interface: traducao.portugues_apenas"]);
    expect(vazamentos(parseFragment(aviso + ilha), "pt")).toContain("marcador-ingles-em-pagina-portuguesa");
  });
});

describe(`Sobre: HTML estático PT/EN (${EXIGIR ? "build obrigatório" : "build local opcional"})`, () => {
  it("gera os dois documentos estáticos com idioma correto e as mesmas fontes", (ctx) => {
    const { pt, en } = documentos(ctx);
    expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
    expect(attr(tag(en, "html"), "lang")).toBe("en");
    expect(attr(tag(pt, "html"), "class")).toBeTruthy();
    expect(attr(tag(en, "html"), "class")).toBe(attr(tag(pt, "html"), "class"));
    for (const doc of [pt, en]) expect(attr(tag(doc, "body"), "class")).toBe("min-h-screen bg-marfim text-carvao");
    expect(texto(tag(pt, "title"))).toBe("Sobre a Scrutiniums · Scrutiniums");
    expect(texto(tag(en, "title"))).toBe("Scrutiniums · Portuguese only");
    expect(meta(en, "description")).toEqual(["Portuguese only"]);
    expect(meta(pt, "description")).toEqual(["Quem mantém a plataforma, como ela se financia, que regras editoriais seguem as notas, como erros são corrigidos e registrados, como citar, sob qual licença e como entrar em contato."]);
  });

  it("preserva canonical, omite hreflangs do fallback e impede indexação inglesa", (ctx) => {
    const { pt, en } = documentos(ctx);
    for (const [doc, canonical] of [[pt, "https://scrutiniums.com/sobre"], [en, "https://scrutiniums.com/en/sobre"]] as const) {
      expect(links(doc, "canonical").map((e) => attr(e, "href"))).toEqual([canonical]);
      expect(links(doc, "alternate").filter((e) => attr(e, "hreflang") !== undefined)
        .map((e) => [attr(e, "hreflang"), attr(e, "href")]).sort()).toEqual([]);
    }
    expect(meta(en, "robots").some((valor) => /\bnoindex\b/.test(valor))).toBe(true);
  });

  it("preserva a imagem social PT e impede herança portuguesa no cartão EN", (ctx) => {
    const { pt, en } = documentos(ctx);
    expect(meta(pt, "og:locale")).toEqual(["pt_BR"]);
    expect(meta(pt, "og:locale:alternate")).toEqual(["en_US"]);
    expect(meta(en, "og:locale")).toEqual(["en_US"]);
    expect(meta(en, "og:locale:alternate")).toEqual(["pt_BR"]);
    for (const [doc, url] of [[pt, "https://scrutiniums.com/sobre"], [en, "https://scrutiniums.com/en/sobre"]] as const) {
      expect(meta(doc, "og:url")).toEqual([url]);
      expect(meta(doc, "og:site_name")).toEqual(["Scrutiniums"]);
      expect(meta(doc, "og:type")).toEqual(["website"]);
    }
    expect(meta(pt, "og:image").length).toBeGreaterThan(0);
    expect(meta(pt, "twitter:card")).toEqual(["summary_large_image"]);
    expect(meta(en, "twitter:card")).toEqual(["summary"]);
    for (const nome of ["og:image", "og:image:alt", "twitter:image", "twitter:image:alt"]) expect(meta(en, nome), nome).toEqual([]);
    for (const nome of ["og:title", "twitter:title"]) expect(meta(en, nome), nome).toEqual(["Scrutiniums · Portuguese only"]);
    for (const nome of ["og:description", "twitter:description"]) expect(meta(en, nome), nome).toEqual(["Portuguese only"]);
  });

  it("conserva integralmente texto, números, atributos e links PT dentro da ilha EN", (ctx) => {
    const { pt, en } = documentos(ctx);
    const corpoPt = tag(pt, "body");
    const corpoEn = tag(en, "body");
    const ilha = unico(corpoEn, (e) => attr(e, "data-i18n-estado") === "portugues_marcado", "ilha portuguesa");
    const aviso = unico(corpoEn, (e) => attr(e, "data-i18n-aviso") !== undefined, "aviso visível");
    expect(attr(ilha, "lang")).toBe("pt-BR");
    expect(attr(aviso, "lang")).toBe("en");
    expect(texto(aviso).trim()).toBe("Portuguese only");
    expect(oculto(aviso)).toBe(false);
    expect(conteudo(ilha)).toEqual(conteudo(corpoPt));
    expect(conteudo(corpoEn)).toHaveLength(2);
    expect(elementos(ilha).some((e) => e.tagName === "header")).toBe(true);
    expect(elementos(ilha).some((e) => e.tagName === "footer")).toBe(true);
    expect(texto(tag(ilha, "h1"))).toBe("Sobre a Scrutiniums");
    expect(elementos(corpoPt).some((e) => attr(e, "data-i18n-estado") !== undefined)).toBe(false);
    expect(vazamentos(en, "en")).toEqual([]);
    expect(vazamentos(pt, "pt")).toEqual([]);
  });

  it("a 404 estática tem head neutro, noindex e nenhuma irmã inexistente anunciada", (ctx) => {
    const { erro } = documentos(ctx);
    expect(texto(tag(erro, "title"))).toBe("404 · Scrutiniums");
    expect(meta(erro, "robots").some((valor) => /\bnoindex\b/.test(valor))).toBe(true);
    expect(links(erro, "canonical")).toEqual([]);
    expect(links(erro, "alternate").filter((e) => attr(e, "hreflang") !== undefined)).toEqual([]);
    for (const nome of ["description", "og:description", "twitter:description", "og:image", "twitter:image"]) {
      expect(meta(erro, nome), nome).toEqual([]);
    }
    expect(vazamentos(tag(erro, "head"), "en")).toEqual([]);
  });
});

let navegador: NavegadorI18n | undefined;
const dinamicos = new Map<string, { pt: No; en: No }>();
afterAll(async () => { await navegador?.fechar(); });

function exigirBuild(ctx?: TestContext) {
  if (!existsSync(APP) && !EXIGIR) {
    if (ctx) ctx.skip("sem build local; rode npm run build para verificar todos os pares declarados");
    return false;
  }
  expect(existsSync(APP), "EXIGIR_BUILD_HTML=1 requer .next/server/app").toBe(true);
  return true;
}

function documentosDoPar(ctx: TestContext, par: ParDeIdioma) {
  exigirBuild(ctx);
  const modoPt = modoDaPagina(par.pt);
  const modoEn = modoDaPagina(par.en);
  expect(modoEn, `modo de geração PT/EN: ${par.pt}`).toBe(modoPt);
  if (modoPt === "estatico") return { pt: documentoEstatico(par.pt), en: documentoEstatico(par.en) };
  if (modoPt === "dinamico") {
    const documentos = dinamicos.get(par.pt);
    if (!documentos) throw new Error(`Prova de navegador ausente: ${par.pt}`);
    return documentos;
  }
  throw new Error(`Modo de geração não suportado: ${String(modoPt)}`);
}

// Não filtrar por existência de HTML ou acesso público: toda declaração precisa de prova.
describe.each(PARES_DE_IDIOMA)("HTML de cada irmã declarada: $pt ↔ $en", (par) => {
  beforeAll(async () => {
    if (!exigirBuild()) return;
    const modoPt = modoDaPagina(par.pt);
    const modoEn = modoDaPagina(par.en);
    expect(modoEn, `modo de geração PT/EN: ${par.pt}`).toBe(modoPt);
    if (modoPt === "dinamico") {
      if (par.pt !== "/" || par.en !== "/en") throw new Error(`Par dinâmico sem adaptador de cenário: ${par.pt}`);
      navegador ??= await criarNavegadorI18n();
      dinamicos.set(par.pt, { pt: parse(await navegador.documento(par.pt)), en: parse(await navegador.documento(par.en)) });
    }
  }, 90_000);

  it("comprova modo de geração, idioma documental e metadados recíprocos", (ctx) => {
    const { pt, en } = documentosDoPar(ctx, par);
    const base = "https://scrutiniums.com";
    const url = (caminho: string) => caminho === "/" ? base : base + caminho;
    const alternates = par.conteudo === "portugues_marcado" ? [] : [["pt-BR", url(par.pt)], ["en", url(par.en)], ["x-default", url(par.pt)]];
    expect(attr(tag(pt, "html"), "lang")).toBe("pt-BR");
    expect(attr(tag(en, "html"), "lang")).toBe("en");
    expect(attr(tag(pt, "html"), "class")).toBeTruthy();
    expect(attr(tag(en, "html"), "class")).toBe(attr(tag(pt, "html"), "class"));
    for (const [doc, caminho, locale, outroLocale] of [[pt, par.pt, "pt_BR", "en_US"], [en, par.en, "en_US", "pt_BR"]] as const) {
      expect(attr(tag(doc, "body"), "class")).toBe("min-h-screen bg-marfim text-carvao");
      expect(links(doc, "canonical").map((e) => attr(e, "href")), caminho).toEqual([url(caminho)]);
      expect(links(doc, "alternate").filter((e) => attr(e, "hreflang") !== undefined)
        .map((e) => [attr(e, "hreflang"), attr(e, "href")]).sort(), caminho).toEqual([...alternates].sort());
      expect(meta(doc, "og:locale"), caminho).toEqual([locale]);
      expect(meta(doc, "og:locale:alternate"), caminho).toEqual([outroLocale]);
      expect(meta(doc, "og:url"), caminho).toEqual([url(caminho)]);
    }
    if (par.conteudo === "parcialmente_traduzido") {
      expect(par.pt).toBe("/");
      verificarHeadHome(pt, en);
      return;
    }
    expect(par.conteudo).toBe("portugues_marcado");
    expect(meta(en, "robots").some((valor) => /\bnoindex\b/.test(valor))).toBe(true);
    expect(meta(en, "og:site_name")).toEqual(["Scrutiniums"]);
    expect(meta(en, "og:type")).toEqual(["website"]);
    expect(texto(tag(en, "title"))).toBe("Scrutiniums · Portuguese only");
    expect(meta(en, "description")).toEqual(["Portuguese only"]);
    expect(meta(en, "twitter:card")).toEqual(["summary"]);
    for (const nome of ["og:image", "og:image:alt", "twitter:image", "twitter:image:alt"]) expect(meta(en, nome), nome).toEqual([]);
    for (const nome of ["og:title", "twitter:title"]) expect(meta(en, nome), nome).toEqual(["Scrutiniums · Portuguese only"]);
    for (const nome of ["og:description", "twitter:description"]) expect(meta(en, nome), nome).toEqual(["Portuguese only"]);
  });

  it("preserva todo o corpo PT e procura vazamentos nos dois documentos inteiros", (ctx) => {
    const { pt, en } = documentosDoPar(ctx, par);
    if (par.conteudo === "parcialmente_traduzido") {
      expect(par.pt).toBe("/");
      verificarHomeParcial(pt, en);
      return;
    }
    expect(par.conteudo).toBe("portugues_marcado");
    const corpoPt = tag(pt, "body");
    const corpoEn = tag(en, "body");
    const ilha = unico(corpoEn, (e) => attr(e, "data-i18n-estado") === "portugues_marcado", `ilha portuguesa em ${par.en}`);
    const aviso = unico(corpoEn, (e) => attr(e, "data-i18n-aviso") !== undefined, `aviso em ${par.en}`);
    expect(attr(ilha, "lang")).toBe("pt-BR");
    expect(attr(aviso, "lang")).toBe("en");
    expect(texto(aviso).trim()).toBe("Portuguese only");
    expect(oculto(aviso)).toBe(false);
    expect(oculto(ilha)).toBe(false);
    expect(conteudo(ilha), par.en).toEqual(conteudo(corpoPt));
    expect(conteudo(corpoEn)).toHaveLength(2);
    expect(elementos(corpoPt).some((e) => attr(e, "data-i18n-estado") !== undefined)).toBe(false);
    expect(vazamentos(en, "en"), par.en).toEqual([]);
    expect(vazamentos(pt, "pt"), par.pt).toEqual([]);
  });

  if (par.conteudo === "parcialmente_traduzido") {
    it("recusa número alterado, marca escondida, chave aparente e texto não declarado no DOM real", (ctx) => {
      const { pt, en } = documentosDoPar(ctx, par);
      if (!("childNodes" in en)) throw new Error("Documento inglês sem árvore DOM");
      const original = serialize(en);
      const comNumero = parse(original);
      const indice = unico(comNumero, (e) => attr(e, "data-i18n-regiao") === "home-indice", "índice");
      const numero = elementos(indice).flatMap(filhos).find((no) => "value" in no && /^\d+$/.test(no.value));
      if (!numero || !("value" in numero)) throw new Error("Índice sem número para a prova de adulteração");
      numero.value = String(Number(numero.value) + 1);
      expect(() => verificarHomeParcial(pt, comNumero)).toThrow();
      const semAvisoVisivel = parse(original);
      const aviso = elementos(semAvisoVisivel).find((e) => attr(e, "data-i18n-aviso") !== undefined)!;
      aviso.attrs.push({ name: "hidden", value: "" });
      expect(() => verificarHomeParcial(pt, semAvisoVisivel)).toThrow();
      const comChave = parse(original);
      const titulo = unico(comChave, (e) => attr(e, "data-i18n-regiao") === "home-titulo", "título");
      const primeira = filhos(titulo).find((no) => "value" in no);
      if (!primeira || !("value" in primeira)) throw new Error("Título sem texto");
      primeira.value = "home.hero.titulo_inicio";
      expect(() => verificarHomeParcial(pt, comChave)).toThrow();
      const comTextoExtra = parse(original);
      tag(comTextoExtra, "body").childNodes.push(...parseFragment("<p>Additional sentence.</p>").childNodes);
      expect(() => verificarHomeParcial(pt, comTextoExtra)).toThrow();
    });
  }
});

describe("carregamento obrigatório do HTML de cada irmã", () => {
  it.each([
    { caso: "HTML faltante", compilada: true, prerender: true, html: false, erro: "HTML ausente: /en/sobre" },
    { caso: "página dinâmica com HTML antigo", compilada: true, prerender: false, html: true, erro: "integrar verificação HTTP" },
    { caso: "módulo compilado faltante", compilada: false, prerender: true, html: true, erro: "Página compilada ausente: /en/sobre" },
  ])("recusa $caso mesmo quando a origem PT está completa", ({ compilada, prerender, html, erro }) => {
    const build = mkdtempSync(join(tmpdir(), "i18n-html-par-"));
    const escrever = (path: string, valor: string) => {
      const arquivo = join(build, path);
      mkdirSync(dirname(arquivo), { recursive: true });
      writeFileSync(arquivo, valor);
    };
    try {
      escrever("server/app-paths-manifest.json", JSON.stringify({ "/sobre/page": "app/sobre/page.js", "/en/sobre/page": "app/en/sobre/page.js" }));
      escrever("prerender-manifest.json", JSON.stringify({ routes: { "/sobre": {}, ...(prerender ? { "/en/sobre": {} } : {}) } }));
      escrever("server/app/sobre/page.js", "export default function Pagina() {}");
      escrever("server/app/sobre.html", '<html lang="pt-BR"><body><h1>Sobre</h1></body></html>');
      if (compilada) escrever("server/app/en/sobre/page.js", "export default function Pagina() {}");
      if (html) escrever("server/app/en/sobre.html", '<html lang="en"><body><h1>About</h1></body></html>');
      expect(texto(tag(documentoEstatico("/sobre", build), "h1"))).toBe("Sobre");
      expect(() => documentoEstatico("/en/sobre", build)).toThrow(erro);
    } finally { rmSync(build, { recursive: true, force: true }); }
  });
});
