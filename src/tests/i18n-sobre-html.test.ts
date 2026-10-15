import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parse, parseFragment, serialize } from "parse5";
import { afterAll, beforeAll, describe, expect, it, type TestContext } from "vitest";
import { PARES_DE_IDIOMA, type ParDeIdioma } from "@/lib/i18n-rotas";
import { attr, conteudo, elementos, filhos, links, meta, oculto, tag, texto, unico, vazamentos, type Elemento, type No } from "./suporte/i18n-dom";
import { documentoEstatico, modoDaPagina } from "./suporte/i18n-build";
import { criarNavegadorI18n, type NavegadorI18n } from "./suporte/i18n-browser";
import { INDICE_HOME, verificarHomeParcial, verificarHeadHome } from "./suporte/i18n-home";
import { cenarioDinamico, verificarFallbackDinamico, type CapturaAnunciador } from "./suporte/i18n-dinamico";
import { ACESSO, listaObservatorios, observatoriosPorExtenso } from "@/lib/acesso";

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
type DocumentosDinamicos = { modo: "dinamico"; pt: No; en: No; anunciadorPt: CapturaAnunciador; anunciadorEn: CapturaAnunciador };
const dinamicos = new Map<string, DocumentosDinamicos>();
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
  if (modoPt === "estatico") return { modo: "estatico" as const, pt: documentoEstatico(par.pt), en: documentoEstatico(par.en) };
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
      expect(cenarioDinamico(par.pt)).toEqual({ pt: par.pt, idioma: "pt-BR" });
      expect(cenarioDinamico(par.en)).toEqual({ pt: par.pt, idioma: "en" });
      navegador ??= await criarNavegadorI18n();
      const fixture = par.pt === "/entrar/sms/verificar" ? { loginSms: "valido" as const } : undefined;
      const pt = await navegador.documento(par.pt, fixture);
      const en = await navegador.documento(par.en, fixture);
      dinamicos.set(par.pt, { modo: "dinamico", pt: parse(pt.html), en: parse(en.html), anunciadorPt: pt.anunciador, anunciadorEn: en.anunciador });
    }
  }, 90_000);

  it("comprova modo de geração, idioma documental e metadados recíprocos", (ctx) => {
    const documentos = documentosDoPar(ctx, par);
    const { pt, en } = documentos;
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
    if (documentos.modo === "dinamico") {
      const originais: Record<string, { titulo: string; descricao: string }> = {
        "/glossario": { titulo: "Glossário", descricao: "Definições, fórmulas, fontes e limitações de todos os indicadores da Scrutiniums. Fonte única de nomes e definições da plataforma." },
        "/termos": { titulo: "Termos de uso", descricao: "Condições de uso da plataforma Scrutiniums: acesso gratuito mediante cadastro, caráter estritamente informativo, isenção de garantias e limitação de responsabilidade." },
        "/privacidade": { titulo: "Política de privacidade", descricao: "Quais dados a Scrutiniums coleta, por que coleta, por quanto tempo guarda e como você exerce seus direitos." },
        "/entrar": { titulo: "Entrar", descricao: `Plataforma gratuita de inteligência analítica baseada em dados verificáveis: ${observatoriosPorExtenso()} (${listaObservatorios()}), com bases públicas, registros oficiais e método declarado. ${ACESSO.curto}` },
        "/cadastro": { titulo: "Crie seu acesso", descricao: `Plataforma gratuita de inteligência analítica baseada em dados verificáveis: ${observatoriosPorExtenso()} (${listaObservatorios()}), com bases públicas, registros oficiais e método declarado. ${ACESSO.curto}` },
        "/entrar/sms": { titulo: "Entrar com código por SMS", descricao: `Plataforma gratuita de inteligência analítica baseada em dados verificáveis: ${observatoriosPorExtenso()} (${listaObservatorios()}), com bases públicas, registros oficiais e método declarado. ${ACESSO.curto}` },
        "/entrar/sms/verificar": { titulo: "Código de acesso", descricao: `Plataforma gratuita de inteligência analítica baseada em dados verificáveis: ${observatoriosPorExtenso()} (${listaObservatorios()}), com bases públicas, registros oficiais e método declarado. ${ACESSO.curto}` },
      };
      expect(originais[par.pt], "head PT original de cada cenário dinâmico").toBeDefined();
      expect(texto(tag(pt, "title"))).toBe(`${originais[par.pt].titulo} · Scrutiniums`);
      expect(meta(pt, "description")).toEqual([originais[par.pt].descricao]);
      expect(meta(pt, "og:site_name")).toEqual(["Scrutiniums"]);
      expect(meta(pt, "og:type")).toEqual(["website"]);
      expect(meta(pt, "twitter:card")).toEqual(["summary_large_image"]);
      for (const prefixo of ["og", "twitter"]) {
        expect(meta(pt, `${prefixo}:title`)).toEqual([`Scrutiniums: ${listaObservatorios()}`]);
        expect(meta(pt, `${prefixo}:description`)).toEqual([`${observatoriosPorExtenso(true)}, a mesma filosofia de evidência: dados oficiais, fonte e data em cada número, metodologia aberta. Gratuito. ${ACESSO.curto}`]);
        expect(meta(pt, `${prefixo}:image`)).toEqual(["https://scrutiniums.com/opengraph-image?b5ad3ed804227d3b"]);
        expect(meta(pt, `${prefixo}:image:alt`)).toEqual(["Scrutiniums: observatórios com dados oficiais, fonte e data em cada número"]);
        expect(meta(pt, `${prefixo}:image:type`)).toEqual(["image/png"]);
        expect(meta(pt, `${prefixo}:image:width`)).toEqual(["1200"]);
        expect(meta(pt, `${prefixo}:image:height`)).toEqual(["630"]);
      }
    }
  });

  it("preserva todo o corpo PT e procura vazamentos nos dois documentos inteiros", (ctx) => {
    const documentos = documentosDoPar(ctx, par);
    const { pt, en } = documentos;
    if (par.conteudo === "parcialmente_traduzido") {
      expect(par.pt).toBe("/");
      verificarHomeParcial(pt, en);
      return;
    }
    expect(par.conteudo).toBe("portugues_marcado");
    if (documentos.modo === "dinamico") {
      if (par.pt === "/entrar" || par.pt === "/cadastro" || par.pt === "/entrar/sms") {
        verificarFallbackDinamico(pt, en, documentos.anunciadorPt, documentos.anunciadorEn, { caminho: par.pt, estado: "inicial" });
      } else if (par.pt === "/entrar/sms/verificar") {
        verificarFallbackDinamico(pt, en, documentos.anunciadorPt, documentos.anunciadorEn, { caminho: par.pt, estado: "inicial", contador: "liberado" });
      } else {
        verificarFallbackDinamico(pt, en, documentos.anunciadorPt, documentos.anunciadorEn);
      }
      return;
    }
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

    it("recusa adulterações de texto, estrutura e visibilidade do rótulo e dos benefícios traduzidos", (ctx) => {
      const { pt, en } = documentosDoPar(ctx, par);
      if (!("childNodes" in en)) throw new Error("Documento inglês sem árvore DOM");
      verificarHomeParcial(pt, en);
      const original = serialize(en);
      const rotulo = (doc: No) => unico(doc, (e) => attr(e, "data-i18n-regiao") === "home-rotulo", "rótulo traduzido");
      const beneficios = (doc: No) => unico(doc, (e) => attr(e, "data-i18n-regiao") === "home-beneficios", "benefícios traduzidos");
      const itens = (doc: No) => {
        const encontrados = elementos(beneficios(doc)).filter((e) => e.tagName === "li");
        expect(encontrados).toHaveLength(3);
        return encontrados;
      };
      const substituirTexto = (no: Elemento, valor: string) => {
        const trecho = filhos(no).find((filho) => "value" in filho && filho.value.trim() !== "");
        if (!trecho || !("value" in trecho)) throw new Error("Região sem texto direto para adulteração");
        trecho.value = valor;
      };
      const adulteracoes: [string, (doc: No) => void][] = [
        ["rótulo em português", (doc) => substituirTexto(rotulo(doc), "Observatórios de dados públicos")],
        ["chave aparente no rótulo", (doc) => substituirTexto(rotulo(doc), "home.hero.rotulo")],
        ["benefício trocado por outro", (doc) => substituirTexto(itens(doc)[0], "Free, with no subscription")],
        ["texto de benefício omitido", (doc) => substituirTexto(itens(doc)[1], "")],
        ["classe da lista alterada", (doc) => {
          const classe = beneficios(doc).attrs.find((a) => a.name === "class");
          if (!classe) throw new Error("Lista de benefícios sem classes");
          classe.value += " classe-extra";
        }],
        ["ordem dos itens alterada", (doc) => {
          const lista = beneficios(doc), [primeiro, segundo] = itens(doc);
          const a = lista.childNodes.indexOf(primeiro), b = lista.childNodes.indexOf(segundo);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(b).toBeGreaterThanOrEqual(0);
          [lista.childNodes[a], lista.childNodes[b]] = [segundo, primeiro];
        }],
        ["item removido da lista", (doc) => {
          const lista = beneficios(doc), ultimo = itens(doc)[2];
          lista.childNodes = lista.childNodes.filter((no) => no !== ultimo);
        }],
        ["span decorativo removido", (doc) => {
          const primeiro = itens(doc)[0], decoracao = tag(primeiro, "span");
          primeiro.childNodes = primeiro.childNodes.filter((no) => no !== decoracao);
        }],
        ["benefícios escondidos", (doc) => beneficios(doc).attrs.push({ name: "hidden", value: "" })],
      ];
      for (const [nome, adulterar] of adulteracoes) {
        const copia = parse(original);
        adulterar(copia);
        expect(serialize(copia), nome).not.toBe(original);
        expect(() => verificarHomeParcial(pt, copia), nome).toThrow();
      }
      expect(serialize(en)).toBe(original);
    });

    it("recusa quantidade, token, texto e estrutura adulterados na introdução antes de reconstruir o português", (ctx) => {
      const { pt, en } = documentosDoPar(ctx, par);
      if (!("childNodes" in en) || !("childNodes" in pt)) throw new Error("Documentos da home sem árvore DOM");
      verificarHomeParcial(pt, en);
      const original = serialize(en), originalPt = serialize(pt);
      const introducao = (doc: No) => unico(doc, (e) => attr(e, "data-i18n-regiao") === "home-introducao", "introdução traduzida");
      const substituirTrecho = (doc: No, antes: string, depois: string) => {
        const no = filhos(introducao(doc)).find((filho) => "value" in filho && filho.value.includes(antes));
        if (!no || !("value" in no)) throw new Error(`Introdução sem trecho para adulteração: ${antes}`);
        no.value = no.value.replace(antes, depois);
      };
      const adulteracoes: [string, (doc: No) => void][] = [
        ["quantidade por extenso divergente do registro", (doc) => substituirTrecho(doc, "Seven observatories", "Eight observatories")],
        ["quantidade numérica divergente do registro", (doc) => substituirTrecho(doc, "Seven observatories", "8 observatories")],
        ["última frase omitida", (doc) => substituirTrecho(doc,
          " Each dashboard identifies the data source, the reference period and what the data cannot establish.", "")],
        ["placeholder não resolvido", (doc) => substituirTrecho(doc, "Seven observatories", "{observatorios}")],
        ["classe da introdução alterada", (doc) => {
          const classe = introducao(doc).attrs.find((a) => a.name === "class");
          if (!classe) throw new Error("Introdução sem classes");
          classe.value += " classe-extra";
        }],
        ["atributo não declarado", (doc) => introducao(doc).attrs.push({ name: "data-extra", value: "indevido" })],
        ["introdução escondida", (doc) => introducao(doc).attrs.push({ name: "hidden", value: "" })],
        ["introdução movida antes do título", (doc) => {
          const paragrafo = introducao(doc), pai = paragrafo.parentNode;
          if (!pai || !("childNodes" in pai)) throw new Error("Introdução sem pai");
          const titulo = tag(pai, "h1");
          pai.childNodes = pai.childNodes.filter((no) => no !== paragrafo);
          const posicao = pai.childNodes.indexOf(titulo);
          expect(posicao).toBeGreaterThanOrEqual(0);
          pai.childNodes.splice(posicao, 0, paragrafo);
        }],
      ];
      for (const [nome, adulterar] of adulteracoes) {
        const copia = parse(original);
        adulterar(copia);
        expect(serialize(copia), nome).not.toBe(original);
        expect(() => verificarHomeParcial(pt, copia), nome).toThrow();
      }
      expect(serialize(en), "comparação e negativos não alteram o DOM inglês original").toBe(original);
      expect(serialize(pt), "reconstrução não altera o DOM português original").toBe(originalPt);
    });

    it("recusa números, nomes, destinos, imagens e estrutura adulterados no índice traduzido", (ctx) => {
      const { pt, en } = documentosDoPar(ctx, par);
      if (!("childNodes" in en) || !("childNodes" in pt)) throw new Error("Documentos da home sem árvore DOM");
      verificarHomeParcial(pt, en);
      const original = serialize(en), originalPt = serialize(pt);
      const indice = (doc: No) => unico(doc, (e) => attr(e, "data-i18n-regiao") === "home-indice", "índice traduzido");
      const cartao = (doc: No, id = "credito") => {
        const anchor = unico(indice(doc), (e) => e.tagName === "a" && attr(e, "href") === `#obs-${id}`, `cartão ${id}`);
        const trechos = filhos(anchor).filter((e): e is Elemento => "tagName" in e);
        expect(trechos).toHaveLength(4);
        const spans = filhos(trechos[3]).filter((e): e is Elemento => "tagName" in e);
        expect(spans).toHaveLength(3);
        const valor = unico(spans[2], (e) => e !== spans[2] && e.tagName === "span", "valor da contagem");
        return { anchor, imagem: trechos[0], nome: spans[1], contagem: spans[2], valor };
      };
      const substituirTexto = (no: Elemento, transformar: (valor: string) => string) => {
        const partes = filhos(no).filter((filho) => "value" in filho && filho.value.trim() !== "");
        expect(partes, "um trecho direto antes da adulteração").toHaveLength(1);
        const trecho = partes[0];
        if (!("value" in trecho)) throw new Error("Índice sem texto direto para adulteração");
        const antes = trecho.value;
        trecho.value = transformar(antes);
        expect(trecho.value, "mutante precisa alterar o trecho selecionado").not.toBe(antes);
      };
      const atributo = (no: Elemento, nome: string, valor: string) => {
        const existente = no.attrs.find((a) => a.name === nome);
        if (existente) existente.value = valor;
        else no.attrs.push({ name: nome, value: valor });
      };
      const adulteracoes: [string, (doc: No) => void][] = [
        ["quantidade simples do Crédito", (doc) => substituirTexto(cartao(doc).valor, (valor) => {
          expect(valor).toBe(INDICE_HOME.find((d) => d.id === "credito")!.en.valor);
          return `${valor}0`;
        })],
        ...["contas", "saneamento"].flatMap((id): [string, (doc: No) => void][] => [
          [`numerador de ${id}`, (doc) => substituirTexto(cartao(doc, id).valor, (valor) => {
            expect(valor).toBe(INDICE_HOME.find((d) => d.id === id)!.en.valor);
            return valor.replace(/^[\d,]+/, (n) => `${n}0`);
          })],
          [`denominador de ${id}`, (doc) => substituirTexto(cartao(doc, id).valor, (valor) => {
            expect(valor).toBe(INDICE_HOME.find((d) => d.id === id)!.en.valor);
            return valor.replace(/[\d,]+$/, (n) => `${n}0`);
          })],
        ]),
        ["unidade trocada", (doc) => substituirTexto(cartao(doc).contagem, () => " published sections")],
        ["conectivo português", (doc) => substituirTexto(cartao(doc, "contas").valor, (v) => v.replace(" of ", " de "))],
        ["token parcial residual", (doc) => substituirTexto(cartao(doc, "saneamento").valor, () => "{publicados} of {total}")],
        ["nome de produto traduzido", (doc) => substituirTexto(cartao(doc).nome, () => "Credit")],
        ["idioma do nome ausente", (doc) => {
          const nome = cartao(doc).nome;
          expect(attr(nome, "lang")).toBe("pt-BR");
          nome.attrs = nome.attrs.filter((a) => a.name !== "lang");
        }],
        ["idioma aplicado à contagem", (doc) => atributo(cartao(doc).contagem, "lang", "pt-BR")],
        ["destino alterado", (doc) => atributo(cartao(doc).anchor, "href", "/observatorio-do-credito")],
        ["cartão removido", (doc) => {
          const lista = tag(indice(doc), "ol");
          const itens = filhos(lista).filter((e): e is Elemento => "tagName" in e);
          expect(itens).toHaveLength(7);
          lista.childNodes = lista.childNodes.filter((no) => no !== itens[0]);
        }],
        ["cartões reordenados", (doc) => {
          const lista = tag(indice(doc), "ol");
          const itens = filhos(lista).filter((e): e is Elemento => "tagName" in e);
          const a = lista.childNodes.indexOf(itens[0]), b = lista.childNodes.indexOf(itens[1]);
          expect(a).toBeGreaterThanOrEqual(0);
          expect(b).toBeGreaterThanOrEqual(0);
          [lista.childNodes[a], lista.childNodes[b]] = [itens[1], itens[0]];
        }],
        ["imagem trocada", (doc) => atributo(cartao(doc).imagem, "src", "/home/energia.webp")],
        ["largura da imagem alterada", (doc) => atributo(cartao(doc).imagem, "width", "481")],
        ["altura da imagem alterada", (doc) => atributo(cartao(doc).imagem, "height", "601")],
        ["imagem decorativa com alt extra", (doc) => atributo(cartao(doc).imagem, "alt", "Additional illustration")],
        ["foco do Gás alterado", (doc) => atributo(cartao(doc, "gas").imagem, "style", "object-position:50% 50%")],
        ["classe do cartão alterada", (doc) => {
          const anchor = cartao(doc).anchor;
          atributo(anchor, "class", `${attr(anchor, "class")} classe-extra`);
        }],
        ["atributo extra no índice", (doc) => atributo(indice(doc), "data-extra", "indevido")],
        ["nome com prosa adicional", (doc) => substituirTexto(cartao(doc).nome, (v) => `${v}: não são dados`)],
        ["nome com elemento adicional", (doc) => cartao(doc).nome.childNodes.push(...parseFragment("<span>Additional text</span>").childNodes)],
        ["texto extra no índice", (doc) => indice(doc).childNodes.push(...parseFragment("<p>Additional sentence.</p>").childNodes)],
        ["ressalva omitida", (doc) => {
          const nav = indice(doc), ressalva = tag(nav, "p");
          nav.childNodes = nav.childNodes.filter((no) => no !== ressalva);
        }],
        ["ressalva alterada", (doc) => substituirTexto(tag(indice(doc), "p"), () => "The illustrations represent specific places.")],
        ["nome acessível português", (doc) => atributo(indice(doc), "aria-label", "Índice dos observatórios")],
        ["índice escondido", (doc) => atributo(indice(doc), "hidden", "")],
        ["nome escondido", (doc) => atributo(cartao(doc).nome, "hidden", "")],
        ["quantidade escondida", (doc) => atributo(cartao(doc).valor, "hidden", "")],
        ["wrapper extra ao redor do nav", (doc) => {
          const nav = indice(doc), pai = nav.parentNode;
          if (!pai || !("childNodes" in pai)) throw new Error("Índice sem pai");
          const wrapper = tag(parseFragment("<div></div>"), "div");
          const posicao = pai.childNodes.indexOf(nav);
          expect(posicao).toBeGreaterThanOrEqual(0);
          pai.childNodes[posicao] = wrapper;
          wrapper.parentNode = pai;
          wrapper.childNodes.push(nav);
          nav.parentNode = wrapper;
        }],
      ];
      for (const [nome, adulterar] of adulteracoes) {
        const copia = parse(original);
        adulterar(copia);
        expect(serialize(copia), nome).not.toBe(original);
        expect(() => verificarHomeParcial(pt, copia), nome).toThrow();
      }
      expect(serialize(en), "negativos preservam o documento EN original").toBe(original);
      expect(serialize(pt), "prova do índice preserva o documento PT original").toBe(originalPt);
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
