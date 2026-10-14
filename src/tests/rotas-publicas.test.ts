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
      "/contas-publicas/metodologia", "/contas-publicas/glossario",
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
      "/app", "/app/observatorios", "/dados/pix/opengraph-image", "/rota-que-ainda-nao-existe",
      "/api/eficiencia-mobilidade/exportar",
    ]) expect(ehRotaPublica(p), p).toBe(false);
  });

  it("não aceita prefixo parcial nem caminho disfarçado", () => {
    for (const p of ["/sobrecarga", "/entrarx", "/eficiencia-estatal/saude-capitais/metodos/extra", "/setor-eletrico/metodologiax"]) {
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
  it("visitante vai à seção pública do observatório na home; quem tem conta vai ao painel", async () => {
    const { navCabecalho } = await import("@/components/layout/navCabecalho");
    const { DOMINIOS } = await import("@/lib/dominios");
    const { readFileSync } = await import("node:fs");
    const secao = readFileSync(`${process.cwd()}/src/components/home/SecaoObservatorios.tsx`, "utf-8");
    expect(secao).toContain("id={`obs-${d.id}`}");
    const visitante = navCabecalho(false);
    for (const d of DOMINIOS) expect(visitante.map((n) => n.href)).toContain(`/#obs-${d.id}`);
    for (const n of visitante) expect(ehRotaPublica(n.href.split("#")[0] || "/"), n.href).toBe(true);
    const logado = navCabecalho(true).map((n) => n.href);
    for (const d of DOMINIOS) expect(logado).toContain(d.rotaRaiz);
  });
});

describe("abas em páginas estáticas", () => {
  it("o cliente consulta a sessão e troca as abas para os painéis quando há sessão", async () => {
    const { readFileSync } = await import("node:fs");
    const c = readFileSync(`${process.cwd()}/src/components/layout/AbasCabecalho.tsx`, "utf-8");
    expect(c).toMatch(/^"use client";/);
    expect(c).toContain('fetch("/api/auth/eu"');
    expect(c).toContain("r.status === 204");
    expect(c).toContain("navCabecalho(logado)");
    // a rota consultada responde 204 com sessão e 401 sem, sem cache
    const rota = readFileSync(`${process.cwd()}/src/app/api/auth/eu/route.ts`, "utf-8");
    expect(rota).toContain("user ? 204 : 401");
    expect(rota).toContain('"Cache-Control": "no-store"');
  });
});
