import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ABAS_OBSERVATORIO,
  PREFIXOS_DINAMICOS,
  ROTAS_APOSENTADAS,
  abaPorCaminho,
} from "@/lib/data/observatorioAbas";
import { montarHtml, resolverMeta } from "@/lib/observatorioHead";

/**
 * Observatório público e indexável: o middleware não pode mais barrar a
 * leitura, cada aba precisa de metadados próprios (title, description,
 * canonical, OG, JSON-LD) e o catálogo de abas não pode divergir dos
 * mapas ROUTES/VIEW_TITLES da SPA.
 */

const raiz = process.cwd();
const middleware = readFileSync(join(raiz, "src/middleware.ts"), "utf-8");
const appJs = readFileSync(join(raiz, "public/obs/app.js"), "utf-8");
const indexHtml = readFileSync(join(raiz, "public/obs/index.html"), "utf-8");
const sitemap = readFileSync(join(raiz, "src/app/sitemap.ts"), "utf-8");

function extrairMapa(fonte: string, nome: string): Record<string, string> {
  const m = fonte.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\};`));
  expect(m, `mapa ${nome} não encontrado na SPA`).toBeTruthy();
  const out: Record<string, string> = {};
  for (const par of Array.from(m![1].matchAll(/(\w+): "([^"]*)"/g))) out[par[1]] = par[2];
  return out;
}

describe("camada pública de leitura", () => {
  it("o middleware protege apenas /app", () => {
    const matcher = middleware.slice(middleware.indexOf("matcher:"));
    expect(matcher).toContain('"/app/:path*"');
    expect(matcher).not.toMatch(/observatorio/);
    expect(matcher).not.toMatch(/"\/obs/);
  });

  it("a SPA oferece Entrar ao visitante e conta/sair só a quem tem sessão", () => {
    expect(indexHtml).toMatch(/id="loginBtn" href="\/entrar\?de=%2Fobservatorio"/);
    expect(indexHtml).toMatch(/id="accountBtn"[^>]*hidden/);
    expect(indexHtml).toMatch(/id="logoutBtn"[^>]*hidden/);
    expect(appJs).toContain('fetch("/api/auth/eu"');
  });

  it("a checagem de sessão da SPA existe, é mínima e sem cache", () => {
    const rota = readFileSync(join(raiz, "src/app/api/auth/eu/route.ts"), "utf-8");
    expect(rota).toContain("getSessionUser");
    expect(rota).toContain('"Cache-Control": "no-store"');
    expect(rota).not.toMatch(/user\.(email|phone|nome)/);
  });
});

describe("catálogo de abas ↔ SPA", () => {
  const routes = extrairMapa(appJs, "ROUTES");
  const titulos = extrairMapa(appJs, "VIEW_TITLES");

  it("toda rota estática da SPA tem metadados no catálogo, com o mesmo título", () => {
    for (const [view, caminho] of Object.entries(routes)) {
      if (caminho.endsWith("/")) continue; // dinâmicas (inst/product/sector)
      const aba = ABAS_OBSERVATORIO.find((a) => a.view === view);
      expect(aba, `aba sem metadados: ${view} (${caminho})`).toBeTruthy();
      expect(aba!.caminho, view).toBe(caminho);
      expect(aba!.titulo, view).toBe(titulos[view]);
    }
  });

  it("toda rota dinâmica da SPA tem prefixo registrado", () => {
    const dinamicas = Object.entries(routes).filter(([, c]) => c.endsWith("/"));
    for (const [view, caminho] of dinamicas) {
      const d = PREFIXOS_DINAMICOS.find((p) => p.prefixo === caminho);
      expect(d, `prefixo dinâmico sem registro: ${view} (${caminho})`).toBeTruthy();
    }
  });

  it("o catálogo não inventa rota que a SPA não conhece", () => {
    const caminhos = new Set(Object.values(routes));
    for (const aba of ABAS_OBSERVATORIO) {
      expect(caminhos.has(aba.caminho), aba.caminho).toBe(true);
    }
  });

  it("a rota aposentada espelha a da SPA", () => {
    expect(appJs).toContain('"/leading-indicators"');
    expect(ROTAS_APOSENTADAS["/leading-indicators"]).toBe("/leading-signals");
    expect(abaPorCaminho("/leading-indicators")?.view).toBe("leading");
  });

  it("toda description é substantiva e todo gold declarado existe", () => {
    for (const aba of ABAS_OBSERVATORIO) {
      expect(aba.descricao.length, aba.view).toBeGreaterThanOrEqual(60);
      expect(aba.descricao.length, aba.view).toBeLessThanOrEqual(220);
      if (aba.gold) {
        expect(
          existsSync(join(raiz, "public/obs/data/gold", aba.gold)),
          `gold ausente: ${aba.gold}`,
        ).toBe(true);
      }
    }
  });
});

describe("metadados por rota", () => {
  it("raiz: canônico /observatorio, indexável", () => {
    const m = resolverMeta("/");
    expect(m.status).toBe(200);
    expect(m.indexavel).toBe(true);
    expect(m.canonico).toBe("https://scrutiniums.com/observatorio");
  });

  it("aba conhecida: título próprio, canônico próprio e dataset", () => {
    const m = resolverMeta("/bets-financial-risk");
    expect(m.titulo).toContain("Bets e risco financeiro");
    expect(m.canonico).toBe("https://scrutiniums.com/observatorio/bets-financial-risk");
    expect(m.gold).toBe("bets.json");
  });

  it("instituição conhecida ganha o nome no título; desconhecida vira 404", () => {
    const idx = JSON.parse(
      readFileSync(join(raiz, "public/obs/data/gold/inst_index.json"), "utf-8"),
    );
    const { cod, nome } = idx.instituicoes[0];
    const m = resolverMeta(`/institutions/${cod}`);
    expect(m.status).toBe(200);
    expect(m.titulo).toContain(nome);
    expect(resolverMeta("/institutions/NAO-EXISTE-123").status).toBe(404);
  });

  it("rota desconhecida ou slug malicioso: 404 com noindex", () => {
    for (const caminho of ["/nao-existe", '/products/<script>alert(1)</script>']) {
      const m = resolverMeta(caminho);
      expect(m.status, caminho).toBe(404);
      expect(m.indexavel, caminho).toBe(false);
      const html = montarHtml(m);
      expect(html).toContain('<meta name="robots" content="noindex">');
      expect(html).not.toContain("<script>alert(1)</script>");
    }
  });

  it("o HTML servido injeta title, description, OG, canônico e JSON-LD", () => {
    const html = montarHtml(resolverMeta("/financial-fraud"));
    expect(html).toContain("<title>Fraudes financeiras e risco de crédito · Observatório Brasileiro de Crédito</title>");
    expect(html).toContain('<link rel="canonical" href="https://scrutiniums.com/observatorio/financial-fraud">');
    expect(html).toContain('<meta property="og:url" content="https://scrutiniums.com/observatorio/financial-fraud">');
    expect(html).toContain('"@type":"Dataset"');
    expect(html).toContain("/obs/data/gold/fraudes.json");
    // o corpo continua sendo a SPA
    expect(html).toContain('<script src="/obs/app.min.js');
  });

  it("o sitemap cobre o Observatório inteiro e a página de imprensa", () => {
    expect(sitemap).toContain("ABAS_OBSERVATORIO");
    expect(sitemap).toContain('"/observatorio"');
    expect(sitemap).toContain("/observatorio/institutions/");
    expect(sitemap).toContain('"/imprensa"');
  });
});

describe("páginas municipais de presença bancária", () => {
  const gold = JSON.parse(
    readFileSync(join(raiz, "public/obs/data/gold/presenca_mun.json"), "utf-8"),
  ) as { municipios: { cod: string; nome: string; uf: string; classe: string }[] };
  const porClasse = (c: string) => gold.municipios.find((m) => m.classe === c);

  it("todo município do gold vira página indexável com nome no título e Dataset", () => {
    const m = gold.municipios[0];
    const meta = resolverMeta(`/presenca/${m.cod}`);
    expect(meta.status).toBe(200);
    expect(meta.indexavel).toBe(true);
    expect(meta.titulo).toContain(`Presença bancária em ${m.nome} (${m.uf})`);
    expect(meta.canonico).toBe(`https://scrutiniums.com/observatorio/presenca/${m.cod}`);
    expect(meta.gold).toBe("presenca_mun.json");
    const html = montarHtml(meta);
    expect(html).toContain('"@type":"Dataset"');
    expect(html).toContain("/obs/data/gold/presenca_mun.json");
  });

  it("a description diz com todas as letras o que NÃO existe no município", () => {
    // mesma regra editorial da SPA: ausência nunca vira zero silencioso
    const comAgencia = porClasse("agencia")!;
    expect(resolverMeta(`/presenca/${comAgencia.cod}`).descricao).toMatch(/tem \d+ agência/);
    const soPosto = porClasse("posto")!;
    expect(resolverMeta(`/presenca/${soPosto.cod}`).descricao).toContain("não tem agência bancária");
    const soCorresp = porClasse("correspondente")!;
    expect(resolverMeta(`/presenca/${soCorresp.cod}`).descricao).toContain("não tem agência nem posto bancário");
  });

  it("código IBGE desconhecido responde 404 com noindex", () => {
    const m = resolverMeta("/presenca/9999999");
    expect(m.status).toBe(404);
    expect(m.indexavel).toBe(false);
  });

  it("o sitemap lista as rotas municipais a partir do gold", () => {
    expect(sitemap).toContain("presenca_mun.json");
    expect(sitemap).toContain("/observatorio/presenca/");
  });

  it("a SPA conhece a rota, a seção e o render da página municipal", () => {
    expect(indexHtml).toContain('id="view-presmun"');
    expect(appJs).toContain('presmun: "/presenca/"');
    expect(appJs).toContain("function renderPresencaMun");
    expect(appJs).toContain('presmun: ["presenca_mun"]');
    // o mapa nacional navega para a página do município clicado
    expect(appJs).toContain("onclick=\"presNav('${m.cod}')\"");
    // e a página municipal navega de volta e entre vizinhos da mesma UF
    expect(appJs).toMatch(/vizinhos\.map/);
  });
});

describe("painéis sintéticos aposentados", () => {
  it("as séries de exemplo e seus componentes saíram do código", () => {
    expect(existsSync(join(raiz, "src/lib/data/paineis.ts"))).toBe(false);
    expect(existsSync(join(raiz, "src/components/analytics"))).toBe(false);
    expect(existsSync(join(raiz, "src/app/app/(paineis)"))).toBe(false);
  });

  it("as rotas antigas redirecionam para o painel real equivalente", () => {
    const config = readFileSync(join(raiz, "next.config.mjs"), "utf-8");
    expect(config).toContain('source: "/app", destination: "/observatorio"');
    expect(config).toContain('source: "/app/atividade", destination: "/observatorio/credit"');
    expect(config).toContain('source: "/app/risco", destination: "/observatorio/sectors"');
    expect(config).toContain('source: "/app/regulatorio", destination: "/observatorio/alerts"');
  });

  it("a telemetria não aceita mais as seções aposentadas", () => {
    const telemetry = readFileSync(join(raiz, "src/lib/telemetry.ts"), "utf-8");
    for (const secao of ["app:paineis", "app:atividade", "app:risco", "app:regulatorio"]) {
      expect(telemetry).not.toContain(`"${secao}"`);
    }
    expect(telemetry).toContain('"app:conta"');
  });

  it("o glossário só descreve conceitos reais — os verbetes fabricados saíram", () => {
    const glossario = readFileSync(join(raiz, "src/lib/data/glossario.ts"), "utf-8");
    for (const fabricado of ["atividade-setorial", "score-de-sentimento-regulatorio", "dados próprios", "modelo de linguagem"]) {
      expect(glossario.toLowerCase()).not.toContain(fabricado);
    }
  });
});

describe("página de imprensa (bets e fraudes como carro-chefe)", () => {
  const pagina = readFileSync(join(raiz, "src/app/imprensa/page.tsx"), "utf-8");

  it("é estática, indexável e canônica", () => {
    expect(pagina).toContain('export const dynamic = "force-static"');
    expect(pagina).toMatch(/alternates: \{ canonical: "\/imprensa" \}/);
    expect(pagina).toContain("openGraph");
  });

  it("os números vêm do gold (bets e fraudes), nunca literais no código", () => {
    expect(pagina).toContain('"bets"');
    expect(pagina).toContain('"fraudes"');
    expect(pagina).toContain("sintese");
    // nenhum número citável escrito à mão
    expect(pagina).not.toMatch(/R\$ ?\d|milhões|bilhões|\d{2},\d/);
  });

  it("cada número aponta para a fonte primária e declara o nível de evidência", () => {
    expect(pagina).toContain("n.url");
    expect(pagina).toContain("n.nivel");
    expect(pagina).toContain("n.fonte");
    expect(pagina).toContain("data_ref");
  });

  it("o gráfico da EPAE entra junto do painel de bets, a partir do gold automático", () => {
    expect(pagina).toContain('lerGold("epae")');
    expect(pagina).toContain("<GraficoEpae dados={epae} />");
    expect(pagina).toContain('p.slug === "bets"');
  });

  it("o gráfico da EPAE é SVG do servidor, sem número escrito à mão e com o limite declarado", () => {
    const comp = readFileSync(join(raiz, "src/components/imprensa/GraficoEpae.tsx"), "utf-8");
    expect(comp).not.toMatch(/"use client"/); // zero JS no cliente na página de imprensa
    expect(comp).toContain("<svg");
    // valores vêm do gold: nenhum dado citável literal no componente
    expect(comp).not.toMatch(/R\$ ?\d|\d{2},\d/);
    // a advertência editorial não pode sumir na versão para a imprensa
    expect(comp).toMatch(/Esta não é uma série de apostas/);
    expect(comp).toMatch(/sem atribuir parcela alguma/);
    // o elo taxonômico e os limites de leitura acompanham o gráfico na imprensa
    expect(comp).toContain("dados.taxonomia.divisoes");
    expect(comp).toContain("as bets se registram aqui");
    expect(comp).toContain("dados.leitura.nao_permite");
    expect(comp).toMatch(/role="img"/);
    expect(comp).toContain("aria-label");
  });

  it("o gold da EPAE traz o que a página de imprensa precisa citar", () => {
    const g = JSON.parse(readFileSync(join(raiz, "public/obs/data/gold/epae.json"), "utf-8"));
    expect(g.serie.obs.length).toBeGreaterThan(24);
    expect(g.anuais.length).toBeGreaterThan(0);
    expect(g.fonte.pagina).toMatch(/^https:\/\/www\.bcb\.gov\.br\//);
    expect(g.comparacao.observado.nivel).toBe("A");
    expect(g.comparacao.atribuido_estudo.nivel).toBe("D");
    expect(g.aviso).toMatch(/SEÇÃO INTEIRA/);
  });

  it("os gold de bets e fraudes trazem síntese com nível e URL em todos os itens", () => {
    for (const nome of ["bets", "fraudes"]) {
      const g = JSON.parse(
        readFileSync(join(raiz, "public/obs/data/gold", `${nome}.json`), "utf-8"),
      );
      expect(g.sintese.length, nome).toBeGreaterThanOrEqual(4);
      for (const item of g.sintese) {
        expect(item.nivel, `${nome}:${item.id}`).toMatch(/^[A-E]$/);
        expect(item.url, `${nome}:${item.id}`).toMatch(/^https:\/\//);
        expect(item.fonte, `${nome}:${item.id}`).toBeTruthy();
      }
    }
  });
});
