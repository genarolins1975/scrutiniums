import { describe, expect, it } from "vitest";
import { analisarUrlPagina, urlDaPagina } from "@/lib/i18n-url";
import { ehApiDeDados, ehRotaPublica } from "@/lib/rotasPublicas";

describe("URLs de páginas por idioma", () => {
  it("lê a raiz e o único prefixo inglês, preservando barras finais das páginas", () => {
    const casos = [
      ["/", { idioma: "pt", caminhoPt: "/", sufixo: "" }],
      ["/en", { idioma: "en", caminhoPt: "/", sufixo: "" }],
      ["/en/", { idioma: "en", caminhoPt: "/", sufixo: "" }],
      ["/sobre", { idioma: "pt", caminhoPt: "/sobre", sufixo: "" }],
      ["/en/sobre/", { idioma: "en", caminhoPt: "/sobre/", sufixo: "" }],
      ["/en/?origem=menu#inicio", { idioma: "en", caminhoPt: "/", sufixo: "?origem=menu#inicio" }],
    ] as const;

    for (const [href, esperado] of casos) {
      expect(analisarUrlPagina(href), href).toEqual(esperado);
    }
    expect(urlDaPagina("/en/", "en")).toBe("/en");
    expect(urlDaPagina("/en/", "pt")).toBe("/");
    expect(urlDaPagina("/en/?origem=menu#inicio", "en")).toBe("/en?origem=menu#inicio");
  });

  it("troca a mesma página nos dois sentidos e mantém o idioma já escolhido", () => {
    const pares = [
      ["/", "/en"],
      ["/sobre", "/en/sobre"],
      ["/sobre/", "/en/sobre/"],
      ["/app/admin?aba=sessoes", "/en/app/admin?aba=sessoes"],
      ["/cadastro/telefone", "/en/cadastro/telefone"],
      ["/observatorio/pix#serie", "/en/observatorio/pix#serie"],
      ["/setor-eletrico/pld?modo=entender#formacao", "/en/setor-eletrico/pld?modo=entender#formacao"],
    ] as const;

    for (const [pt, en] of pares) {
      expect(urlDaPagina(pt, "en"), pt).toBe(en);
      expect(urlDaPagina(en, "pt"), en).toBe(pt);
      expect(urlDaPagina(pt, "pt"), pt).toBe(pt);
      expect(urlDaPagina(en, "en"), en).toBe(en);
    }
  });

  it("preserva a query e o fragmento byte a byte sem reinterpretar destinos", () => {
    const casos = [
      {
        pt: "/contas-publicas-estaduais?uf=SP&uf=PE&q=a+b&q=a%20b&x=%2F&v=#provas",
        en: "/en/contas-publicas-estaduais?uf=SP&uf=PE&q=a+b&q=a%20b&x=%2F&v=#provas",
        caminhoPt: "/contas-publicas-estaduais",
        sufixo: "?uf=SP&uf=PE&q=a+b&q=a%20b&x=%2F&v=#provas",
      },
      { pt: "/sobre#secao?modo=x", en: "/en/sobre#secao?modo=x", caminhoPt: "/sobre", sufixo: "#secao?modo=x" },
      { pt: "/?de=%2Fen%2Fapp%2Fconta", en: "/en?de=%2Fen%2Fapp%2Fconta", caminhoPt: "/", sufixo: "?de=%2Fen%2Fapp%2Fconta" },
      {
        pt: "/entrar?de=https://example.org/pagina?x=1&next=/en/app#voltar",
        en: "/en/entrar?de=https://example.org/pagina?x=1&next=/en/app#voltar",
        caminhoPt: "/entrar",
        sufixo: "?de=https://example.org/pagina?x=1&next=/en/app#voltar",
      },
      { pt: "/sobre?", en: "/en/sobre?", caminhoPt: "/sobre", sufixo: "?" },
      { pt: "/sobre#", en: "/en/sobre#", caminhoPt: "/sobre", sufixo: "#" },
      { pt: "/sobre?#", en: "/en/sobre?#", caminhoPt: "/sobre", sufixo: "?#" },
    ] as const;

    for (const { pt, en, caminhoPt, sufixo } of casos) {
      expect(analisarUrlPagina(pt), pt).toEqual({ idioma: "pt", caminhoPt, sufixo });
      expect(analisarUrlPagina(en), en).toEqual({ idioma: "en", caminhoPt, sufixo });
      expect(urlDaPagina(pt, "en"), pt).toBe(en);
      expect(urlDaPagina(en, "pt"), en).toBe(pt);
    }
  });

  it("reconhece limites exatos de segmentos sem inventar aliases de idioma", () => {
    const pares = [
      ["/english", "/en/english"],
      ["/enx", "/en/enx"],
      ["/EN", "/en/EN"],
      ["/fr", "/en/fr"],
      ["/apito", "/en/apito"],
      ["/homem", "/en/homem"],
      ["/saneamento/goldagem", "/en/saneamento/goldagem"],
      ["/dados/api", "/en/dados/api"],
      ["/saneamento", "/en/saneamento"],
    ] as const;

    for (const [pt, en] of pares) {
      expect(analisarUrlPagina(pt), pt).toEqual({ idioma: "pt", caminhoPt: pt, sufixo: "" });
      expect(urlDaPagina(pt, "en"), pt).toBe(en);
      expect(urlDaPagina(en, "pt"), en).toBe(pt);
    }
  });

  it("recusa entradas fora do contrato em vez de reparar o caminho", () => {
    const invalidos = [
      "", "sobre", "./sobre", "../sobre", "?de=/sobre", "#sobre",
      "https://scrutiniums.com/sobre", "http://example.org/sobre", "//example.org/sobre", "mailto:pessoa@example.org",
      " /sobre", "/sobre ", "/sobre/com espaco", "/sobre?busca=a b",
      "/sobre\n", "/sob\tre", "/sobre\u0000", "/sobre#\r", "/sobre\u007f",
      "\\sobre", "/sobre\\erros", "/sobre?de=\\app",
      "/sobre//erros", "/en//sobre", "///sobre",
      "/en/en", "/en/en/", "/en/en/sobre",
      "/.", "/..", "/sobre/./erros", "/en/../api/auth/eu", "/sobre/..",
      "/%2e", "/%2E%2e", "/en/%2e%2e/api/auth/eu", "/sobre/.%2E/erros", "/sobre/%2e./erros",
      "/sobre/%", "/sobre/%2", "/sobre/%GG", "/sobre/%C3%28", "/sobre/%FF",
      "/sobre/%00", "/sobre/%20", "/sobre/\uD800", "/sobre/%ED%A0%80",
      "/sobre%2Ferros", "/sobre/%2f/erros", "/sobre%5Cerros", "/sobre/%5c/erros",
      "/%65n/sobre", "/en/%65n/sobre", "/%61pi/auth/eu", "/en/%68ome/credito",
    ];

    for (const href of invalidos) {
      expect(analisarUrlPagina(href), JSON.stringify(href)).toBeNull();
      expect(urlDaPagina(href, "pt"), JSON.stringify(href)).toBeNull();
      expect(urlDaPagina(href, "en"), JSON.stringify(href)).toBeNull();
    }
  });

  it("preserva Unicode e UTF-8 percentual válido sem normalizar sua grafia", () => {
    const pares = [
      ["/saneamento/município/São-Paulo", "/en/saneamento/município/São-Paulo"],
      ["/saneamento/munic%C3%ADpio/S%C3%A3o-Paulo", "/en/saneamento/munic%C3%ADpio/S%C3%A3o-Paulo"],
      ["/sobre/%c3%a1gua", "/en/sobre/%c3%a1gua"],
      ["/sobre/a\u0301gua", "/en/sobre/a\u0301gua"],
      ["/sobre/%F0%9F%92%A7", "/en/sobre/%F0%9F%92%A7"],
    ] as const;

    for (const [pt, en] of pares) {
      expect(analisarUrlPagina(pt), pt).toEqual({ idioma: "pt", caminhoPt: pt, sufixo: "" });
      expect(analisarUrlPagina(en), en).toEqual({ idioma: "en", caminhoPt: pt, sufixo: "" });
      expect(urlDaPagina(pt, "en"), pt).toBe(en);
      expect(urlDaPagina(en, "pt"), en).toBe(pt);
    }
  });

  it("exclui recursos compartilhados, arquivos e imagens sociais nos dois prefixos", () => {
    const recursos = [
      "/api", "/api/auth/eu", "/api/eficiencia-mobilidade/exportar",
      "/_next", "/_next/static/a.js", "/obs", "/obs/data/gold/meta.json",
      "/home", "/home/credito.webp", "/energia", "/energia/series/pld.csv",
      "/eficiencia", "/eficiencia/gold/meta.json", "/estado", "/estado/gold/meta.json",
      "/gas", "/gas/gold/meta.json", "/contas-estaduais", "/contas-estaduais/gold/meta.json",
      "/saneamento/gold", "/saneamento/gold/municipios.csv", "/i18n", "/i18n/en/energia/meta.json",
      "/contas-publicas-estaduais/comparacao.csv", "/resumo/feed.xml", "/robots.txt", "/sitemap.xml",
      "/opengraph-image", "/twitter-image", "/dados/pix/opengraph-image", "/sobre/twitter-image-aBc123_",
    ];

    for (const recurso of recursos) {
      for (const href of [recurso, `/en${recurso}`, `${recurso}?download=1#arquivo`, `/en${recurso}?download=1#arquivo`]) {
        expect(analisarUrlPagina(href), href).toBeNull();
        expect(urlDaPagina(href, "pt"), href).toBeNull();
        expect(urlDaPagina(href, "en"), href).toBeNull();
      }
    }
  });

  it("não concede acesso nem altera a fronteira pública existente", () => {
    const abertas = [
      "/", "/sobre", "/sobre/governanca", "/entrar", "/cadastro/telefone",
      "/setor-eletrico/metodologia", "/gas-natural/metodologia", "/saneamento/metodologia",
      "/eficiencia-estatal/saude-capitais/metodos", "/contas-publicas/metodologia",
      "/home/credito.webp", "/api/auth/eu",
    ];
    const fechadas = [
      "/observatorio", "/setor-eletrico/pld", "/gas-natural", "/saneamento/acesso",
      "/eficiencia-estatal/saude-capitais", "/contas-publicas/execucao", "/contas-publicas-estaduais",
      "/dados/api", "/app/admin", "/rota-que-ainda-nao-existe",
      "/en/app/admin", "/en/api", "/en/api/auth/eu", "/en/home", "/en/home/credito.webp",
      "/en/rota-que-ainda-nao-existe", "/api/eficiencia-mobilidade/exportar",
    ];

    for (const caminho of abertas) expect(ehRotaPublica(caminho), caminho).toBe(true);
    for (const caminho of fechadas) expect(ehRotaPublica(caminho), caminho).toBe(false);
    expect(ehApiDeDados("/api/eficiencia-mobilidade/exportar")).toBe(true);
  });
});
