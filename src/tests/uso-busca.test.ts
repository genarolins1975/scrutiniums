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

import { FORA_DO_INDICE, contagemDoTermo, termoParaContagem } from "@/lib/uso/busca";
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
  it("grava normalizado o termo feito de palavras do índice (e anos)", () => {
    expect(termoParaContagem("  Dívida dos Estados! ")).toBe("divida dos estados");
    expect(termoParaContagem("Ideb 2023")).toBe("ideb 2023");
    expect(termoParaContagem("pld 2023 2024")).toBe("pld 2023 2024");
    // palavra começada (o campo conta o que foi digitado até a escolha) e nome de capital, que está no índice
    expect(termoParaContagem("inadimpl")).toBe("inadimpl");
    expect(termoParaContagem("Recife")).toBe("recife");
  });

  it("com conta, o termo com uma só palavra fora do vocabulário vai com o texto e a marca; duas ou mais, não (ciclo 2, 23/10/2026)", () => {
    expect(contagemDoTermo("Autonomia financeira", true)).toEqual({ termo: "autonomia financeira", foraDoVocabulario: true });
    expect(contagemDoTermo("xyzabc", true)).toEqual({ termo: "xyzabc", foraDoVocabulario: true });
    // sem conta, o mesmo termo soma no contador sem texto
    expect(contagemDoTermo("Autonomia financeira", false)).toEqual({ termo: FORA_DO_INDICE, foraDoVocabulario: false });
    // duas palavras desconhecidas podem ser o nome de alguém; email e algarismos continuam fora
    for (const x of ["Maria Silva", "joao@exemplo.com", "123.456.789-00", "01310-100", "um dois tres quatro cinco seis sete"]) {
      expect(contagemDoTermo(x, true), x).toEqual({ termo: FORA_DO_INDICE, foraDoVocabulario: false });
    }
    expect(contagemDoTermo("conta de luz", true)).toEqual({ termo: "conta de luz", foraDoVocabulario: false });
  });

  it("nome, endereço, email e algarismos nunca vão para o banco: somam no contador sem texto", () => {
    for (const x of ["Maria Silva", "Rua das Flores 12", "joao@exemplo.com", "123.456.789-00", "01310-100", "(11) 98765-4321", "12345", "um dois tres quatro cinco seis sete", "x".repeat(61)]) {
      expect(termoParaContagem(x), String(x)).toBe(FORA_DO_INDICE);
    }
    for (const x of ["a", "", "  ", 42, null, undefined]) expect(termoParaContagem(x), String(x)).toBeNull();
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
    // evento e fora_do_vocabulario entraram no ciclo 2 da busca (23/10/2026); nenhuma das duas identifica pessoa
    expect((r as unknown as { rows: { column_name: string }[] }).rows.map((c) => c.column_name)).toEqual(["dia", "termo", "com_conta", "evento", "fora_do_vocabulario", "buscas"]);
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
    await POST(pedido({ termo: "Maria Silva" }));
    await POST(pedido("isto não é json"));
    const r = await linhas();
    expect(r).toHaveLength(2);
    expect(r.find((l) => l.termo === "conta de luz")).toMatchObject({ comConta: true, buscas: 2 });
    expect(r.find((l) => l.termo === FORA_DO_INDICE)).toMatchObject({ comConta: true, buscas: 2 });
    expect(JSON.stringify(r)).not.toMatch(/u-123|pessoa@|198\.51\.100|maria|silva|456/);
  });

  it("com conta: a busca sem resultado da barra conta com o evento próprio, evento desconhecido vale como aberta, palavra nova vai marcada", async () => {
    sessao.usuario = { id: "u-9", email: "outra@exemplo.com" };
    await POST(pedido({ termo: "conta pld ideb", evento: "sem_resultado" }));
    await POST(pedido({ termo: "conta pld ideb" }));
    await POST(pedido({ termo: "Ideb", evento: "qualquer" }));
    await POST(pedido({ termo: "autonomia financeira", evento: "sem_resultado" }));
    const r = await linhas();
    expect(r.find((l) => l.termo === "conta pld ideb" && l.evento === "sem_resultado")).toMatchObject({ buscas: 1, foraDoVocabulario: false });
    expect(r.find((l) => l.termo === "conta pld ideb" && l.evento === "abriu")).toMatchObject({ buscas: 1 });
    expect(r.find((l) => l.termo === "ideb")).toMatchObject({ evento: "abriu" });
    expect(r.find((l) => l.termo === "autonomia financeira")).toMatchObject({ evento: "sem_resultado", foraDoVocabulario: true, comConta: true });
    expect(JSON.stringify(r)).not.toMatch(/u-9|outra@/);
  });

  it("sem conta, a palavra nova não grava texto, mesmo com a contagem ligada", async () => {
    process.env.USO_ANONIMO_ATIVO = "1";
    await POST(pedido({ termo: "autonomia financeira", evento: "sem_resultado" }));
    expect(await linhas()).toEqual([expect.objectContaining({ termo: FORA_DO_INDICE, comConta: false, foraDoVocabulario: false })]);
  });

  it("o texto fora do vocabulário é apagado depois de 30 dias; o resto fica", async () => {
    await registrarBusca("autonomia financeira", true, new Date("2026-09-01T15:00:00Z"));
    await registrarBusca("ideb", true, new Date("2026-09-01T15:00:00Z"));
    expect(await linhas()).toHaveLength(2);
    await registrarBusca("xyzabc", true, new Date("2026-10-21T15:00:00Z"));
    const r = await linhas();
    expect(r.map((l) => l.termo).sort()).toEqual(["ideb", "xyzabc"]);
  });

  // revisão do PR do bloco 4: a limpeza não pode depender de aparecer outra palavra desconhecida
  it("a retenção roda também quando a busca nova é conhecida, e na leitura do painel sem busca nova", async () => {
    await registrarBusca("autonomia financeira", true, new Date("2026-09-01T15:00:00Z"));
    await registrarBusca("ideb", true, new Date("2026-10-21T15:00:00Z"));
    expect((await linhas()).map((l) => l.termo)).toEqual(["ideb"]);
    await registrarBusca("xyzabc", true, new Date("2026-09-01T15:00:00Z"));
    expect(await linhas()).toHaveLength(2);
    await getBuscasDoPeriodo(new Date("2026-10-21T15:00:00Z"), {});
    expect((await linhas()).map((l) => l.termo)).toEqual(["ideb"]);
  });

  it("sem conta e com a contagem ligada, grava como sem conta", async () => {
    process.env.USO_ANONIMO_ATIVO = "1";
    await POST(pedido({ termo: "GLP" }));
    expect(await linhas()).toEqual([expect.objectContaining({ termo: "glp", comConta: false, buscas: 1 })]);
  });

  it("painel: mais buscados e sem resultado pela busca de hoje, sem conta não medido com a contagem desligada", async () => {
    const agora = new Date("2026-10-21T15:00:00Z");
    for (let i = 0; i < 3; i++) await registrarBusca("ideb", true, agora);
    // "conta pld ideb" tem só palavras do índice e nenhum resultado que reúna as três
    await registrarBusca("conta pld ideb", true, agora);
    await registrarBusca(FORA_DO_INDICE, true, agora);
    await registrarBusca("ideb", true, new Date("2026-09-01T15:00:00Z"));
    const b = await getBuscasDoPeriodo(agora, {});
    expect(b.inicio).toBe("2026-09-22");
    expect(b.termos.map((t) => [t.termo, t.comConta])).toEqual([["ideb", 3], ["conta pld ideb", 1]]);
    expect(b.termos.find((t) => t.termo === "conta pld ideb")?.resultados).toBe(0);
    expect(b.foraDoIndice).toBe(1);
    expect(b.termos.find((t) => t.termo === "ideb")?.resultados).toBeGreaterThan(0);
    const html = renderToStaticMarkup(createElement(UsoBusca, { busca: b }));
    expect(html).toContain("Termos mais buscados, últimos 30 dias");
    expect(html).toContain("Buscas sem resultado");
    const semResultado = html.slice(html.indexOf('data-uso="sem-resultado"'));
    expect(semResultado).toContain("conta pld ideb");
    expect(html).not.toContain(FORA_DO_INDICE);
    expect(semResultado).not.toContain(">ideb<");
    expect(html).toContain("não medido");
  });

  it("painel: as palavras que o índice não conhece têm quadro próprio, fora dos outros dois, e os eventos somam", async () => {
    const agora = new Date("2026-10-21T15:00:00Z");
    await registrarBusca("autonomia financeira", true, agora, { evento: "sem_resultado" });
    await registrarBusca("autonomia financeira", true, agora);
    await registrarBusca("ideb", true, agora, { evento: "sem_resultado" });
    await registrarBusca("ideb", true, agora);
    const b = await getBuscasDoPeriodo(agora, {});
    expect(b.foraDoVocabulario).toEqual([expect.objectContaining({ termo: "autonomia financeira", comConta: 2 })]);
    expect(b.termos.map((t) => [t.termo, t.comConta])).toEqual([["ideb", 2]]);
    const html = renderToStaticMarkup(createElement(UsoBusca, { busca: b }));
    const quadro = html.slice(html.indexOf('data-uso="fora-do-vocabulario"'));
    expect(html).toContain("Palavras que o índice não conhece");
    expect(quadro).toContain("autonomia financeira");
    // os dois primeiros quadros (mais buscados e sem resultado) vêm antes do terceiro e não levam a palavra desconhecida
    expect(html.slice(0, html.indexOf("Palavras que o índice não conhece"))).not.toContain("autonomia");
  });
});

describe("ligações", () => {
  const vazio: BuscasDoPeriodo = { inicio: "2026-09-22", fim: "2026-10-21", anonimoAtivo: false, primeiroRegistro: null, total: 0, foraDoIndice: 0, termos: [], foraDoVocabulario: [] };

  it("sem registro declara a ausência em vez de tabela de zeros", () => {
    const html = renderToStaticMarkup(createElement(UsoBusca, { busca: vazio }));
    expect(html).toContain("Nenhuma busca registrada");
    expect(html).not.toContain("<table");
  });

  it("o admin monta a seção; o campo e a página /buscar mandam só o termo, e só pela medição", () => {
    const admin = readFileSync(RAIZ + "src/app/app/(foco)/admin/page.tsx", "utf8");
    expect(admin).toContain("<UsoBusca busca={busca}");
    const medir = readFileSync(RAIZ + "src/lib/busca/medir.ts", "utf8");
    expect(medir).toContain("navegadorRecusaRastreio");
    // só o termo e, na busca sem resultado, o evento (ciclo 2 da busca, 23/10/2026)
    expect(medir).toContain('JSON.stringify(evento === "abriu" ? { termo: t.slice(0, 120) } : { termo: t.slice(0, 120), evento })');
    expect(medir).not.toMatch(/document\.cookie|localStorage|sessionStorage/);
    const campo = readFileSync(RAIZ + "src/components/busca/BuscaPlataforma.tsx", "utf8");
    expect(campo).toContain("medirBusca(termo)");
    expect(campo).toContain('medirBusca(t, "sem_resultado")');
    // só a busca de toda a plataforma conta "sem resultado": na busca local o termo pode estar em outra coleção
    expect(campo).toContain("if (filtro?.colecao || !t || !resposta");
    expect(readFileSync(RAIZ + "src/components/busca/MedeBusca.tsx", "utf8")).toContain("medirBusca(termo)");
  });
});
