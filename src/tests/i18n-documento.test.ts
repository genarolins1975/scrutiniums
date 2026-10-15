import { createElement, type Attributes, type ComponentType, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parse, parseFragment, serialize, type DefaultTreeAdapterMap } from "parse5";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentoIdioma, MolduraIdioma } from "@/components/i18n/DocumentoIdioma";
import { PortuguesApenas } from "@/components/i18n/PortuguesApenas";
import Loading from "@/app/loading";
import NotFound from "@/app/not-found";
import ErrorPage from "@/app/error";

const rota = vi.hoisted(() => ({ pathname: "/sobre" as string | null }));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => rota.pathname,
}));

type No = DefaultTreeAdapterMap["node"];
type Elemento = DefaultTreeAdapterMap["element"];
/** React 18 não infere que o terceiro argumento satisfaz o children obrigatório. */
function comFilhos<P extends object>(Componente: ComponentType<P>, props: Omit<P, "children">, filho: ReactNode) {
  return createElement(Componente, props as P & Attributes, filho);
}
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
function fallback(html: string) {
  const doc = parseFragment(html);
  const todos = elementos(doc);
  const avisos = todos.filter((no) => attr(no, "data-i18n-aviso") !== undefined);
  const ilhas = todos.filter((no) => attr(no, "data-i18n-estado") === "portugues_marcado");
  expect(avisos).toHaveLength(1);
  expect(ilhas).toHaveLength(1);
  const aviso = avisos[0];
  const ilha = ilhas[0];
  expect(aviso.tagName).toBe("p");
  expect(attr(aviso, "lang")).toBe("en");
  expect(texto(aviso)).toBe("Portuguese only");
  expect(attr(aviso, "hidden")).toBeUndefined();
  expect(attr(aviso, "aria-hidden")).not.toBe("true");
  expect(attr(aviso, "class") ?? "").not.toMatch(/(?:^|\s)(?:hidden|sr-only|invisible|opacity-0)(?:\s|$)/);
  expect(attr(aviso, "style") ?? "").not.toMatch(/display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:[;\s]|$)/);
  expect(ilha.tagName).toBe("div");
  expect(attr(ilha, "lang")).toBe("pt-BR");
  expect(doc.childNodes.filter((no) => "tagName" in no)).toEqual([aviso, ilha]);
  return ilha;
}

beforeEach(() => { rota.pathname = "/sobre"; });

describe("documento e fallback de idioma no render inicial", () => {
  it("declara o idioma pelo segmento exato, preservando classes e filhos", () => {
    const casos = [
      ["/sobre", "pt-BR"], ["/", "pt-BR"], ["/english", "pt-BR"],
      ["/enx", "pt-BR"], ["/EN", "pt-BR"], ["/fr", "pt-BR"], [null, "pt-BR"],
      ["/en", "en"], ["/en/sobre", "en"], ["/en/api/inexistente", "en"],
    ] as const;
    for (const [pathname, idioma] of casos) {
      rota.pathname = pathname;
      const doc = parse(renderToStaticMarkup(comFilhos(DocumentoIdioma, {
        className: "fonte-serif fonte-sans fonte-label",
        bodyClassName: "min-h-screen bg-marfim text-carvao",
      }, createElement("main", null, "Conteúdo preservado: 12,5"))));
      const todos = elementos(doc);
      const raizes = todos.filter((no) => no.tagName === "html");
      const corpos = todos.filter((no) => no.tagName === "body");
      expect(raizes, String(pathname)).toHaveLength(1);
      expect(corpos, String(pathname)).toHaveLength(1);
      expect(attr(raizes[0], "lang"), String(pathname)).toBe(idioma);
      expect(attr(raizes[0], "class")).toBe("fonte-serif fonte-sans fonte-label");
      expect(attr(corpos[0], "class")).toBe("min-h-screen bg-marfim text-carvao");
      expect(texto(corpos[0])).toBe("Conteúdo preservado: 12,5");
    }
  });

  it("coloca o aviso inglês fora da ilha portuguesa sem alterar seu conteúdo", () => {
    const filho = createElement("main", { "aria-label": "Dados e método" },
      createElement("p", null, "Não são estimativas: 1.234,50."),
      createElement("a", { href: "/sobre/erros?origem=aviso#registro", title: "Registro de erros" }, "Consultar registro"));
    const original = renderToStaticMarkup(filho);
    const ilha = fallback(renderToStaticMarkup(comFilhos(PortuguesApenas, {}, filho)));
    expect(serialize(ilha)).toBe(serialize(parseFragment(original)));
  });

  it("a moldura deixa a saída PT intacta e marca inclusive erros de caminhos EN não publicados", () => {
    const filho = createElement("main", null, "Página não encontrada");
    const original = renderToStaticMarkup(filho);
    for (const pathname of ["/sobre", "/english", "/enx", "/EN", "/fr"]) {
      rota.pathname = pathname;
      expect(renderToStaticMarkup(comFilhos(MolduraIdioma, {}, filho)), pathname).toBe(original);
    }
    for (const pathname of ["/en/sobre", "/en/nao-encontrado-404", "/en/api/inexistente"]) {
      rota.pathname = pathname;
      const ilha = fallback(renderToStaticMarkup(comFilhos(MolduraIdioma, {}, filho)));
      expect(serialize(ilha), pathname).toBe(original);
    }
  });
});

describe("boundaries reais com português marcado", () => {
  it.each([
    { nome: "carregamento", criar: () => createElement(Loading) },
    { nome: "404", criar: () => createElement(NotFound) },
    { nome: "erro", criar: () => createElement(ErrorPage, {
      error: Object.assign(new Error("Detalhe técnico não publicado"), { digest: "referencia-sintetica-123" }),
      reset: vi.fn(),
    }) },
  ])("preserva todo o HTML português de $nome dentro da ilha EN", ({ nome, criar }) => {
    rota.pathname = "/caminho-inexistente";
    const pt = renderToStaticMarkup(criar());
    expect(pt).not.toContain("data-i18n-estado");
    expect(pt).not.toContain("Portuguese only");
    rota.pathname = "/en/caminho-inexistente";
    const ilha = fallback(renderToStaticMarkup(criar()));
    expect(serialize(ilha)).toBe(serialize(parseFragment(pt)));

    const todos = elementos(ilha);
    if (nome === "carregamento") {
      expect(todos.some((no) => attr(no, "aria-busy") === "true")).toBe(true);
      expect(todos.find((no) => attr(no, "role") === "status")?.attrs)
        .toContainEqual({ name: "aria-label", value: "Carregando página" });
      expect(texto(ilha)).toContain("Carregando…");
    } else if (nome === "404") {
      expect(todos.filter((no) => no.tagName === "h1").map(texto)).toEqual(["Página não encontrada"]);
      expect(todos.filter((no) => no.tagName === "a").map((no) => attr(no, "href")))
        .toEqual(expect.arrayContaining(["/", "/glossario"]));
    } else {
      expect(todos.filter((no) => no.tagName === "h1").map(texto)).toEqual(["Algo saiu do esperado"]);
      expect(todos.filter((no) => no.tagName === "button").map(texto)).toEqual(["Tentar novamente"]);
      expect(texto(ilha)).toContain("Código de referência: referencia-sintetica-123");
      expect(texto(ilha)).not.toContain("Detalhe técnico não publicado");
    }
  });
});
