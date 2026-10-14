import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { PARES_DE_IDIOMA } from "@/lib/i18n-rotas";
import { pt } from "@/i18n/pt";

const rota = vi.hoisted(() => ({ pathname: "/sobre" as string | null }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => rota.pathname,
}));
vi.mock("next/headers", () => ({
  cookies: () => { throw new Error("O cabeçalho apresentacional não pode consultar cookies no SSR."); },
}));
vi.mock("@/lib/session", () => ({
  getSessionUser: () => { throw new Error("O seletor estático não consulta a sessão."); },
}));

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
const attr = (no: Elemento, nome: string) => no.attrs.find((a) => a.name === nome)?.value;
function elementos(no: No): Elemento[] {
  return [
    ...("tagName" in no ? [no] : []),
    ...("childNodes" in no ? no.childNodes.flatMap(elementos) : []),
  ];
}
function texto(no: No): string {
  return "value" in no ? no.value : "childNodes" in no ? no.childNodes.map(texto).join("") : "";
}
function seletor(html: string) {
  const todos = elementos(parseFragment(html));
  const grupos = todos.filter((no) => attr(no, "aria-label") === "Idioma");
  expect(grupos).toHaveLength(1);
  const grupo = grupos[0];
  expect(attr(grupo, "role")).toBe("group");
  expect(attr(grupo, "hidden")).toBeUndefined();
  expect(attr(grupo, "aria-hidden")).not.toBe("true");
  const anchors = elementos(grupo).filter((no) => no.tagName === "a");
  expect(anchors).toHaveLength(2);
  expect(anchors.map(texto)).toEqual(["Português", "Inglês"]);
  expect(anchors.map((no) => attr(no, "hreflang"))).toEqual(["pt-BR", "en"]);
  for (const no of elementos(grupo)) {
    expect(attr(no, "aria-current")).toBeUndefined();
    expect(attr(no, "lang")).not.toBe("en");
  }
  return { grupo, anchors };
}
function renderizar(pathname: string | null): string {
  rota.pathname = pathname;
  return renderToStaticMarkup(createElement(SeletorIdiomaPublico));
}

beforeEach(() => { rota.pathname = "/sobre"; });
afterEach(() => { vi.unstubAllGlobals(); });

describe("seletor público no HTML inicial", () => {
  it("usa os nomes portugueses do catálogo durante o fallback completo", () => {
    expect(pt["idioma.seletor"]).toBe("Idioma");
    expect(pt["idioma.portugues"]).toBe("Português");
    expect(pt["idioma.ingles"]).toBe("Inglês");
    seletor(renderizar("/sobre"));
  });

  it.each(PARES_DE_IDIOMA)("publica anchors canônicos iguais em $pt e $en, sem esperar efeito", (par) => {
    const htmlPt = renderizar(par.pt);
    const htmlEn = renderizar(par.en);
    expect(htmlEn).toBe(htmlPt);
    for (const pathname of [par.pt, par.en, par.pt + "/", par.en + "/"]) {
      const { anchors } = seletor(renderizar(pathname));
      expect(anchors.map((no) => attr(no, "href")), pathname).toEqual([par.pt, par.en]);
    }
  });

  it.each([
    null, "/", "/en", "/entrar", "/en/entrar", "/observatorio", "/en/observatorio",
    "/app/conta", "/en/app/conta", "/api/auth/eu", "/en/api/auth/eu",
    "/_next/static/a.js", "/home/credito.webp", "/en/home/credito.webp",
    "/pagina-ainda-sem-irma", "/sobrecarga", "/en/sobre/rota-inexistente",
    "/en/en/sobre", "/%65n/sobre", "/en/%73obre",
  ])("não inventa controle ou irmã para %s", (pathname) => {
    expect(renderizar(pathname)).toBe("");
  });

  it("não consulta navegador ou preferência divergente para gerar o primeiro HTML", () => {
    const lerLocalizacao = vi.fn(() => {
      throw new Error("location não está disponível durante o render inicial.");
    });
    const lerCookie = vi.fn(() => "scrutiniums_idioma=en");
    vi.stubGlobal("window", Object.defineProperty({}, "location", { get: lerLocalizacao }));
    vi.stubGlobal("document", Object.defineProperty({}, "cookie", { get: lerCookie }));
    const { anchors } = seletor(renderizar("/sobre"));
    expect(anchors.map((no) => attr(no, "href"))).toEqual(["/sobre", "/en/sobre"]);
    expect(lerLocalizacao).not.toHaveBeenCalled();
    expect(lerCookie).not.toHaveBeenCalled();
  });
});

describe("integração estática no cabeçalho público", () => {
  it.each([false, true])("mantém um seletor dentro da navegação e todo o cabeçalho igual no par; autenticado=%s", (authenticated) => {
    for (const par of PARES_DE_IDIOMA) {
      rota.pathname = par.pt;
      const htmlPt = renderToStaticMarkup(createElement(PublicHeaderView, { authenticated }));
      rota.pathname = par.en;
      const htmlEn = renderToStaticMarkup(createElement(PublicHeaderView, { authenticated }));
      expect(serialize(parseFragment(htmlEn)), par.en).toBe(serialize(parseFragment(htmlPt)));
      const todos = elementos(parseFragment(htmlPt));
      const navegacoes = todos.filter((no) => no.tagName === "nav" && attr(no, "aria-label") === "Navegação principal");
      expect(navegacoes, par.pt).toHaveLength(1);
      const { anchors } = seletor(serialize(navegacoes[0]));
      expect(anchors.map((no) => attr(no, "href"))).toEqual([par.pt, par.en]);
      expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toHaveLength(1);
    }
  });

  it.each(["/", "/entrar", "/en/rota-ainda-nao-publicada"])("preserva o cabeçalho sem seletor em %s", (pathname) => {
    rota.pathname = pathname;
    const todos = elementos(parseFragment(renderToStaticMarkup(createElement(PublicHeaderView))));
    expect(todos.filter((no) => no.tagName === "header")).toHaveLength(1);
    expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toEqual([]);
  });
});
