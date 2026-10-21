import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OMISSOES, blocos, constituicaoPublica, constituicaoPublicaEn, textoPublico } from "@/lib/governanca";
import { ehRotaPublica } from "@/lib/rotasPublicas";

/**
 * /sobre/governanca publica a Constituição a partir de docs/CONSTITUICAO.md.
 * O que se trava: as omissões decididas pelo mantenedor (14/10/2026) existem no
 * texto interno e somem do público; a página é aberta; todos os artigos aparecem.
 */
const interno = readFileSync(join(process.cwd(), "docs", "CONSTITUICAO.md"), "utf-8");

describe("Constituição pública", () => {
  it("cada trecho a omitir existe no texto interno; mudou, a montagem falha em vez de publicar", () => {
    for (const o of OMISSOES) expect(interno).toContain(o.de);
    expect(() => textoPublico(interno.replace(OMISSOES[0].de, "outro texto"))).toThrow(/trecho a omitir/);
  });

  it("o texto público não nomeia as entidades e mantém os temas vedados", () => {
    const t = textoPublico(interno);
    expect(t).not.toMatch(/FGC|Associação Open Finance Brasil/);
    expect(t).toContain("Garantias de depósito, regimes de resolução, liquidação ou intervenção.");
    expect(t).toContain("Open Finance e seus participantes.");
    expect(t).toContain("ocupa cargos de conselho e de diretoria em entidades do sistema financeiro");
  });

  it("todos os artigos viram seções com âncora, e listas e parágrafos são preservados", () => {
    const b = constituicaoPublica();
    const artigos = b.filter((x) => x.tipo === "artigo");
    expect(artigos.length).toBe((interno.match(/^## Art\./gm) ?? []).length);
    expect(artigos[0]).toMatchObject({ id: "art-1", texto: "Art. 1. Números" });
    expect(b[0]).toEqual({ tipo: "titulo", texto: "Constituição editorial do Observatório Brasileiro de Crédito" });
    expect(blocos("- a\n- b\n\n1. c")).toEqual([
      { tipo: "lista", ordenada: false, itens: ["a", "b"] },
      { tipo: "lista", ordenada: true, itens: ["c"] },
    ]);
  });

  it("a página é pública, estática e ligada a partir de /sobre", () => {
    expect(ehRotaPublica("/sobre/governanca")).toBe(true);
    const p = readFileSync(join(process.cwd(), "src/app/sobre/governanca/page.tsx"), "utf-8");
    expect(p).toContain('export const dynamic = "force-static"');
    expect(readFileSync(join(process.cwd(), "src/components/institucional/GovernancaConteudo.tsx"), "utf-8")).toContain("constituicaoPublica()");
    expect(readFileSync(join(process.cwd(), "src/components/institucional/SobreConteudo.tsx"), "utf-8")).toContain('h("/sobre/governanca")');
  });
});

describe("Constituição em inglês (tradução de cortesia)", () => {
  const en = constituicaoPublicaEn();
  const ptPublico = constituicaoPublica();
  const resumo = (b: ReturnType<typeof constituicaoPublica>) => b.map((x) => (x.tipo === "lista" ? `lista:${x.ordenada}:${x.itens.length}` : x.tipo === "artigo" ? `artigo:${x.id}` : x.tipo));

  it("tem os mesmos artigos, na mesma ordem, e o mesmo número de itens por lista", () => {
    expect(resumo(en)).toEqual(resumo(ptPublico));
  });

  it("não nomeia as entidades omitidas no português público e declara a versão portuguesa como prevalente", () => {
    const texto = readFileSync(join(process.cwd(), "docs", "CONSTITUICAO.en.md"), "utf-8");
    expect(texto).not.toMatch(/FGC|Fundo Garantidor|Associação Open Finance|AOF/);
    expect(texto).toContain("board and executive positions at entities in the financial system");
    expect(readFileSync(join(process.cwd(), "src/i18n/paginas/governanca.ts"), "utf-8")).toContain("the Portuguese version prevails");
  });
});
