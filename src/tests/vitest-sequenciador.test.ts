import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { availableParallelism } from "node:os";
import config, { PesadosPrimeiro, WORKERS, ehPesado } from "../../vitest.config";

/**
 * A ordem dos arquivos não muda o que é verificado, só quando cada um começa. Sem histórico de durações (todo run de CI),
 * os testes que abrem Chromium ou leem o build começam primeiro; com histórico, vale a ordem do Vitest. Medido em
 * 22/10/2026: 275 s com a ordem por tamanho de arquivo, 255 s com os pesados primeiro (4 vCPU, 4 workers).
 */

const temporarios: string[] = [];
afterEach(() => { for (const d of temporarios.splice(0)) rmSync(d, { recursive: true, force: true }); });

function arvore(arquivos: Record<string, string>) {
  const raiz = mkdtempSync(join(tmpdir(), "vitest-sequenciador-"));
  temporarios.push(raiz);
  for (const [nome, texto] of Object.entries(arquivos)) {
    mkdirSync(join(raiz, nome, ".."), { recursive: true });
    writeFileSync(join(raiz, nome), texto);
  }
  return raiz;
}

type Spec = { moduleId: string; project: { name: string; config: { sequence: { groupOrder: number }; isolate: boolean } } };
const spec = (moduleId: string): Spec => ({ moduleId, project: { name: "", config: { sequence: { groupOrder: 0 }, isolate: true } } });

function sequenciador(raiz: string, historico: Record<string, { duration: number; failed: boolean }>, tamanhos: Record<string, number>) {
  const ctx = { config: { root: raiz }, cache: {
    getFileTestResults: (k: string) => historico[k.replace(/^:/, "")],
    getFileStats: (k: string) => ({ size: tamanhos[k.replace(/^:/, "")] ?? 1 }),
  } };
  return new PesadosPrimeiro(ctx as never);
}

describe("sequenciador", () => {
  it("reconhece teste pesado pelo conteúdo e pelo auxiliar importado", () => {
    const raiz = arvore({
      "navegador.test.ts": 'navegador = await chromium.launch();',
      "build.test.ts": 'const APP = join(process.cwd(), ".next", "server", "app");',
      "via-suporte.test.ts": 'import { abrir } from "./suporte/i18n-browser";',
      "suporte/i18n-browser.ts": "export const abrir = () => chromium.launch();",
      "leve.test.ts": 'import { describe } from "vitest"; const proximo = "next";',
    });
    expect(ehPesado(join(raiz, "navegador.test.ts"))).toBe(true);
    expect(ehPesado(join(raiz, "build.test.ts"))).toBe(true);
    expect(ehPesado(join(raiz, "via-suporte.test.ts"))).toBe(true);
    expect(ehPesado(join(raiz, "leve.test.ts"))).toBe(false);
  });

  it("no repositório, os dois arquivos mais lentos de 22/10/2026 e os de navegador são pesados", () => {
    for (const f of ["ux-orcamentos-cromo", "energia-i18n-html", "html-gerado", "busca-barra-browser", "i18n-auth-browser", "conta-cpf-browser"]) {
      expect(ehPesado(join(process.cwd(), "src/tests", `${f}.test.ts`)), f).toBe(true);
    }
    expect(ehPesado(join(process.cwd(), "src/tests", "agro-calculos.test.ts"))).toBe(false);
  });

  it("sem histórico, os pesados começam primeiro e o resto segue a ordem do Vitest (maiores primeiro)", async () => {
    const raiz = arvore({ "a.test.ts": "leve", "b.test.ts": "chromium.launch()", "c.test.ts": "leve", "d.test.ts": '".next"' });
    const specs = ["a", "b", "c", "d"].map((n) => spec(join(raiz, `${n}.test.ts`)));
    const ordem = await sequenciador(raiz, {}, { "a.test.ts": 30, "b.test.ts": 10, "c.test.ts": 40, "d.test.ts": 20 }).sort(specs as never);
    expect((ordem as unknown as Spec[]).map((s) => s.moduleId.slice(-9))).toEqual(["d.test.ts", "b.test.ts", "c.test.ts", "a.test.ts"]);
  });

  it("com histórico, vale a ordem do Vitest: falhos primeiro, depois os mais longos", async () => {
    const raiz = arvore({ "a.test.ts": "leve", "b.test.ts": "chromium.launch()", "c.test.ts": "leve" });
    const specs = ["a", "b", "c"].map((n) => spec(join(raiz, `${n}.test.ts`)));
    const historico = { "a.test.ts": { duration: 900, failed: false }, "b.test.ts": { duration: 100, failed: false }, "c.test.ts": { duration: 50, failed: true } };
    const ordem = await sequenciador(raiz, historico, {}).sort(specs as never);
    expect((ordem as unknown as Spec[]).map((s) => s.moduleId.slice(-9))).toEqual(["c.test.ts", "a.test.ts", "b.test.ts"]);
  });

  it("a configuração usa o sequenciador, forks e uma vez e meia os núcleos (até 8)", () => {
    const t = (config as { test: { sequence: { sequencer: unknown }; pool: string; maxWorkers: number } }).test;
    expect(t.sequence.sequencer).toBe(PesadosPrimeiro);
    expect(t.pool).toBe("forks");
    expect(t.maxWorkers).toBe(WORKERS);
    expect(WORKERS).toBe(Math.min(8, Math.max(2, Math.round(availableParallelism() * 1.5))));
    // no runner de 4 vCPU do CI e numa sessão de 4 vCPU, 6 workers (o Vitest sozinho usaria 3)
    if (availableParallelism() === 4) expect(WORKERS).toBe(6);
  });
});
