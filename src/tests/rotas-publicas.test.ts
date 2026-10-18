import { describe, expect, it } from "vitest";
import { ehApiDeDados, ehRotaPublica } from "@/lib/rotasPublicas";
import sitemap from "@/app/sitemap";

/**
 * Fronteira entre a vitrine e os painéis (decisão de 13/10/2026): só a lista
 * aberta passa sem sessão; rota nova nasce fechada.
 */
describe("rotas públicas", () => {
  it("abre a vitrine, o método, o glossário, as institucionais e o fluxo de conta", () => {
    for (const p of [
      "/", "/termos", "/privacidade", "/imprensa", "/glossario", "/observatorio-do-credito",
      "/entrar", "/entrar/sms", "/cadastro", "/cadastro/perfil", "/sobre", "/sobre/erros", "/boletim/sair",
      "/setor-eletrico/metodologia", "/setor-eletrico/metodologia/avaliacao", "/setor-eletrico/aprenda/gsf",
      "/contas-publicas/metodologia", "/contas-publicas/glossario", "/saneamento/metodologia", "/gas-natural/metodologia",
      "/eficiencia-estatal/saude-capitais/metodos", "/eficiencia-estatal/trabalho-renda/metodos/",
      "/home/credito.webp", "/robots.txt", "/sitemap.xml", "/icon.svg", "/opengraph-image",
      "/api/auth/login", "/api/onboarding/phone/check", "/api/telemetria",
    ]) expect(ehRotaPublica(p), p).toBe(true);
  });

  it("fecha painéis, arquivos, feeds, incorporações e a área de conta", () => {
    for (const p of [
      "/observatorio", "/observatorio/pix", "/obs/data/gold/meta.json", "/obs/embed.html", "/dados", "/dados/api",
      "/resumo", "/resumo/feed.xml", "/setor-eletrico", "/setor-eletrico/pld", "/energia/series/pld.csv",
      "/eficiencia-estatal", "/eficiencia-estatal/saude-capitais", "/eficiencia-estatal/saneamento/dados",
      "/contas-publicas", "/contas-publicas/execucao", "/contas-publicas-estaduais", "/contas-publicas-estaduais/comparacao.csv",
      "/saneamento", "/saneamento/acesso", "/saneamento/municipio/2611606", "/saneamento/gold/municipios.csv",
      "/gas-natural", "/gas-natural/gas-de-cozinha", "/gas-natural/dados", "/gas/gold/meta.json", "/gas/series/preco-glp-por-uf.csv",
      "/app", "/app/observatorios", "/dados/pix/opengraph-image", "/rota-que-ainda-nao-existe",
      "/api/eficiencia-mobilidade/exportar",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("não aceita prefixo parcial nem caminho disfarçado", () => {
    for (const p of ["/sobrecarga", "/entrarx", "/eficiencia-estatal/saude-capitais/metodos/extra", "/setor-eletrico/metodologiax", "/gas-natural/metodologiax"]) {
      expect(ehRotaPublica(p), p).toBe(false);
    }
  });

  it("só a API de dados pede sessão", () => {
    expect(ehApiDeDados("/api/eficiencia-mobilidade/oportunidades")).toBe(true);
    expect(ehApiDeDados("/api/auth/eu")).toBe(false);
  });

  it("o sitemap só lista o que é público", () => {
    const urls = sitemap().map((u) => new URL(u.url).pathname);
    expect(urls.length).toBeGreaterThan(5);
    for (const u of urls) expect(ehRotaPublica(u), u).toBe(true);
  });
});

describe("abas do cabeçalho", () => {
  it("cada aba leva à página aberta de um dos seis observatórios, logado ou não", async () => {
    const { navCabecalho } = await import("@/components/layout/navCabecalho");
    const { OBSERVATORIOS } = await import("@/lib/observatorios/registro");
    const abas = navCabecalho();
    expect(abas.map((n) => n.href)).toEqual([...OBSERVATORIOS.map((o) => `/perguntas/${o.id}`), "/imprensa"]);
    expect(abas.map((n) => n.label).slice(0, 6)).toEqual(OBSERVATORIOS.map((o) => o.nomeCurto));
    for (const n of abas) expect(ehRotaPublica(n.href), n.href).toBe(true);
  });

  it("as abas não consultam a sessão no navegador: o destino é o mesmo para todos", async () => {
    const { readFileSync } = await import("node:fs");
    const c = readFileSync(`${process.cwd()}/src/components/layout/AbasCabecalho.tsx`, "utf-8");
    expect(c).not.toMatch(/^"use client";/);
    expect(c).not.toContain("/api/auth/eu");
  });
});
