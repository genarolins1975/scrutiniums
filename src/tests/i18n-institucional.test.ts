import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INSTITUCIONAL, preenchido, textosInstitucionais } from "@/lib/institucional";
import { secoesInstitucionais } from "@/lib/sobre";
import { contato } from "@/lib/contato";
import { DESCRICAO_REGISTRO_EN } from "@/i18n/paginas/erros";
import { hrefNoIdioma } from "@/lib/i18n-href";
import { traducaoPublicada } from "@/lib/i18n-rotas";

/**
 * Páginas institucionais em inglês (Sobre, Erros, Governança). O que se trava:
 * todo texto institucional preenchido em português tem a tradução de cortesia;
 * a descrição do registro de erros não muda sem a tradução acompanhar; links
 * internos só trocam para /en quando a irmã tem tradução publicada.
 */
describe("textos institucionais em inglês", () => {
  it("cada campo PT preenchido tem o EN correspondente, sem nomear entidades", () => {
    const pt = textosInstitucionais(INSTITUCIONAL, "pt");
    const en = textosInstitucionais(INSTITUCIONAL, "en");
    for (const campo of Object.keys(pt) as (keyof typeof pt)[]) {
      if (preenchido(pt[campo])) expect(preenchido(en[campo]), campo).toBe(true);
    }
    expect(en.conflitos_de_interesse).not.toMatch(/FGC|Fundo Garantidor|Associação Open Finance|AOF/);
    expect(en.licenca_derivados).toContain("CC BY 4.0");
  });

  it("as seções de Sobre têm os mesmos ids nos dois idiomas", () => {
    expect(secoesInstitucionais(INSTITUCIONAL, "en").map((s) => s.id)).toEqual(secoesInstitucionais(INSTITUCIONAL, "pt").map((s) => s.id));
    expect(secoesInstitucionais(INSTITUCIONAL, "en")[0].titulo).toBe("Who maintains it");
  });

  it("o contato em inglês troca só o rótulo", () => {
    const pt = contato(INSTITUCIONAL, "pt");
    const en = contato(INSTITUCIONAL, "en");
    expect(en.principal.href).toBe(pt.principal.href);
    expect(en.principal.rotulo).toBe("Maintainer's LinkedIn");
  });

  it("a descrição portuguesa do registro de erros é a que a tradução inglesa cobre", () => {
    const r = JSON.parse(readFileSync(join(process.cwd(), "pesquisa", "registro_erros.json"), "utf-8"));
    expect(r.descricao).toBe("Registro público de erros do Observatório (docs/CONSTITUICAO.md, art. 10). Cada erro publicado fica registrado com datas, canal de detecção e correção; nada é apagado. Campo com valor null = não apurado, nunca estimado. Alimenta os degraus de autonomia: erro relevante em nota rebaixa o tipo de nota ao degrau 1.");
    expect(DESCRICAO_REGISTRO_EN).toMatch(/^Public error log/);
  });
});

describe("links internos no idioma da página", () => {
  it("em inglês, só irmãs traduzidas trocam para /en; query e fragmento são preservados", () => {
    expect(traducaoPublicada("/sobre")).toBe(true);
    expect(hrefNoIdioma("/sobre", "en")).toBe("/en/sobre");
    expect(hrefNoIdioma("/sobre#correcao", "en")).toBe("/en/sobre#correcao");
    expect(hrefNoIdioma("/#obs-gas", "en")).toBe("/en#obs-gas");
    expect(hrefNoIdioma("/termos", "en")).toBe("/termos");
    expect(hrefNoIdioma("/dados/api", "en")).toBe("/dados/api");
    expect(hrefNoIdioma("https://doi.org/x", "en")).toBe("https://doi.org/x");
    expect(hrefNoIdioma("/sobre", "pt")).toBe("/sobre");
  });
});
