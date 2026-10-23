import { describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { conferirPainel } from "./suporte/molde-painel";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), frente Gás, Saneamento, Crédito e Tarifa Social da energia do PR 1
 * (Grupo 1): cada página com sessão do lote renderizada direto pelo componente (renderToStaticMarkup) e conferida por conferirPainel,
 * a mesma anatomia que o teste do build (painel-molde.test.ts) confere no HTML do servidor. Fora do App Router, o roteador é vazio e o
 * caminho é o da rota em teste.
 */

const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined, refresh: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

async function html(rota: string, carregar: () => Promise<{ default: (p: never) => unknown }>, props: object = {}): Promise<string> {
  caminho.atual = rota;
  const { default: Pagina } = await carregar();
  let el = (Pagina as (p: object) => unknown)(props);
  if (el instanceof Promise) el = await el;
  return renderToStaticMarkup(el as ReactElement);
}

describe("Gás natural no molde de painel", () => {
  it("gás de cozinha com sessão", async () => {
    const h = await html("/gas-natural/gas-de-cozinha", () => import("@/app/gas-natural/gas-de-cozinha/page"));
    conferirPainel("/gas-natural/gas-de-cozinha", h);
    // a faixa da consulta aberta continua no arquivo (consultas-abertas.test.ts) e o recorte da UF continua no controle do kit
    expect(h).toContain('data-fatia="controles"');
    expect(h).toContain("Gás de cozinha não é gás natural.");
  });

  it("GNV e gás encanado", async () => {
    const h = await html("/gas-natural/gnv-e-gas-encanado", () => import("@/app/gas-natural/gnv-e-gas-encanado/page"));
    conferirPainel("/gas-natural/gnv-e-gas-encanado", h);
    expect(h).toContain('data-fatia="controles"');
  });
});

describe("Saneamento no molde de painel", () => {
  it("simulador da conta de água e esgoto", async () => {
    const h = await html("/saneamento/preco-regulado/simulador", () => import("@/app/saneamento/preco-regulado/simulador/page"));
    conferirPainel("/saneamento/preco-regulado/simulador", h);
    // a consulta: os controles na abertura, as três leituras na faixa de números, a decomposição na fatia de tabelas
    expect(h).toMatch(/data-acao=""[\s\S]*aria-label="Tabela verificada"/);
    expect(h).toContain("Três leituras diferentes");
    expect(h).toContain("Decomposição da conta simulada por serviço e faixa de consumo");
  });

  it("busca do município com sessão", async () => {
    const h = await html("/saneamento/municipio", () => import("@/app/saneamento/municipio/page"));
    conferirPainel("/saneamento/municipio", h);
    // a busca é a primeira ação; as capitais levam à ficha
    expect(h).toMatch(/data-acao=""[\s\S]*Digite o nome do município/);
    expect(h).toContain('href="/saneamento/municipio/3550308"');
  });

  it("tarifa social", async () => {
    const h = await html("/saneamento/tarifa-social", () => import("@/app/saneamento/tarifa-social/page"));
    conferirPainel("/saneamento/tarifa-social", h);
    // a pergunta inteira do capítulo continua na página, no bloco recolhido da abertura
    expect(h).toContain("A conta cabe no orçamento? A tarifa social chega a quem precisa?");
    expect(h).toContain('data-tabela-ordenavel=""');
  });
});

describe("Crédito no molde de painel", () => {
  // o caso do teste das consultas: a modalidade PF com mais instituições e a instituição do meio do ranking
  async function caso() {
    const { goldJuros, slugModalidade } = await import("@/lib/credito/juros");
    const gold = goldJuros()!;
    const mod = gold.modalidades.filter((m) => m.segmento === "PF").sort((a, b) => b.stats.n - a.stats.n)[0];
    const presentes = new Set(mod.ranking.map((r) => r.cnpj8));
    return { gold, mod, seg: "pf", slug: slugModalidade(mod.modalidade), linha: mod.ranking[Math.floor(mod.ranking.length / 2)], ausente: gold.perfis_if.find((p) => !presentes.has(p.cnpj8))! };
  }

  it("quanto meu banco cobra, com banco, sem banco e com banco ausente da modalidade", async () => {
    const { seg, slug, linha, ausente } = await caso();
    const rota = "/observatorio-do-credito/quanto-meu-banco-cobra";
    for (const banco of [linha.cnpj8, undefined, ausente.cnpj8]) {
      const h = await html(rota, () => import("@/app/observatorio-do-credito/quanto-meu-banco-cobra/page"), { searchParams: { seg, mod: slug, ...(banco ? { banco } : {}) } });
      conferirPainel(rota, h);
      // o recorte vive na URL: o formulário GET reproduz seg, mod e banco
      expect(h).toMatch(/data-acao=""[\s\S]*<form[^>]*method="get"/);
    }
  });

  it("simulador da parcela, com banco e com a mediana", async () => {
    const { seg, slug, linha } = await caso();
    const rota = "/observatorio-do-credito/simulador-da-parcela";
    for (const banco of [linha.cnpj8, undefined]) {
      const h = await html(rota, () => import("@/app/observatorio-do-credito/simulador-da-parcela/page"), { searchParams: { seg, mod: slug, ...(banco ? { banco } : {}) } });
      conferirPainel(rota, h);
      expect(h).toMatch(/data-acao=""[\s\S]*name="valor"/);
      expect(h).toContain("data-aviso-cet");
    }
  });
});
