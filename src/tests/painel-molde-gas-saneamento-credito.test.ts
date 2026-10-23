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
