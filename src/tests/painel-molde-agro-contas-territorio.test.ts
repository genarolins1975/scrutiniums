import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, vi } from "vitest";
import { conferirPainel } from "@/tests/suporte/molde-painel";

/**
 * Molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026), frente Agronegócio, Contas Federais, Território e Combustíveis do
 * PR 1: cada página migrada, renderizada direto do componente (sem build), passa na mesma conferência de anatomia que o teste do build
 * faz com sessão (src/tests/suporte/molde-painel.ts): fatias na ordem, H1 e lead no comprimento, prova e natureza de cada número,
 * tabela, proveniência e "não permite concluir" de cada figura, nenhuma tabela fora do kit e um só método no fim.
 */
// as páginas do Agronegócio importam módulos marcados com server-only; no teste, o marcador não tem efeito
vi.mock("server-only", () => ({}));
const caminho = vi.hoisted(() => ({ atual: "/" }));
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>("next/navigation")),
  usePathname: () => caminho.atual,
  useRouter: () => ({ push: () => undefined, replace: () => undefined, prefetch: () => undefined }),
  useSearchParams: () => new URLSearchParams(),
}));

type Carga = () => Promise<{ default: unknown }>;

async function html(rota: string, carregar: Carga, props: Record<string, unknown> = {}) {
  caminho.atual = rota;
  const { default: Pagina } = await carregar();
  return renderToStaticMarkup(createElement(Pagina as never, props as never));
}

const PAGINAS: [string, Carga, Record<string, unknown>?][] = [
  ["/territorio/desastres", () => import("@/app/territorio/desastres/page")],
  ["/territorio/queimadas", () => import("@/app/territorio/queimadas/page")],
  ["/combustiveis/no-meu-estado", () => import("@/app/combustiveis/no-meu-estado/page")],
  ["/contas-publicas/por-area", () => import("@/app/contas-publicas/por-area/page"), { searchParams: {} }],
  ["/contas-publicas/metas", () => import("@/app/contas-publicas/[capitulo]/page"), { params: { capitulo: "metas" } }],
  ["/agronegocio/tamanho", () => import("@/app/agronegocio/tamanho/page")],
  ["/agronegocio/prato", () => import("@/app/agronegocio/prato/page")],
  ["/agronegocio/atlas", () => import("@/app/agronegocio/atlas/page"), { searchParams: {} }],
  ["/agronegocio/clima-ambiente", () => import("@/app/agronegocio/[capitulo]/page"), { params: { capitulo: "clima-ambiente" } }],
];

describe("molde de painel: Agronegócio, Contas Federais, Território e Combustíveis", () => {
  for (const [rota, carregar, props] of PAGINAS) {
    it(rota, async () => conferirPainel(rota, await html(rota, carregar, props)), 60_000);
  }
});
