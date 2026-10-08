import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { DOMINIOS, dominioDaSecao, dominioDoCaminho } from "@/lib/dominios";
import { isViewSection } from "@/lib/telemetry";
import { MODULOS_ENERGIA } from "@/lib/energia/navegacao";

/**
 * Regressão da plataforma de observatórios (docs/observatorios/MAPA_DE_ROTAS.md):
 * o Crédito continua intacto, o Setor Elétrico e a Eficiência Estatal são
 * domínios da mesma plataforma (mesma sessão, mesma telemetria, mesma superfície pública).
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

function paginas(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) paginas(p, out);
    else if (n === "page.tsx") out.push(p);
  }
  return out;
}

describe("registro de domínios", () => {
  it("três observatórios, ids e rotas estáveis, acento próprio", () => {
    expect(DOMINIOS.map((d) => d.id)).toEqual(["credito", "energia", "eficiencia"]);
    const [c, e, f] = DOMINIOS;
    expect(c.rotaRaiz).toBe("/observatorio");
    expect(e.rotaRaiz).toBe("/setor-eletrico");
    expect(f.rotaRaiz).toBe("/eficiencia-estatal/educacao-municipal-capitais");
    expect(c.acento).toBe("bronze");
    expect(e.acento).toBe("energia");
    expect(f.acento).toBe("obee");
  });

  it("a rota de entrada da Eficiência Estatal existe e consta do sitemap", () => {
    expect(existsSync(join(raiz, "src", "app", "eficiencia-estatal", "educacao-municipal-capitais", "page.tsx"))).toBe(true);
    expect(sitemap().map((u) => u.url)).toContain("https://scrutiniums.com" + DOMINIOS[2].rotaRaiz);
  });

  it("a Eficiência Estatal está na home, no seletor, na escolha pós login, no cabeçalho, no rodapé e na SPA do Crédito", () => {
    const rota = DOMINIOS[2].rotaRaiz;
    expect(ler("src/components/home/SecaoObservatorios.tsx")).toContain("DOMINIOS.map");
    expect(ler("src/components/layout/SwitcherObservatorio.tsx")).toContain("DOMINIOS.map");
    expect(ler("src/app/app/(foco)/observatorios/page.tsx")).toContain("DOMINIOS.map");
    expect(ler("src/components/layout/PublicHeader.tsx")).toContain(rota);
    expect(ler("src/components/layout/Footer.tsx")).toContain(rota);
    expect(ler("public/obs/index.html")).toContain(`href="${rota}"`);
  });

  it("os textos públicos da plataforma não falam mais em dois observatórios", () => {
    for (const f of [
      "src/app/page.tsx",
      "src/app/layout.tsx",
      "src/components/home/SecaoObservatorios.tsx",
      "src/components/home/SecaoPlataforma.tsx",
      "src/components/home/SecaoAcesso.tsx",
      "src/components/layout/Footer.tsx",
      "src/app/app/(foco)/observatorios/page.tsx",
    ]) {
      expect(ler(f), f).not.toMatch(/dois observat/i);
    }
  });

  it("seção e caminho resolvem o domínio certo", () => {
    expect(dominioDaSecao("obs:overview")).toBe("credito");
    expect(dominioDaSecao("energia:pld")).toBe("energia");
    expect(dominioDoCaminho("/setor-eletrico/pld")).toBe("energia");
    expect(dominioDoCaminho("/observatorio/credit")).toBe("credito");
    expect(dominioDaSecao("eficiencia:educacao")).toBe("eficiencia");
    expect(dominioDoCaminho("/eficiencia-estatal/educacao-municipal-capitais")).toBe("eficiencia");
  });

  it("a descrição do Setor Elétrico não promete previsão enquanto nenhum modelo está em produção", () => {
    const mods = JSON.parse(ler("public/energia/gold/modelos.json"));
    if (mods.em_producao.length === 0) {
      const e = DOMINIOS[1];
      expect(`${e.descricao} ${e.descricaoCurta}`).not.toMatch(/prev(ê|e)|previsões do PLD|projeç/i);
    }
  });
});

describe("Crédito preservado", () => {
  it("rotas públicas e SPA do Crédito continuam no lugar", () => {
    for (const p of [
      "src/app/observatorio",
      "src/app/observatorio-do-credito/page.tsx",
      "src/app/dados/page.tsx",
      "src/app/imprensa/page.tsx",
      "public/obs/index.html",
      "public/obs/app.js",
    ]) {
      expect(existsSync(join(raiz, p)), p).toBe(true);
    }
  });

  it("redirecionamentos antigos seguem valendo e os novos não capturam rota do Crédito", () => {
    const cfg = ler("next.config.mjs");
    for (const r of [
      'source: "/app/atividade", destination: "/observatorio/credit"',
      'source: "/metodologia", destination: "/observatorio/methodology"',
      'source: "/credito", destination: "/observatorio"',
      'source: "/app", destination: "/app/observatorios"',
    ]) {
      expect(cfg).toContain(r);
    }
    expect(cfg).not.toMatch(/source: "\/observatorio[/"]/);
  });

  it("o middleware continua protegendo só /app: observatórios são públicos", () => {
    const mw = ler("src/middleware.ts");
    expect(mw).toContain('if (!pathname.startsWith("/app")) return NextResponse.next();');
    expect(mw).not.toContain("setor-eletrico");
  });

  it("a SPA do Crédito oferece a troca de observatório no desktop e no celular", () => {
    const html = ler("public/obs/index.html");
    expect(html).toContain('class="obs-switcher"');
    expect(html).toContain('href="/setor-eletrico"');
    expect(html).toContain('class="mobile-obs"');
    expect(html).toContain('href="/app/observatorios"');
  });
});

describe("telemetria por domínio", () => {
  it("toda seção marcada nas páginas do Setor Elétrico é aceita pela telemetria", () => {
    const secoes = new Set<string>();
    for (const f of paginas(join(raiz, "src", "app", "setor-eletrico"))) {
      Array.from(readFileSync(f, "utf-8").matchAll(/secao="([^"]+)"/g)).forEach((m) => secoes.add(m[1]));
    }
    expect(secoes.size).toBeGreaterThanOrEqual(15);
    for (const s of Array.from(secoes)) {
      expect(isViewSection(s), s).toBe(true);
      expect(dominioDaSecao(s), s).toBe("energia");
    }
  });
});

describe("páginas do Setor Elétrico", () => {
  const todas = paginas(join(raiz, "src", "app", "setor-eletrico"));

  it("cada módulo da navegação tem página", () => {
    for (const m of MODULOS_ENERGIA) {
      const rel = m.href.replace(/^\/setor-eletrico\/?/, "");
      const p = join(raiz, "src", "app", "setor-eletrico", rel, "page.tsx");
      expect(existsSync(p), m.href).toBe(true);
    }
  });

  it("todas são estáticas (gold lida no build) e declaram URL canônica", () => {
    for (const f of todas) {
      const t = readFileSync(f, "utf-8");
      expect(t, f).toContain('export const dynamic = "force-static"');
      expect(t, f).toContain("canonical");
      if (f.includes("[")) expect(t, f).toContain("generateStaticParams");
    }
  });

  it("nenhuma página do domínio escreve hexadecimal solto (só tokens)", () => {
    for (const f of todas) expect(readFileSync(f, "utf-8"), f).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("sitemap", () => {
  const urls = sitemap().map((u) => u.url.replace("https://scrutiniums.com", ""));

  it("inclui os módulos do Setor Elétrico e mantém o Crédito", () => {
    for (const m of MODULOS_ENERGIA) expect(urls, m.href).toContain(m.href);
    for (const p of ["", "/observatorio", "/observatorio-do-credito", "/dados", "/setor-eletrico/metodologia", "/setor-eletrico/pld/previsoes"]) {
      expect(urls, p).toContain(p);
    }
  });

  it("verbete em preparação e área logada ficam fora", () => {
    expect(urls.some((u) => u.startsWith("/app"))).toBe(false);
    expect(urls).not.toContain("/setor-eletrico/aprenda/gsf");
  });
});
