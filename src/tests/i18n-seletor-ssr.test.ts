import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";
import { PublicHeaderView } from "@/components/layout/PublicHeader";
import { PARES_DE_IDIOMA, traducaoPublicada } from "@/lib/i18n-rotas";
import { pt } from "@/i18n/pt";
import EntrarPage from "@/app/entrar/page";
import CadastroLayout from "@/app/cadastro/layout";

const rota = vi.hoisted(() => ({ pathname: "/sobre" as string | null }));
const autenticacao = vi.hoisted(() => ({ sessao: vi.fn(), navegar: vi.fn() }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => rota.pathname,
  useRouter: () => ({ push: autenticacao.navegar }),
}));
vi.mock("next/headers", () => ({
  cookies: () => { throw new Error("O cabeçalho apresentacional não pode consultar cookies no SSR."); },
}));
vi.mock("@/lib/session", () => ({
  getSessionUser: autenticacao.sessao,
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

beforeEach(() => {
  rota.pathname = "/sobre";
  autenticacao.sessao.mockReset().mockImplementation(() => {
    throw new Error("O seletor estático não consulta a sessão.");
  });
  autenticacao.navegar.mockReset().mockImplementation(() => {
    throw new Error("O primeiro HTML do formulário não pode navegar.");
  });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("seletor público no HTML inicial", () => {
  it("usa os nomes portugueses do catálogo nas regiões portuguesas do cabeçalho", () => {
    expect(pt["idioma.seletor"]).toBe("Idioma");
    expect(pt["idioma.portugues"]).toBe("Português");
    expect(pt["idioma.ingles"]).toBe("Inglês");
    expect(renderizar("/termos")).toBe("");
  });

  it.each(PARES_DE_IDIOMA)("publica anchors canônicos iguais em $pt e $en, sem esperar efeito", (par) => {
    const htmlPt = renderizar(par.pt);
    const htmlEn = renderizar(par.en);
    expect(htmlEn).toBe(htmlPt);
    const variantes = [par.pt, par.en, ...(par.pt === "/" ? [] : [par.pt + "/"]), par.en + "/"];
    for (const pathname of variantes) {
      if (!traducaoPublicada(pathname)) {
        expect(renderizar(pathname)).toBe("");
        continue;
      }
      const { anchors } = seletor(renderizar(pathname));
      expect(anchors.map((no) => attr(no, "href")), pathname).toEqual([par.pt, par.en]);
    }
  });

  it.each([
    null, "//", "/en//", "/entrar/verificar", "/en/entrar/verificar", "/observatorio", "/en/observatorio",
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
    expect(renderizar("/termos")).toBe("");
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
      if (!traducaoPublicada(par.pt)) {
        expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toEqual([]);
        continue;
      }
      const { anchors } = seletor(serialize(navegacoes[0]));
      expect(anchors.map((no) => attr(no, "href"))).toEqual([par.pt, par.en]);
      expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toHaveLength(1);
    }
  });

  it.each(["/pagina-sintetica-sem-irma", "/entrar/verificar", "/en/rota-ainda-nao-publicada"])("preserva o cabeçalho sem seletor em %s", (pathname) => {
    rota.pathname = pathname;
    const todos = elementos(parseFragment(renderToStaticMarkup(createElement(PublicHeaderView))));
    expect(todos.filter((no) => no.tagName === "header")).toHaveLength(1);
    expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toEqual([]);
  });
});

describe("seletor nos cabeçalhos próprios das entradas de autenticação", () => {
  it("renderiza o formulário real de login anônimo com o mesmo seletor dentro do cabeçalho PT e EN", async () => {
    autenticacao.sessao.mockResolvedValue(null);
    const cabecalhos: string[] = [];
    for (const pathname of ["/entrar", "/en/entrar"]) {
      rota.pathname = pathname;
      const todos = elementos(parseFragment(renderToStaticMarkup(await EntrarPage({}))));
      const headers = todos.filter((no) => no.tagName === "header");
      expect(headers, pathname).toHaveLength(1);
      const htmlHeader = serialize(headers[0]);
      cabecalhos.push(htmlHeader);
      expect(elementos(headers[0]).filter((no) => no.tagName === "a").map((no) => attr(no, "href")))
        .toEqual(["/", "/cadastro"]);
      expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toHaveLength(0);
      expect(todos.filter((no) => no.tagName === "main")).toHaveLength(1);
      expect(todos.filter((no) => no.tagName === "form")).toHaveLength(1);
      expect(todos.filter((no) => no.tagName === "input").map((no) => attr(no, "name")))
        .toEqual(["email", "current-password"]);
      expect(todos.filter((no) => no.tagName === "footer")).toHaveLength(1);
    }
    expect(cabecalhos[1]).toBe(cabecalhos[0]);
    expect(autenticacao.sessao).toHaveBeenCalledTimes(2);
    expect(autenticacao.navegar).not.toHaveBeenCalled();
  });

  it("integra o seletor ao shell real do cadastro e mantém children dentro do main", () => {
    const cabecalhos: string[] = [];
    for (const pathname of ["/cadastro", "/en/cadastro"]) {
      rota.pathname = pathname;
      const filho = createElement("section", { "data-filho-sintetico": "cadastro" }, "Etapa de teste");
      const todos = elementos(parseFragment(renderToStaticMarkup(createElement(CadastroLayout, null, filho))));
      const headers = todos.filter((no) => no.tagName === "header");
      expect(headers, pathname).toHaveLength(1);
      const htmlHeader = serialize(headers[0]);
      cabecalhos.push(htmlHeader);
      expect(elementos(headers[0]).filter((no) => no.tagName === "a").map((no) => attr(no, "href")))
        .toEqual(["/", "/entrar"]);
      expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toHaveLength(0);
      const mains = todos.filter((no) => no.tagName === "main");
      expect(mains).toHaveLength(1);
      expect(elementos(mains[0]).filter((no) => attr(no, "data-filho-sintetico") === "cadastro")).toHaveLength(1);
      expect(todos.filter((no) => no.tagName === "footer")).toHaveLength(1);
    }
    expect(cabecalhos[1]).toBe(cabecalhos[0]);
    expect(autenticacao.sessao).not.toHaveBeenCalled();
  });

  it.each(["/cadastro/telefone", "/cadastro/perfil", "/en/cadastro/telefone", "/en/cadastro/perfil"])(
    "preserva o shell de %s sem anunciar uma irmã ainda ausente", (pathname) => {
      rota.pathname = pathname;
      const todos = elementos(parseFragment(renderToStaticMarkup(createElement(CadastroLayout, null,
        createElement("p", null, "Etapa ainda sem irmã"),
      ))));
      expect(todos.filter((no) => no.tagName === "header")).toHaveLength(1);
      expect(todos.filter((no) => no.tagName === "main")).toHaveLength(1);
      expect(todos.filter((no) => no.tagName === "footer")).toHaveLength(1);
      expect(todos.filter((no) => attr(no, "aria-label") === "Idioma")).toHaveLength(0);
      expect(autenticacao.sessao).not.toHaveBeenCalled();
    },
  );
});
