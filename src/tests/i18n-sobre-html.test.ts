import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse, parseFragment, type DefaultTreeAdapterMap } from "parse5";
import { describe, expect, it, type TestContext } from "vitest";
import glossario from "../../config/glossario-en.json";

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
type Forma = string | { tag: string; atributos: [string, string][]; filhos: Forma[] };
const attr = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
const filhos = (no: No): No[] => "childNodes" in no ? no.childNodes : [];
const tecnicos = new Set(["script", "style", "template"]);
const atributosHumanos = ["aria-label", "aria-description", "title", "alt", "placeholder"];
function elementos(no: No): Elemento[] {
  return [...("tagName" in no ? [no] : []), ...filhos(no).flatMap(elementos)];
}
function texto(no: No): string {
  if ("tagName" in no && tecnicos.has(no.tagName)) return "";
  return "value" in no ? no.value : filhos(no).map(texto).join("");
}
function unico(no: No, predicado: (e: Elemento) => boolean, descricao: string): Elemento {
  const encontrados = elementos(no).filter(predicado);
  expect(encontrados, descricao).toHaveLength(1);
  return encontrados[0];
}
const tag = (no: No, nome: string) => unico(no, (e) => e.tagName === nome, nome);
function meta(no: No, nome: string): string[] {
  return elementos(no).filter((e) => e.tagName === "meta"
    && (attr(e, "name") === nome || attr(e, "property") === nome)).map((e) => attr(e, "content") ?? "");
}
function links(no: No, rel: string): Elemento[] {
  return elementos(no).filter((e) => e.tagName === "link" && attr(e, "rel") === rel);
}

/** Preserva texto, espaços, números, atributos e destinos; ignora só transporte React. */
function conteudo(no: No): Forma[] {
  const saida: Forma[] = [];
  for (const filho of filhos(no)) {
    if ("value" in filho) {
      if (typeof saida[saida.length - 1] === "string") {
        saida[saida.length - 1] = String(saida[saida.length - 1]) + filho.value;
      } else saida.push(filho.value);
    } else if ("tagName" in filho && !tecnicos.has(filho.tagName)) {
      saida.push({
        tag: filho.tagName,
        atributos: filho.attrs.map((a): [string, string] => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
        filhos: conteudo(filho),
      });
    }
  }
  return saida;
}

const nomesProprios = Object.values(glossario.entradas)
  .filter((entrada) => entrada.tipo === "nome_proprio")
  .flatMap((entrada) => [entrada.pt, ...("formas_preservadas" in entrada ? entrada.formas_preservadas : [])]);
const escapar = (valor: string) => valor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function semNomes(textoOriginal: string, nomes: readonly string[]): string {
  return [...nomes].sort((a, b) => b.length - a.length).reduce((restante, nome) =>
    restante.replace(new RegExp(`(^|[^\\p{L}\\p{N}_])${escapar(nome)}(?=$|[^\\p{L}\\p{N}_])`, "giu"), "$1"), textoOriginal);
}
function oculto(no: Elemento): boolean {
  return attr(no, "hidden") !== undefined || attr(no, "aria-hidden") === "true"
    || /(?:^|\s)(?:hidden|sr-only|invisible|opacity-0)(?:\s|$)/.test(attr(no, "class") ?? "")
    || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)/.test(attr(no, "style") ?? "")
    || (no.parentNode !== null && "tagName" in no.parentNode && oculto(no.parentNode));
}

/** Detector incremental: ilhas válidas não dispensam o head nem atributos fora delas. */
function vazamentos(doc: No, idioma: "pt" | "en", nomes: readonly string[] = nomesProprios): string[] {
  const erros: string[] = [];
  const todos = elementos(doc);
  const ilhasValidas = new Set<Elemento>();
  const avisosVinculados = new Set<Elemento>();
  for (const ilha of todos.filter((e) => attr(e, "data-i18n-estado") !== undefined)) {
    const irmaos = ilha.parentNode ? filhos(ilha.parentNode).filter((e): e is Elemento => "tagName" in e) : [];
    const aviso = irmaos[irmaos.indexOf(ilha) - 1];
    const valido = attr(ilha, "data-i18n-estado") === "portugues_marcado" && attr(ilha, "lang") === "pt-BR"
      && aviso && attr(aviso, "data-i18n-aviso") !== undefined && attr(aviso, "lang") === "en"
      && texto(aviso).trim() === "Portuguese only" && !oculto(aviso) && !oculto(ilha);
    if (!valido) erros.push("ilha-sem-aviso-visivel-ou-idioma");
    else {
      ilhasValidas.add(ilha);
      avisosVinculados.add(aviso);
    }
    if (idioma === "pt") erros.push("marcador-ingles-em-pagina-portuguesa");
  }
  for (const aviso of todos.filter((e) => attr(e, "data-i18n-aviso") !== undefined)) {
    if (!avisosVinculados.has(aviso)) erros.push("aviso-sem-ilha");
  }
  const verifica = (valor: string, dentro: boolean, lang: string) => {
    if (!valor.trim() || (idioma === "en" && dentro && lang === "pt-BR")) return;
    const restante = semNomes(valor, nomes);
    if (new RegExp("\\b(?:idioma|traducao)\\.[a-z_]+\\b", "u").test(restante)) erros.push(`chave-na-interface: ${valor}`);
    const portugues = new RegExp("(?:^|[^\\p{L}])(?:não|são|dados)(?=$|[^\\p{L}])|[\\p{L}]+(?:ção|ções)\\b", "iu");
    const ingles = new RegExp("\\b(?:the|are|with|only|your|Portuguese|English|Language)\\b", "iu");
    if (idioma === "en" && portugues.test(restante)) erros.push(`portugues-sem-marca: ${valor}`);
    if (idioma === "pt" && ingles.test(restante)) erros.push(`ingles-na-pagina-portuguesa: ${valor}`);
  };
  const visita = (no: No, dentro: boolean, lang: string) => {
    if ("value" in no) { verifica(no.value, dentro, lang); return; }
    if ("tagName" in no) {
      if (tecnicos.has(no.tagName)) return;
      dentro = dentro || ilhasValidas.has(no);
      lang = attr(no, "lang") ?? lang;
      for (const nome of atributosHumanos) verifica(attr(no, nome) ?? "", dentro, lang);
      if (no.tagName === "meta" && /^(?:description|og:(?:title|description|image:alt)|twitter:(?:title|description|image:alt))$/.test(attr(no, "name") ?? attr(no, "property") ?? "")) {
        verifica(attr(no, "content") ?? "", false, idioma === "pt" ? "pt-BR" : "en");
      }
    }
    for (const filho of filhos(no)) visita(filho, dentro, lang);
  };
  visita(doc, false, idioma === "pt" ? "pt-BR" : "en");
  return erros;
}

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

  it("publica canonical próprio e hreflangs recíprocos somente para o par existente", (ctx) => {
    const { pt, en } = documentos(ctx);
    const esperados = [
      ["pt-BR", "https://scrutiniums.com/sobre"],
      ["en", "https://scrutiniums.com/en/sobre"],
      ["x-default", "https://scrutiniums.com/sobre"],
    ];
    for (const [doc, canonical] of [[pt, "https://scrutiniums.com/sobre"], [en, "https://scrutiniums.com/en/sobre"]] as const) {
      expect(links(doc, "canonical").map((e) => attr(e, "href"))).toEqual([canonical]);
      expect(links(doc, "alternate").filter((e) => attr(e, "hreflang") !== undefined)
        .map((e) => [attr(e, "hreflang"), attr(e, "href")]).sort()).toEqual([...esperados].sort());
    }
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
