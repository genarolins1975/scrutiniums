import { Children, createElement, isValidElement, type ReactElement, type ReactNode, type Ref } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SeletorIdiomaPublico } from "@/components/i18n/SeletorIdiomaPublico";

const montagem = vi.hoisted(() => ({
  pathname: "/sobre" as string | null,
  efeitos: [] as Array<() => void | (() => void)>,
}));
vi.mock("next/navigation", async () => ({
  ...await vi.importActual<typeof import("next/navigation")>("next/navigation"),
  usePathname: () => montagem.pathname,
}));
vi.mock("react", async () => ({
  ...await vi.importActual<typeof import("react")>("react"),
  // Os demais hooks e o render são reais. Só adiamos os efeitos até conectar as refs.
  useEffect: (efeito: () => void | (() => void)) => { montagem.efeitos.push(efeito); },
}));

// Fixture de tradução publicada: estes testes exercitam eventos e preservação de URL.
// O teste SSR usa o inventário real e exige ausência do seletor em fallbacks.
vi.mock("@/lib/i18n-rotas", async () => {
  const real = await vi.importActual<typeof import("@/lib/i18n-rotas")>("@/lib/i18n-rotas");
  return { ...real, traducaoPublicada: (href: string) => real.parDeIdioma(href) !== null };
});

const limpezas: Array<() => void> = [];
beforeEach(() => {
  montagem.pathname = "/sobre";
  montagem.efeitos.length = 0;
});
afterEach(() => {
  for (const limpar of limpezas.splice(0)) limpar();
  vi.unstubAllGlobals();
});

/** Fornece somente a superfície observada pelo componente; não simula navegação. */
function navegador(inicial = "https://scrutiniums.com/sobre", bloquearCookie = false) {
  let href = inicial;
  const origem = new URL(inicial);
  const cookies: string[] = [];
  const listeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
  const assign = vi.fn();
  const replace = vi.fn();
  const redirecionar = vi.fn();
  const lerCookie = vi.fn(() => "scrutiniums_idioma=en");
  const escreverCookie = vi.fn((valor: string) => {
    if (bloquearCookie) throw new Error("Cookie indisponível neste navegador.");
    cookies.push(valor);
  });
  const location = {
    get href() { return href; },
    set href(valor: string) { redirecionar(valor); },
    origin: origem.origin,
    protocol: origem.protocol,
    get pathname() { return new URL(href).pathname; },
    get search() { return new URL(href).search; },
    get hash() { return new URL(href).hash; },
    assign,
    replace,
  };
  const history = { state: { __NA: true }, pushState: vi.fn(), replaceState: vi.fn() };
  const addEventListener = vi.fn((nome: string, callback: EventListenerOrEventListenerObject) => {
    const registrados = listeners.get(nome) ?? new Set<EventListenerOrEventListenerObject>();
    registrados.add(callback);
    listeners.set(nome, registrados);
  });
  const removeEventListener = vi.fn((nome: string, callback: EventListenerOrEventListenerObject) => {
    listeners.get(nome)?.delete(callback);
  });
  vi.stubGlobal("window", { location, history, addEventListener, removeEventListener });
  vi.stubGlobal("document", Object.defineProperty({}, "cookie", {
    get: lerCookie,
    set: escreverCookie,
  }));
  montagem.pathname = origem.pathname;
  return {
    location, cookies, escreverCookie, lerCookie, listeners, addEventListener, removeEventListener,
    alterarHref: (nova: string) => { href = nova; },
    semRedirecionamento: () => {
      expect(assign).not.toHaveBeenCalled();
      expect(replace).not.toHaveBeenCalled();
      expect(redirecionar).not.toHaveBeenCalled();
      expect(history.pushState).not.toHaveBeenCalled();
      expect(history.replaceState).not.toHaveBeenCalled();
    },
  };
}

/** Atributos das refs, sem DOM, layout, evento nativo ou ciclo de estado simulado. */
class ElementoRef {
  private atributos = new Map<string, string>();
  constructor(props: Record<string, unknown>) {
    if (typeof props.href === "string") this.atributos.set("href", props.href);
  }
  getAttribute(nome: string) { return this.atributos.get(nome) ?? null; }
  setAttribute(nome: string, valor: string) { this.atributos.set(nome, valor); }
  removeAttribute(nome: string) { this.atributos.delete(nome); }
}
type ElementoCapturado = ReactElement<Record<string, unknown>> & { ref?: Ref<ElementoRef> };
type NoMontado = { elemento: ElementoCapturado; ref: ElementoRef; pai?: NoMontado };
type NomeEvento = "onFocus" | "onPointerEnter" | "onPointerDown" | "onContextMenu" | "onClick" | "onAuxClick";

function montar() {
  let arvore: ReactNode = null;
  function Capturar() {
    arvore = SeletorIdiomaPublico();
    return arvore;
  }
  renderToStaticMarkup(createElement(Capturar));
  const anchors: NoMontado[] = [];
  const conectar = (filhos: ReactNode, pai?: NoMontado) => {
    Children.forEach(filhos, (filho) => {
      if (!isValidElement<Record<string, unknown>>(filho)) return;
      const elemento = filho as ElementoCapturado;
      const no: NoMontado = { elemento, ref: new ElementoRef(elemento.props), pai };
      if (typeof elemento.ref === "function") elemento.ref(no.ref);
      else if (elemento.ref) (elemento.ref as { current: ElementoRef | null }).current = no.ref;
      if (elemento.type === "a") anchors.push(no);
      conectar(elemento.props.children as ReactNode, no);
    });
  };
  conectar(arvore);
  expect(anchors).toHaveLength(2); // Exige anchors nativos na árvore, sem interceptação de next/link.
  const porIdioma = (idioma: "pt" | "en") => {
    const anchor = anchors.find((no) => no.elemento.props.hrefLang === (idioma === "pt" ? "pt-BR" : "en"));
    expect(anchor).toBeDefined();
    return anchor!;
  };
  return {
    hrefs: () => [porIdioma("pt").ref.getAttribute("href"), porIdioma("en").ref.getAttribute("href")],
    efeitos: () => {
      for (const efeito of montagem.efeitos.splice(0)) {
        const limpar = efeito();
        if (limpar) limpezas.push(limpar);
      }
    },
    evento: (nome: NomeEvento, idioma: "pt" | "en" = "en", opcoes: Partial<{ button: number; ctrlKey: boolean; metaKey: boolean; detail: number }> = {}) => {
      const anchor = porIdioma(idioma);
      const evento = {
        button: 0, ctrlKey: false, metaKey: false, detail: 1, ...opcoes,
        target: anchor.ref, currentTarget: anchor.ref, preventDefault: vi.fn(), stopPropagation: vi.fn(),
      };
      for (let no: NoMontado | undefined = anchor; no; no = no.pai) {
        const handler = no.elemento.props[nome];
        evento.currentTarget = no.ref;
        if (typeof handler === "function") handler(evento);
      }
      expect(evento.preventDefault).not.toHaveBeenCalled();
      expect(evento.stopPropagation).not.toHaveBeenCalled();
    },
  };
}

const URLs = [
  {
    pt: "/sobre?uf=SP&uf=PE&q=a+b&q=a%20b&x=%2f&v=#se%C3%A7%C3%A3o",
    en: "/en/sobre?uf=SP&uf=PE&q=a+b&q=a%20b&x=%2f&v=#se%C3%A7%C3%A3o",
  },
  {
    pt: "/sobre/?de=https://example.org/a?x=1&next=/en/app#secao?modo=x",
    en: "/en/sobre/?de=https://example.org/a?x=1&next=/en/app#secao?modo=x",
  },
  { pt: "/sobre?", en: "/en/sobre?" },
  { pt: "/sobre#", en: "/en/sobre#" },
  { pt: "/sobre?#", en: "/en/sobre?#" },
] as const;

describe("destinos reais nas refs de uma montagem do seletor", () => {
  it.each(URLs.flatMap(({ pt, en }) => [{ entrada: pt, pt, en }, { entrada: en, pt, en }]))(
    "preserva a grafia completa depois do efeito: $entrada", ({ entrada, pt, en }) => {
      const browser = navegador("https://scrutiniums.com" + entrada);
      const controle = montar();
      expect(controle.hrefs()).toEqual(["/sobre", "/en/sobre"]);
      controle.efeitos();
      expect(controle.hrefs()).toEqual([pt, en]);
      expect(browser.escreverCookie).not.toHaveBeenCalled();
      browser.semRedirecionamento();
    },
  );

  it("sincroniza os hrefs antes de tentar escrever a preferência", () => {
    const browser = navegador();
    const controle = montar();
    controle.efeitos();
    let hrefsNaEscrita: Array<string | null> | undefined;
    browser.escreverCookie.mockImplementationOnce(() => { hrefsNaEscrita = controle.hrefs(); });
    browser.alterarHref("https://scrutiniums.com/sobre?ordem=atualizar#depois-gravar");
    controle.evento("onClick");
    expect(hrefsNaEscrita).toEqual([
      "/sobre?ordem=atualizar#depois-gravar", "/en/sobre?ordem=atualizar#depois-gravar",
    ]);
  });

  it.each(["onFocus", "onPointerEnter", "onPointerDown", "onContextMenu", "onClick", "onAuxClick"] as const)(
    "%s relê a URL e atualiza ambos os atributos antes de retornar, sem um novo render", (nome) => {
      const browser = navegador();
      const controle = montar();
      controle.efeitos();
      browser.alterarHref("https://scrutiniums.com/en/sobre/?q=a+b&q=a%20b#novo");
      controle.evento(nome, "en", { button: nome === "onAuxClick" ? 1 : 0 });
      expect(controle.hrefs()).toEqual(["/sobre/?q=a+b&q=a%20b#novo", "/en/sobre/?q=a+b&q=a%20b#novo"]);
      browser.semRedirecionamento();
    },
  );

  it.each([
    { nome: "click", evento: "onClick", opcoes: {} },
    { nome: "Ctrl+click", evento: "onClick", opcoes: { ctrlKey: true } },
    { nome: "Meta+click", evento: "onClick", opcoes: { metaKey: true } },
    { nome: "ativação por teclado", evento: "onClick", opcoes: { detail: 0 } },
    { nome: "botão do meio", evento: "onAuxClick", opcoes: { button: 1 } },
  ] as const)("$nome relê a URL novamente depois de foco/menu, sem cancelar a ativação", ({ evento, opcoes }) => {
    const browser = navegador();
    const controle = montar();
    controle.efeitos();
    browser.alterarHref("https://scrutiniums.com/sobre?fase=preparacao#antes");
    controle.evento("onFocus");
    controle.evento("onContextMenu");
    expect(controle.hrefs()).toEqual(["/sobre?fase=preparacao#antes", "/en/sobre?fase=preparacao#antes"]);
    browser.alterarHref("https://scrutiniums.com/en/sobre?#");
    controle.evento(evento, "pt", opcoes);
    expect(controle.hrefs()).toEqual(["/sobre?#", "/en/sobre?#"]);
    browser.semRedirecionamento();
  });

  it.each([
    "https://scrutiniums.com/", "https://scrutiniums.com/entrar", "https://scrutiniums.com/en/observatorio",
    "https://scrutiniums.com/api/auth/eu", "https://scrutiniums.com/en/home/credito.webp",
    "https://scrutiniums.com/en/sobre/nao-publicada", "https://scrutiniums.com/en/en/sobre",
    "https://scrutiniums.com/%65n/sobre", "https://scrutiniums.com.evil.invalid/sobre",
    "https://outro.invalid/sobre",
  ])("remove hrefs antigos imediatamente e não grava preferência para %s", (href) => {
    const browser = navegador();
    const controle = montar();
    controle.efeitos();
    browser.alterarHref(href);
    controle.evento("onClick");
    expect(controle.hrefs()).toEqual([null, null]);
    controle.evento("onAuxClick", "pt", { button: 1 });
    expect(controle.hrefs()).toEqual([null, null]);
    expect(browser.escreverCookie).not.toHaveBeenCalled();
    browser.semRedirecionamento();
  });

  it("registra os eventos de retorno/navegação e remove seus callbacks no cleanup", () => {
    const browser = navegador();
    const controle = montar();
    controle.efeitos();
    expect([...browser.listeners.keys()].sort()).toEqual(["hashchange", "pageshow", "popstate"]);
    for (const callbacks of browser.listeners.values()) expect(callbacks.size).toBe(1);
    for (const limpar of limpezas.splice(0)) limpar();
    for (const callbacks of browser.listeners.values()) expect(callbacks.size).toBe(0);
    expect(browser.removeEventListener.mock.calls).toEqual(expect.arrayContaining(browser.addEventListener.mock.calls));
    expect(browser.escreverCookie).not.toHaveBeenCalled();
  });
});

describe("tentativa de cookie de preferência sem interceptar o link", () => {
  it.each([
    { protocolo: "https", idioma: "pt", evento: "onClick", button: 0 },
    { protocolo: "https", idioma: "en", evento: "onClick", button: 0 },
    { protocolo: "http", idioma: "pt", evento: "onAuxClick", button: 1 },
    { protocolo: "http", idioma: "en", evento: "onAuxClick", button: 1 },
  ] as const)("grava somente $idioma e os atributos previstos em $protocolo/$evento", ({ protocolo, idioma, evento, button }) => {
    const browser = navegador(`${protocolo}://scrutiniums.com/sobre`);
    const controle = montar();
    controle.efeitos();
    browser.alterarHref(`${protocolo}://scrutiniums.com/sobre?idioma=valor-livre#destino`);
    controle.evento(evento, idioma, { button });
    expect(controle.hrefs()).toEqual(["/sobre?idioma=valor-livre#destino", "/en/sobre?idioma=valor-livre#destino"]);
    expect(browser.cookies).toHaveLength(1);
    expect(browser.cookies[0].split(";").map((parte) => parte.trim()).sort()).toEqual([
      `scrutiniums_idioma=${idioma}`, "Path=/", "Max-Age=31536000", "SameSite=Lax",
      ...(protocolo === "https" ? ["Secure"] : []),
    ].sort());
    expect(browser.lerCookie).not.toHaveBeenCalled();
    browser.semRedirecionamento();
  });

  it("não trata montagem, foco, hover, ponteiro ou menu como escolha de idioma", () => {
    const browser = navegador();
    const controle = montar();
    controle.efeitos();
    for (const evento of ["onFocus", "onPointerEnter", "onPointerDown", "onContextMenu"] as const) {
      browser.alterarHref("https://scrutiniums.com/en/sobre?origem=interacao#atual");
      controle.evento(evento, "pt");
      expect(controle.hrefs()).toEqual(["/sobre?origem=interacao#atual", "/en/sobre?origem=interacao#atual"]);
    }
    controle.evento("onAuxClick", "en", { button: 2 });
    expect(browser.escreverCookie).not.toHaveBeenCalled();
    browser.semRedirecionamento();
  });

  it.each(["onClick", "onAuxClick"] as const)("cookie bloqueado não faz %s lançar nem deixa href antigo", (evento) => {
    const browser = navegador("https://scrutiniums.com/sobre", true);
    const controle = montar();
    controle.efeitos();
    browser.alterarHref("https://scrutiniums.com/en/sobre?depois=montagem#pronto");
    expect(() => controle.evento(evento, "en", { button: evento === "onAuxClick" ? 1 : 0 })).not.toThrow();
    expect(browser.escreverCookie).toHaveBeenCalledOnce();
    expect(controle.hrefs()).toEqual(["/sobre?depois=montagem#pronto", "/en/sobre?depois=montagem#pronto"]);
    browser.semRedirecionamento();
  });
});
