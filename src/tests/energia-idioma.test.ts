import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// O Next instala o AsyncLocalStorage global no servidor dele; aqui o teste faz o mesmo antes dos imports.
vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import("node:async_hooks");
  (globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
});
import { staticGenerationAsyncStorage } from "next/dist/client/components/static-generation-async-storage.external";
import { idiomaDoCaminho, idiomaEnergia, porIdioma, tx } from "@/lib/energia/idioma";
import { carimbo, dataBR, dataCurta, dataExtenso, datasLegiveis, formatos, horaLocal, mesAno, mesAnoCurto, nomeSubmercado, normaLegivel, num, pct, reais, sinal } from "@/lib/energia/formato";
import { parDeIdioma, traducaoPublicada } from "@/lib/i18n-rotas";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { caminhoComParametros } from "@/lib/energia/metadados-idioma";

/** Fora de um render, vale português; dentro, o endereço da renderização decide. */
function emRender<T>(urlPathname: string, f: () => T): T {
  return (staticGenerationAsyncStorage as unknown as { run: (store: unknown, cb: () => T) => T }).run({ urlPathname }, f);
}

describe("idioma do Setor Elétrico pelo endereço", () => {
  it("lê /en e /en/... como inglês e o resto como português", () => {
    expect(idiomaDoCaminho("/en")).toBe("en");
    expect(idiomaDoCaminho("/en/setor-eletrico/pld")).toBe("en");
    expect(idiomaDoCaminho("/english")).toBe("pt");
    expect(idiomaDoCaminho("/setor-eletrico")).toBe("pt");
    expect(idiomaDoCaminho(null)).toBe("pt");
  });

  it("fora de render é português, e o português de tx sai igual ao original", () => {
    expect(idiomaEnergia()).toBe("pt");
    expect(tx("Leilões", "Auctions")).toBe("Leilões");
    expect(porIdioma("en", { pt: "a", en: "b" })).toBe("b");
  });

  it("dentro de um render, segue o endereço da página (armazenamento do Next ainda no lugar)", () => {
    expect(emRender("/en/setor-eletrico/leiloes", () => idiomaEnergia())).toBe("en");
    expect(emRender("/setor-eletrico/leiloes", () => idiomaEnergia())).toBe("pt");
    expect(emRender("/en/setor-eletrico", () => [tx("Leilões", "Auctions"), num(1552.5, 1), dataBR("2026-10-17")])).toEqual(["Auctions", "1,552.5", "Oct 17, 2026"]);
  });

  it("o package.json fixa a versão do Next de que o armazenamento depende", () => {
    expect(JSON.parse(readFileSync("package.json", "utf8")).dependencies.next).toBe("14.2.35");
  });
});

describe("formatos do Setor Elétrico nos dois idiomas", () => {
  it("português idêntico ao de antes", () => {
    expect(num(1552.25, 1)).toBe("1.552,3");
    expect(num(-3, 0)).toBe("−3");
    expect(reais(1234.5)).toBe("R$ 1.234,50");
    expect(pct(4.5)).toBe("4,5%");
    expect(sinal(2.5, 1, " p.p.")).toBe("+2,5 p.p.");
    expect(dataBR("2026-10-17")).toBe("17/10/2026");
    expect(dataBR("2026-10")).toBe("10/2026");
    expect(dataExtenso("2026-10-07")).toBe("7 de outubro de 2026");
    expect(dataCurta("2026-10-07")).toBe("07/10");
    expect(mesAno("2026-10")).toBe("out/2026");
    expect(mesAnoCurto("2023-05")).toBe("mai/23");
    expect(horaLocal("2026-09-27T16:00")).toBe("27/09/2026 às 16h");
    expect(carimbo("2026-10-17T19:05:00Z")).toBe("17/10/2026, 16:05 (Brasília)");
    expect(normaLegivel("LEI-10848-2004-03-15")).toBe("Lei 10.848, de 15/03/2004");
    expect(datasLegiveis("de 2013-01-01/2013-12-31 e 2024-05")).toBe("de 01/01/2013 a 31/12/2013 e mai/2024");
    expect(nomeSubmercado("SE")).toBe("Sudeste/Centro-Oeste");
  });

  it("inglês en-US, com o mesmo valor, precisão e fuso", () => {
    const f = formatos("en");
    expect(f.num(1552.25, 1)).toBe("1,552.3");
    expect(f.num(-3, 0)).toBe("−3");
    expect(f.reais(1234.5)).toBe("R$ 1,234.50");
    expect(f.pct(4.5)).toBe("4.5%");
    expect(f.sinal(2.5, 1, " p.p.")).toBe("+2.5 p.p.");
    expect(f.dataBR("2026-10-17")).toBe("Oct 17, 2026");
    expect(f.dataBR("2026-10")).toBe("Oct 2026");
    expect(f.dataExtenso("2026-10-07")).toBe("October 7, 2026");
    expect(f.dataCurta("2026-10-07")).toBe("Oct 7");
    expect(f.mesAno("2026-10")).toBe("Oct 2026");
    expect(f.mesAnoCurto("2023-05")).toBe("May ’23");
    expect(f.horaLocal("2026-09-27T16:00")).toBe("Sep 27, 2026, 16:00");
    expect(f.carimbo("2026-10-17T19:05:00Z")).toBe("Oct 17, 2026, 16:05 (Brasília time)");
    expect(f.normaLegivel("LEI-10848-2004-03-15")).toBe("Law 10,848 of Mar 15, 2004");
    expect(f.datasLegiveis("from 2013-01-01/2013-12-31 and 2024-05")).toBe("from Jan 1, 2013 to Dec 31, 2013 and May 2024");
    expect(f.nomeSubmercado("SE")).toBe("Southeast/Center-West");
    expect(f.num(null)).toBe("–");
  });
});

describe("rotas do Setor Elétrico nos dois idiomas", () => {
  it("páginas literais e com parâmetro têm irmã traduzida", () => {
    expect(parDeIdioma("/setor-eletrico/leiloes")).toMatchObject({ en: "/en/setor-eletrico/leiloes", conteudo: "traduzido" });
    expect(parDeIdioma("/setor-eletrico/empresas/listadas/AXIA3")).toMatchObject({ en: "/en/setor-eletrico/empresas/listadas/AXIA3", conteudo: "traduzido" });
    expect(parDeIdioma("/setor-eletrico/empresas/listadas/AXIA3/extra")).toBeNull();
    expect(traducaoPublicada("/setor-eletrico/pld/modelos/sazonal")).toBe(true);
  });

  it("links internos em inglês vão para /en, preservando consulta e âncora", () => {
    expect(hrefNoIdioma("/setor-eletrico/pld?sub=SE#historico", "en")).toBe("/en/setor-eletrico/pld?sub=SE#historico");
    expect(hrefNoIdioma("/setor-eletrico/pld", "pt")).toBe("/setor-eletrico/pld");
    expect(hrefNoIdioma("/energia/gold/pld.json", "en")).toBe("/energia/gold/pld.json");
    // destino de redirecionamento de alias de distribuidora (ficha com parâmetro) também fica em inglês
    expect(hrefNoIdioma("/setor-eletrico/empresas/rge", "en")).toBe("/en/setor-eletrico/empresas/rge");
  });

  it("a irmã inglesa de um painel continua exigindo conta e leva ao login inglês com o destino", async () => {
    const { NextRequest } = await import("next/server");
    const { middleware } = await import("@/middleware");
    const { ehRotaPublica } = await import("@/lib/rotasPublicas");
    for (const [caminho, entrada] of [["/setor-eletrico/pld", "/entrar"], ["/en/setor-eletrico/pld", "/en/entrar"], ["/en/setor-eletrico/empresas/listadas/AXIA3", "/en/entrar"]]) {
      expect(ehRotaPublica(caminho), caminho).toBe(false);
      const resposta = await middleware(new NextRequest("https://scrutiniums.com" + caminho, { headers: { accept: "text/html" } }));
      const login = new URL(entrada, "https://scrutiniums.com");
      login.searchParams.set("de", caminho);
      expect(resposta.status, caminho).toBe(307);
      expect(resposta.headers.get("location"), caminho).toBe(login.href);
    }
    for (const caminho of ["/en/setor-eletrico/metodologia", "/en/setor-eletrico/aprenda/pld"]) expect(ehRotaPublica(caminho), caminho).toBe(true);
  });

  it("monta o caminho concreto de uma página com parâmetro", () => {
    expect(caminhoComParametros("/setor-eletrico/empresas/listadas/[papel]", { papel: "AXIA3" })).toBe("/setor-eletrico/empresas/listadas/AXIA3");
  });

  it("toda página portuguesa tem a irmã gerada e declarada", async () => {
    const { execFileSync } = await import("node:child_process");
    expect(() => execFileSync("node", ["scripts/i18n/irmas-energia.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });
});
