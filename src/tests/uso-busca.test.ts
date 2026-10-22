import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sql } from "drizzle-orm";

// Banco PGlite EM MEMÓRIA exclusivo deste processo de teste (pool "forks").
process.env.DATABASE_URL = "pglite-memory:";
delete process.env.USO_ANONIMO_ATIVO;

const sessao = vi.hoisted(() => ({ usuario: null as null | { id: string; email: string } }));
vi.mock("@/lib/session", () => ({ getSessionUser: vi.fn(async () => sessao.usuario) }));

import { termoParaContagem } from "@/lib/uso/busca";
import { UsoBusca } from "@/components/admin/UsoBusca";
import type { BuscasDoPeriodo } from "@/lib/uso/painel";

/**
 * Medição agregada da busca da plataforma (Iniciativa 3 do parecer de UX de 21/10/2026; docs/observatorios/MEDICAO_DE_USO.md):
 * um contador por dia, termo normalizado e presença de conta, sem coluna que identifique pessoa, com as regras das páginas
 * (DNT e GPC nunca contam; sem conta, só com USO_ANONIMO_ATIVO=1) e sem gravar termo que pareça dado pessoal.
 */
vi.setConfig({ testTimeout: 60_000 });
const RAIZ = fileURLToPath(new URL("../../", import.meta.url));

describe("termo que entra no contador", () => {
  it("normaliza acento, caixa e pontuação", () => {
    expect(termoParaContagem("  Dívida dos Estados! ")).toBe("divida dos estados");
    expect(termoParaContagem("Ideb 2023")).toBe("ideb 2023");
    expect(termoParaContagem("pld 2023 2024")).toBe("pld 2023 2024");
  });

  it("recusa o que parece dado de alguém ou não é termo", () => {
    for (const x of ["joao@exemplo.com", "123.456.789-00", "01310-100", "(11) 98765-4321", "12345", "a", "", "um dois tres quatro cinco seis sete", "x".repeat(61), 42, null, undefined]) {
      expect(termoParaContagem(x), String(x)).toBeNull();
    }
  });
});

let db: Awaited<ReturnType<typeof import("@/lib/db").getDb>>;
let schema: typeof import("@/lib/db").schema;
let POST: typeof import("@/app/api/uso/busca/route").POST;
let getBuscasDoPeriodo: typeof import("@/lib/uso/painel").getBuscasDoPeriodo;
let registrarBusca: typeof import("@/lib/uso/busca").registrarBusca;

beforeAll(async () => {
  const dbModule = await import("@/lib/db");
  db = await dbModule.getDb();
  schema = dbModule.schema;
  ({ POST } = await import("@/app/api/uso/busca/route"));
  ({ getBuscasDoPeriodo } = await import("@/lib/uso/painel"));
  ({ registrarBusca } = await import("@/lib/uso/busca"));
});

const linhas = () => db.select().from(schema.usoBuscaDia);
let ip = 0;
function pedido(corpo: unknown, cabecalhos: Record<string, string> = {}) {
  ip += 1;
  return new Request("http://localhost/api/uso/busca", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${ip}`, ...cabecalhos },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
}

describe("tabela uso_busca_dia", () => {
  beforeEach(async () => {
    await db.delete(schema.usoBuscaDia);
    sessao.usuario = null;
    delete process.env.USO_ANONIMO_ATIVO;
  });

  it("não tem coluna que identifique pessoa", async () => {
    const r = await db.execute(sql.raw("SELECT column_name FROM information_schema.columns WHERE table_name = 'uso_busca_dia' ORDER BY ordinal_position"));
    expect((r as unknown as { rows: { column_name: string }[] }).rows.map((c) => c.column_name)).toEqual(["dia", "termo", "com_conta", "buscas"]);
  });

  it("sem conta e com a contagem anônima desligada, nada é gravado", async () => {
    expect((await POST(pedido({ termo: "Ideb" }))).status).toBe(204);
    expect(await linhas()).toHaveLength(0);
  });

  it("com conta grava o termo normalizado sem associar a pessoa; DNT, GPC e dado pessoal não gravam", async () => {
    sessao.usuario = { id: "u-123", email: "pessoa@exemplo.com" };
    await POST(pedido({ termo: "Conta de Luz" }));
    await POST(pedido({ termo: "conta de luz" }));
    await POST(pedido({ termo: "Ideb" }, { DNT: "1" }));
    await POST(pedido({ termo: "Ideb" }, { "Sec-GPC": "1" }));
    await POST(pedido({ termo: "123.456.789-00" }));
    await POST(pedido("isto não é json"));
    const r = await linhas();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ termo: "conta de luz", comConta: true, buscas: 2 });
    expect(JSON.stringify(r)).not.toMatch(/u-123|pessoa@|198\.51\.100/);
  });

  it("sem conta e com a contagem ligada, grava como sem conta", async () => {
    process.env.USO_ANONIMO_ATIVO = "1";
    await POST(pedido({ termo: "GLP" }));
    expect(await linhas()).toEqual([expect.objectContaining({ termo: "glp", comConta: false, buscas: 1 })]);
  });

  it("painel: mais buscados e sem resultado pela busca de hoje, sem conta não medido com a contagem desligada", async () => {
    const agora = new Date("2026-10-21T15:00:00Z");
    for (let i = 0; i < 3; i++) await registrarBusca("ideb", true, agora);
    await registrarBusca("xyzabc", true, agora);
    await registrarBusca("ideb", true, new Date("2026-09-01T15:00:00Z"));
    const b = await getBuscasDoPeriodo(agora, {});
    expect(b.inicio).toBe("2026-09-22");
    expect(b.termos.map((t) => [t.termo, t.comConta])).toEqual([["ideb", 3], ["xyzabc", 1]]);
    expect(b.termos.find((t) => t.termo === "xyzabc")?.resultados).toBe(0);
    expect(b.termos.find((t) => t.termo === "ideb")?.resultados).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(UsoBusca, { busca: b, numero: "04" }));
    expect(html).toContain("Termos mais buscados, últimos 30 dias");
    expect(html).toContain("Buscas sem resultado");
    const semResultado = html.slice(html.indexOf('data-uso="sem-resultado"'));
    expect(semResultado).toContain("xyzabc");
    expect(semResultado).not.toContain(">ideb<");
    expect(html).toContain("não medido");
  });
});

describe("ligações", () => {
  const vazio: BuscasDoPeriodo = { inicio: "2026-09-22", fim: "2026-10-21", anonimoAtivo: false, primeiroRegistro: null, total: 0, termos: [] };

  it("sem registro declara a ausência em vez de tabela de zeros", () => {
    const html = renderToStaticMarkup(createElement(UsoBusca, { busca: vazio, numero: "04" }));
    expect(html).toContain("Nenhuma busca registrada");
    expect(html).not.toContain("<table");
  });

  it("o admin monta a seção; o campo e a página /buscar mandam só o termo, e só pela medição", () => {
    const admin = readFileSync(RAIZ + "src/app/app/(foco)/admin/page.tsx", "utf8");
    expect(admin).toContain("<UsoBusca busca={busca}");
    const medir = readFileSync(RAIZ + "src/lib/busca/medir.ts", "utf8");
    expect(medir).toContain("navegadorRecusaRastreio");
    expect(medir).toContain('JSON.stringify({ termo: t.slice(0, 120) })');
    expect(medir).not.toMatch(/document\.cookie|localStorage|sessionStorage/);
    expect(readFileSync(RAIZ + "src/components/busca/BuscaPlataforma.tsx", "utf8")).toContain("medirBusca(termo)");
    expect(readFileSync(RAIZ + "src/components/busca/MedeBusca.tsx", "utf8")).toContain("medirBusca(termo)");
  });
});
