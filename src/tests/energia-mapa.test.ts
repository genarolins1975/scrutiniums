import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { MODULOS_ENERGIA } from "@/lib/energia/navegacao";
import { ANCORAS_VISAO_GERAL, GRUPOS_PERGUNTAS, PAGINAS_MAPA, PASSOS, TRILHAS } from "@/lib/energia/mapa";

/**
 * Mapa do Observatório (página inicial do domínio, no molde do Mapa do Crédito):
 * todo link leva a uma página que existe, a pergunta de cada módulo é o título
 * da própria página, conceito citado tem verbete e links antigos da visão geral
 * continuam chegando à seção certa.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const arquivoDaRota = (href: string) => {
  const caminho = href.split(/[?#]/)[0].replace(/^\/setor-eletrico\/?/, "");
  return join(raiz, "src", "app", "setor-eletrico", caminho, "page.tsx");
};
const ancora = (href: string) => (href.includes("#") ? href.split("#")[1] : null);

describe("mapa do observatório", () => {
  it("é a página inicial do domínio, com a visão geral numa página própria", () => {
    const mapa = ler("src/app/setor-eletrico/page.tsx");
    expect(mapa).toContain("Mapa do Observatório");
    expect(mapa).toContain('canonical: "/setor-eletrico"');
    expect(ler("src/app/setor-eletrico/visao-geral/page.tsx")).toContain('canonical: "/setor-eletrico/visao-geral"');
    expect(MODULOS_ENERGIA[0]).toMatchObject({ slug: "mapa", href: "/setor-eletrico" });
    expect(MODULOS_ENERGIA.find((m) => m.slug === "visao-geral")?.href).toBe("/setor-eletrico/visao-geral");
  });

  it("todo link do mapa e das trilhas leva a uma página que existe, e toda âncora existe na página", () => {
    const hrefs = [
      ...Object.values(PAGINAS_MAPA).map((p) => p.href),
      ...TRILHAS.flatMap((t) => t.passos.map((s) => s.href ?? PAGINAS_MAPA[s.pagina].href)),
    ];
    for (const h of hrefs) {
      const dinamica = h.startsWith("/setor-eletrico/aprenda/") || h.startsWith("/setor-eletrico/dados/");
      const f = dinamica ? arquivoDaRota(h.replace(/\/[^/]+$/, "/[x]")).replace("[x]", h.includes("aprenda") ? "[conceito]" : "[dataset]") : arquivoDaRota(h);
      expect(existsSync(f), h).toBe(true);
      const a = ancora(h);
      if (a && !dinamica) expect(readFileSync(f, "utf-8"), h).toMatch(new RegExp(`id="${a}"|id=\\{?"${a}"|id: "${a}"`));
    }
    // verbete e conjunto citados nas trilhas existem
    expect(CONCEITOS.find((c) => c.slug === "pld")?.estado).toBe("CONFERIDO");
  });

  it("a pergunta de cada módulo é o título da própria página", () => {
    for (const id of ["agua-e-clima", "geracao", "carga", "rede", "mercado", "empresas", "expansao", "regulacao"] as const) {
      const pg = PAGINAS_MAPA[id];
      expect(ler(`src/app/setor-eletrico/${id}/page.tsx`), id).toContain(`titulo="${pg.pergunta}"`);
    }
    expect(ler("src/app/setor-eletrico/pld/page.tsx")).toContain(`titulo="${PAGINAS_MAPA["pld-o-que-e"].pergunta}"`);
  });

  it("todo módulo da navegação aparece no mapa, e todo passo e grupo cita páginas do mapa", () => {
    const hrefsMapa = Object.values(PAGINAS_MAPA).map((p) => p.href.split(/[?#]/)[0]);
    for (const m of MODULOS_ENERGIA) {
      if (m.slug === "mapa") continue;
      expect(hrefsMapa.some((h) => h === m.href), m.href).toBe(true);
    }
    for (const p of PASSOS) for (const id of p.paginas) expect(PAGINAS_MAPA[id], `${p.id}: ${id}`).toBeTruthy();
    for (const g of GRUPOS_PERGUNTAS) for (const id of g.paginas) expect(PAGINAS_MAPA[id], `${g.rotulo}: ${id}`).toBeTruthy();
    // os módulos em integração estão marcados como tal
    for (const m of MODULOS_ENERGIA.filter((x) => !x.integrado)) {
      const pg = Object.values(PAGINAS_MAPA).find((p) => p.href === m.href);
      expect(pg?.estado, m.href).toBe("integracao");
    }
  });

  it("conceito citado num passo tem verbete; verbete pendente não é apresentado como definido", () => {
    for (const p of PASSOS) {
      for (const c of p.conceitos) expect(CONCEITOS.find((x) => x.slug === c.slug), `${p.id}: ${c.slug}`).toBeTruthy();
    }
    // o texto dos passos não define os conceitos ainda pendentes
    const pendentes = CONCEITOS.filter((c) => c.estado === "PENDENTE");
    const textos = PASSOS.map((p) => p.texto).join(" ");
    for (const c of pendentes) if (c.sigla) expect(textos, c.slug).not.toMatch(new RegExp(`\\b${c.sigla}\\b (é|são|significa)`));
  });

  it("links antigos com âncora da visão geral seguem para a nova página, e o mapa não reusa essas âncoras", () => {
    const visao = ler("src/app/setor-eletrico/visao-geral/page.tsx");
    for (const a of ANCORAS_VISAO_GERAL) expect(visao, a).toMatch(new RegExp(`id="${a}"|id: "${a}"|id=\\{\`${a}`));
    const mapa = ler("src/app/setor-eletrico/page.tsx");
    expect(mapa).toContain("<RedirecionaAncoraAntiga ancoras={ANCORAS_VISAO_GERAL}");
    for (const a of ANCORAS_VISAO_GERAL) expect(mapa, a).not.toContain(`id="${a}"`);
    for (const p of PASSOS) expect(ANCORAS_VISAO_GERAL, p.id).not.toContain(p.id);
  });

  it("o mapa não publica número novo: só contagens do próprio portal e datas de referência", () => {
    const mapa = ler("src/app/setor-eletrico/page.tsx");
    expect(mapa).not.toMatch(/\b(num|pct|reais|sinal)\(/);
  });
});

describe("\"Usado nas páginas\" de cada conjunto", () => {
  it("lista toda página que lê a gold alimentada pelo conjunto", async () => {
    const { DATASETS_INTEGRADOS } = await import("@/lib/energia/datasets");
    const porGold: Record<string, string[]> = {
      pld: ["ccee-pld-horario"],
      hidrologia: ["ons-ear-subsistema", "ons-ena-subsistema"],
      carga: ["ons-carga-diaria"],
      geracao: ["ons-balanco-energia"],
      rede: ["ons-intercambio"],
      cmo: ["ons-cmo-semanal"],
    };
    const paginas: Record<string, string> = {
      "/setor-eletrico/visao-geral": "src/app/setor-eletrico/visao-geral/page.tsx",
      "/setor-eletrico/pld": "src/app/setor-eletrico/pld/page.tsx",
      "/setor-eletrico/agua-e-clima": "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "/setor-eletrico/geracao": "src/app/setor-eletrico/geracao/page.tsx",
      "/setor-eletrico/carga": "src/app/setor-eletrico/carga/page.tsx",
      "/setor-eletrico/rede": "src/app/setor-eletrico/rede/page.tsx",
    };
    for (const [rota, arquivo] of Object.entries(paginas)) {
      const t = ler(arquivo);
      for (const m of Array.from(t.matchAll(/const (\w+) = gold\.(\w+)\(\)/g))) {
        const [, variavel, g] = m;
        const usada = (t.match(new RegExp(`\\b${variavel}\\b`, "g")) ?? []).length > 1;
        if (!usada || !porGold[g]) continue;
        for (const slug of porGold[g]) {
          const d = DATASETS_INTEGRADOS.find((x) => x.slug === slug)!;
          expect(d.paginas.map((p) => p.href.split("#")[0]), `${slug} em ${rota}`).toContain(rota);
        }
      }
    }
  });
});
