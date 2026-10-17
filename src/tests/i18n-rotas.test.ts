import { describe, expect, it } from "vitest";
import inventario from "../../config/i18n-inventario.json";
import { PARES_DE_IDIOMA, parDeIdioma } from "@/lib/i18n-rotas";

describe("registro de irmãs por idioma", () => {
  it("deriva os pares da declaração única e preserva o estado de fallback", () => {
    expect(PARES_DE_IDIOMA.map(({ pt, conteudo }) => ({ pt, conteudo })))
      .toEqual(inventario.rotas.literais);
    expect(PARES_DE_IDIOMA).toContainEqual({
      pt: "/sobre", en: "/en/sobre", conteudo: "traduzido",
    });
    for (const par of PARES_DE_IDIOMA) {
      expect(par.en).toBe(par.pt === "/" ? "/en" : "/en" + par.pt);
      expect(parDeIdioma(par.pt)).toEqual(par);
      expect(parDeIdioma(par.en)).toEqual(par);
    }
  });

  it("consulta as duas grafias e devolve o par canônico sem carregar query ou fragmento", () => {
    const esperado = { pt: "/sobre", en: "/en/sobre", conteudo: "traduzido" };
    for (const href of [
      "/sobre", "/sobre/", "/en/sobre", "/en/sobre/",
      "/sobre?origem=menu#contato", "/en/sobre/?q=a+b&q=a%20b#contato",
      "/en/sobre?de=https://example.org/pagina?origem=menu#contato",
    ]) expect(parDeIdioma(href), href).toEqual(esperado);
  });

  it("não infere irmãs por prefixo, recurso ou endereço disfarçado", () => {
    for (const href of [
      "/sobrecarga", "/en/sobrecarga", "/en/sobre/rota-inexistente-i18n",
      "/en/sobre/opengraph-image", "/en/api/auth/eu", "/en/home/credito.webp",
      "/en/en/sobre", "/english/sobre", "/%65n/sobre", "/en/%73obre",
      "/en//sobre", "/en/../sobre", "https://scrutiniums.com/en/sobre",
    ]) expect(parDeIdioma(href), href).toBeNull();
  });
});
