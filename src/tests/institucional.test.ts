import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INSTITUCIONAL, type Institucional } from "@/lib/institucional";
import { secoesInstitucionais, registroErros, dataOuNaoApurado } from "@/lib/sobre";
import { contato, LINKEDIN_URL } from "@/lib/contato";

/**
 * Frente 5: identidade institucional sem texto inventado. O que se trava:
 * - os campos de decisão do mantenedor nascem vazios em config/institucional.json;
 * - seção sem conteúdo não é renderizada; preenchida, aparece;
 * - contato do rodapé é o e-mail institucional quando há, com o LinkedIn secundário;
 * - /sobre é da plataforma e está no rodapé de todos os observatórios;
 * - a política de correção leva ao registro público de erros, publicado no site.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const cheio: Institucional = {
  ...INSTITUCIONAL,
  mantenedor: { nome: "Associação Exemplo", natureza_juridica: "associação civil sem fins lucrativos" },
  financiamento: "Recursos próprios.",
  conflitos_de_interesse: "Nenhum declarado.",
  email_institucional: "contato@exemplo.org",
  conselho_consultivo: [{ nome: "Pessoa A", afiliacao: "Universidade X" }],
};

describe("campos institucionais", () => {
  it("só trazem o que o mantenedor decidiu (14/10/2026); e-mail e conselho seguem vazios, sem nada inventado", () => {
    const c = JSON.parse(ler("config/institucional.json"));
    expect(c.mantenedor).toEqual({ nome: "Genaro Lins", natureza_juridica: "pessoa física" });
    expect(c.financiamento).toMatch(/^Mantida com recursos próprios do mantenedor/);
    expect(c.dados.licenca_derivados).toContain("CC BY 4.0");
    // o depósito no Zenodo exige o identificador do vocabulário de licenças, não o texto do site
    expect(c.dados.licenca_id).toBe("cc-by-4.0");
    const z = ler("scripts/zenodo_deposito.py");
    expect(z).toContain('.get("licenca_id")');
    expect(z).not.toContain('.get("licenca_derivados")');
    expect(c.email_institucional).toBe("");
    expect(c.conselho_consultivo).toEqual([]);
  });

  it("conflitos de interesse não nomeiam as entidades em que o responsável ocupa cargos", () => {
    const c = JSON.parse(ler("config/institucional.json"));
    expect(c.conflitos_de_interesse).toContain("/sobre/governanca");
    expect(c.conflitos_de_interesse).not.toMatch(/FGC|Fundo Garantidor|Associação Open Finance|AOF/);
  });

  it("seção vazia não é renderizada; preenchida, aparece com o texto do mantenedor", () => {
    const vazio: Institucional = { ...cheio, mantenedor: { nome: "", natureza_juridica: "" }, financiamento: " ", conflitos_de_interesse: "", email_institucional: "", conselho_consultivo: [] };
    expect(secoesInstitucionais(vazio)).toEqual([]);
    const s = secoesInstitucionais(cheio);
    expect(s.map((x) => x.id)).toEqual(["quem-mantem", "financiamento", "independencia", "conselho"]);
    expect(s[0].paragrafos[0]).toBe("Associação Exemplo (associação civil sem fins lucrativos).");
    expect(s[3].itens).toEqual(["Pessoa A, Universidade X"]);
  });

  it("contato: e-mail institucional quando preenchido, LinkedIn secundário; sem e-mail, só o LinkedIn", () => {
    expect(contato(cheio)).toEqual({
      principal: { rotulo: "contato@exemplo.org", href: "mailto:contato@exemplo.org" },
      secundario: { rotulo: "LinkedIn do responsável", href: LINKEDIN_URL },
    });
    expect(contato({ ...cheio, email_institucional: "" })).toEqual({ principal: { rotulo: "LinkedIn do responsável", href: LINKEDIN_URL }, secundario: null });
  });
});

describe("/sobre e rodapés", () => {
  it("a página tem política de correção, como citar e contato, e só renderiza as seções institucionais preenchidas", () => {
    const p = ler("src/components/institucional/SobreConteudo.tsx");
    for (const id of ['id="correcao"', 'id="citar"', 'id="contato"']) expect(p).toContain(id);
    expect(p).toContain("secoesInstitucionais(INSTITUCIONAL, idioma)");
    expect(p).toContain('h("/sobre/erros")');
    expect(p).not.toMatch(/projeto pessoal|associação|fundação|financiado por/i);
  });

  it("/sobre está no rodapé de todos os observatórios", () => {
    const footer = ler("src/components/layout/Footer.tsx");
    expect(footer.match(/href="\/sobre"/g)?.length).toBe(1); // rodapé compacto
    expect(footer).toContain('href={h("/sobre")}'); // rodapé completo, no idioma da página
    expect(ler("src/app/setor-eletrico/layout.tsx")).toContain("<Footer compacto />");
    expect(ler("src/app/eficiencia-estatal/layout.tsx")).toContain("<Footer />");
    expect(ler("src/app/gas-natural/layout.tsx")).toContain("<Footer />");
    // as Contas Federais e as Estaduais trocaram o rodapé próprio pelo rodapé comum (molde único, Iniciativa 4, 22/10/2026)
    expect(ler("src/app/contas-publicas/layout.tsx")).toContain("<Footer compacto/>");
    expect(ler("src/app/contas-publicas-estaduais/layout.tsx")).toContain("<Footer compacto />");
    // a aplicação do Crédito traz o rodapé da plataforma, renderizado do próprio Footer (Iniciativa 2 do parecer de UX de 23/10/2026)
    expect(ler("public/obs/index.html")).toMatch(/<a class="[^"]*" href="\/sobre">Sobre a Scrutiniums<\/a>/);
    expect(footer).toContain("<ContatoItens");
    expect(footer).not.toContain("Contato · LinkedIn");
  });

  it("o registro de erros publicado é o mesmo arquivo da auditoria, e nulo é 'não apurado'", () => {
    expect(ler(".github/workflows/auditoria-notas.yml")).toContain("pesquisa/registro_erros.json");
    const r = registroErros();
    expect(r.erros.length).toBeGreaterThan(0);
    const bruto = JSON.parse(ler("pesquisa/registro_erros.json")).erros as { publicado: boolean }[];
    expect(r.erros.length).toBe(bruto.filter((e) => e.publicado === true).length);
    expect(r.erros.every((e) => e.publicado === true)).toBe(true);
    for (const e of r.erros) expect(e.id).toMatch(/^E\d{3}$/);
    expect(dataOuNaoApurado(null)).toBe("não apurado");
    expect(dataOuNaoApurado("2026-09-05")).toBe("05/09/2026");
    expect(ler("src/app/sobre/erros/page.tsx")).toContain('export const dynamic = "force-static"');
    expect(ler("src/app/en/sobre/erros/page.tsx")).toContain('export const dynamic = "force-static"');
  });
});
