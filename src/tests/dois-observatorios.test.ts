import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sitemap from "@/app/sitemap";
import { DOMINIOS, dominioDaSecao, dominioDoCaminho } from "@/lib/dominios";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { isViewSection } from "@/lib/telemetry";
import { CONCEITOS } from "@/lib/energia/conteudo/conceitos";
import { MODULOS_ENERGIA } from "@/lib/energia/navegacao";

/**
 * Regressão da plataforma de observatórios (docs/observatorios/MAPA_DE_ROTAS.md):
 * o Crédito continua intacto, o Setor Elétrico e a Eficiência Estatal são
 * domínios da mesma plataforma (mesma sessão, mesma telemetria, mesma superfície pública).
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

/**
 * Destino a que um href da SPA do Crédito leva: ele mesmo ou o redirecionamento do
 * next.config.mjs. O endereço antigo da entrada do Território e Clima
 * (/observatorios/territorio-e-clima) continua na SPA e redireciona para /territorio.
 */
async function destinoFinal(href: string | undefined): Promise<string | undefined> {
  const config = (await import("../../next.config.mjs")).default as { redirects: () => Promise<{ source: string; destination: string }[]> };
  return (await config.redirects()).find((r) => r.source === href)?.destination ?? href;
}

function paginas(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) paginas(p, out);
    else if (n === "page.tsx") out.push(p);
  }
  return out;
}

describe("registro de domínios", () => {
  it("oito observatórios, ids e rotas estáveis, acento próprio", () => {
    expect(DOMINIOS.map((d) => d.id)).toEqual(["credito", "energia", "eficiencia", "contas", "estados", "saneamento", "gas", "agro"]);
    expect(DOMINIOS[5].rotaRaiz).toBe("/saneamento");
    expect(dominioDoCaminho("/saneamento/municipio/2611606")).toBe("saneamento");
    expect(dominioDaSecao("saneamento:acesso")).toBe("saneamento");
    expect(DOMINIOS[6].rotaRaiz).toBe("/gas-natural");
    expect(DOMINIOS[6].acento).toBe("gas");
    expect(dominioDoCaminho("/gas-natural")).toBe("gas");
    expect(dominioDoCaminho("/gas-natural/gas-de-cozinha")).toBe("gas");
    expect(dominioDoCaminho("/gas-naturalx")).toBeNull();
    expect(dominioDaSecao("gas:producao")).toBe("gas");
    expect(DOMINIOS[7].rotaRaiz).toBe("/agronegocio");
    expect(dominioDoCaminho("/agronegocio/atlas")).toBe("agro");
    expect(dominioDoCaminho("/agronegociox")).toBeNull();
    expect(dominioDaSecao("agro:panorama")).toBe("agro");
    const [c, e, f, contas] = DOMINIOS;
    expect(contas.rotaRaiz).toBe("/contas-publicas");
    expect(DOMINIOS[4].rotaRaiz).toBe("/contas-publicas-estaduais");
    expect(dominioDoCaminho("/contas-publicas-estaduais")).toBe("estados");
    expect(dominioDoCaminho("/contas-publicas-estaduais/despesas.csv")).toBe("estados");
    expect(dominioDaSecao("estados:ficha")).toBe("estados");
    expect(dominioDoCaminho("/contas-publicas/custos")).toBe("contas");
    expect(dominioDaSecao("contas:metas")).toBe("contas");
    expect(c.rotaRaiz).toBe("/observatorio");
    expect(e.rotaRaiz).toBe("/setor-eletrico");
    expect(f.rotaRaiz).toBe("/eficiencia-estatal");
    expect(c.acento).toBe("bronze");
    expect(e.acento).toBe("energia");
    expect(f.acento).toBe("obee");
  });

  it("a rota de entrada da Eficiência Estatal existe e consta do sitemap", () => {
    expect(existsSync(join(raiz, "src", "app", "eficiencia-estatal", "page.tsx"))).toBe(true);
    expect(existsSync(join(raiz, "src", "app", "eficiencia-estatal", "educacao-municipal-capitais", "page.tsx"))).toBe(true);
    expect(existsSync(join(raiz, "src", "app", "eficiencia-estatal", "saude-capitais", "page.tsx"))).toBe(true);
    // a entrada (retrato das capitais) é consulta aberta desde 19/10/2026 e entra no sitemap; os painéis de tema
    // exigem conta e ficam fora; a página de método do tema entra
    const urls = sitemap().map((u) => u.url);
    expect(urls).toContain("https://scrutiniums.com" + DOMINIOS[2].rotaRaiz);
    expect(urls).not.toContain("https://scrutiniums.com/eficiencia-estatal/educacao-municipal-capitais");
    expect(urls).toContain("https://scrutiniums.com/eficiencia-estatal/educacao-municipal-capitais/metodos");
  });

  it("a Eficiência Estatal está na home, no seletor, na escolha pós login, no cabeçalho, no rodapé e na SPA do Crédito", () => {
    const rota = DOMINIOS[2].rotaRaiz;
    expect(ler("src/components/home/SecaoObservatorios.tsx")).toContain("DOMINIOS.map");
    // o seletor lista as coleções do registro; a Síntese das capitais é a coleção da Eficiência Estatal (Iniciativa 1, 21/10/2026)
    expect(ler("src/components/layout/NavegacaoContexto.tsx")).toContain("o.colecoes.map");
    // a escolha pós login agrupa os cartões das coleções pelos seis observatórios
    expect(ler("src/app/app/(foco)/observatorios/page.tsx")).toContain("OBSERVATORIOS.map");
    expect(ler("src/app/app/(foco)/observatorios/page.tsx")).toContain("OPCOES_OBSERVATORIOS.filter");
    expect(ler("src/components/layout/PublicHeader.tsx")).toContain("<AbasCabecalho");
    // o cabeçalho público lista os seis observatórios; a Eficiência Estatal chega por eles (src/lib/observatorios/registro.ts)
    expect(ler("src/components/layout/navCabecalho.ts")).toContain("OBSERVATORIOS");
    // a barra dos painéis lista os seis observatórios; a coleção chega pelo seletor
    expect(ler("src/components/observatorios/NavegacaoObservatorios.tsx")).toContain("OBSERVATORIOS.map");
    // o rodapé lista as coleções do registro, coluna por observatório (Iniciativa 1, 21/10/2026); a Síntese das capitais leva à rota
    expect(ler("src/components/layout/Footer.tsx")).toContain("o.colecoes.map");
    expect(OBSERVATORIOS.flatMap((o) => o.colecoes).some((c) => c.href === rota)).toBe(true);
    expect(ler("public/obs/index.html")).toContain(`href="${rota}"`);
  });

  it("todas as barras de abas listam os seis observatórios do registro, com os mesmos destinos", async () => {
    const { ABAS_OBSERVATORIOS } = await import("@/components/observatorios/NavegacaoObservatorios");
    const { OBSERVATORIOS, destinoObservatorio } = await import("@/lib/observatorios/lista");
    const spa = ler("public/obs/index.html");
    const barraSpa = spa.slice(spa.indexOf('class="obs-dominios"'), spa.indexOf("</nav>", spa.indexOf('class="obs-dominios"')));
    expect(ABAS_OBSERVATORIOS.map((a) => a.href)).toEqual(OBSERVATORIOS.map(destinoObservatorio));
    for (const o of OBSERVATORIOS) {
      const href = barraSpa.match(new RegExp(`<a href="([^"]+)"[^>]*>${o.nomeCurto}</a>`))?.[1];
      expect(await destinoFinal(href), o.id).toBe(destinoObservatorio(o));
    }
    expect(barraSpa).toContain('aria-current="true">Economia</a>');
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
    // o seletor da barra comum (desktop e celular) substituiu o da barra lateral, que o repetia
    expect(html).toContain('class="obs-trocar"');
    expect(html).toContain('href="/setor-eletrico"');
    // o atalho fixo "Setor Elétrico →" da antiga barra de celular saiu com ela (Iniciativa 2 do parecer de UX de 23/10/2026):
    // no celular o seletor da linha da marca guarda os mesmos destinos, como nas páginas da plataforma
    expect(html).not.toContain('class="mobile-obs"');
    expect(html).toContain('href="/app/observatorios"');
  });
});

describe("telemetria por domínio", () => {
  it("toda página do Gás Natural marca uma visita aceita e atribuída ao domínio do gás", () => {
    const dir = join(raiz, "src", "app", "gas-natural");
    const arquivos = paginas(dir);
    expect(arquivos.length).toBeGreaterThanOrEqual(12);
    for (const a of arquivos) {
      const secoes = Array.from(readFileSync(a, "utf-8").matchAll(/secao="([^"]+)"/g), (m) => m[1]);
      expect(secoes.length, a).toBeGreaterThan(0);
      for (const s of secoes) {
        expect(isViewSection(s), s).toBe(true);
        expect(dominioDaSecao(s), s).toBe("gas");
      }
    }
  });

  it("a visita emitida pelo painel estadual é aceita e atribuída ao domínio estadual", () => {
    const pagina = ler("src/app/contas-publicas-estaduais/page.tsx");
    const secoes = Array.from(pagina.matchAll(/<MarcaVisita secao="([^"]+)"/g), (m) => m[1]);
    expect(secoes).toHaveLength(1);
    for (const s of secoes) {
      expect(isViewSection(s), s).toBe(true);
      expect(dominioDaSecao(s), s).toBe("estados");
    }
  });

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

  it("só lista a vitrine pública: método e apresentação entram, painéis ficam de fora", () => {
    for (const p of ["", "/observatorio-do-credito", "/setor-eletrico/metodologia", "/setor-eletrico/aprenda", "/imprensa", "/glossario"]) {
      expect(urls, p).toContain(p);
    }
    for (const m of MODULOS_ENERGIA.filter((m) => !ehRotaPublica(m.href))) expect(urls, m.href).not.toContain(m.href);
    for (const p of ["/observatorio", "/dados", "/setor-eletrico/pld/previsoes", "/resumo"]) expect(urls, p).not.toContain(p);
    for (const u of urls) expect(ehRotaPublica(u || "/"), u).toBe(true);
  });

  it("verbete em preparação e área logada ficam fora; verbete conferido entra", () => {
    expect(urls.some((u) => u.startsWith("/app"))).toBe(false);
    for (const c of CONCEITOS) {
      const rota = `/setor-eletrico/aprenda/${c.slug}`;
      if (c.estado === "PENDENTE") expect(urls, rota).not.toContain(rota);
      else expect(urls, rota).toContain(rota);
    }
    expect(urls).toContain("/setor-eletrico/aprenda/gsf");
  });
});
