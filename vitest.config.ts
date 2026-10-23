import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** O arquivo abre Chromium ou lê o build de produção: leva de 10 s a 90 s, contra cerca de 1 s da mediana. */
const PESADO = /chromium\.launch|["']\.next["'/]|\.next\/server/;

/** Pelo conteúdo do teste e dos auxiliares que ele importa de ./suporte ou ./support. */
export function ehPesado(arquivo: string, ler: (p: string) => string = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } }): boolean {
  const texto = ler(arquivo);
  if (PESADO.test(texto)) return true;
  for (const m of texto.matchAll(/from\s+["'](\.\/(?:suporte|support)\/[^"']+)["']/g)) {
    const alvo = resolve(dirname(arquivo), m[1]);
    if (PESADO.test(ler(alvo.endsWith(".ts") ? alvo : alvo + ".ts"))) return true;
  }
  return false;
}

/**
 * Sem histórico de duração (todo run de CI, todo clone novo), o Vitest começa pelos arquivos maiores em bytes, e os mais
 * lentos da suíte são pequenos: ux-orcamentos-cromo e energia-i18n-html começavam por último e esticavam o fim da execução
 * (medido em 22/10/2026). Este sequenciador põe primeiro os pesados sem histórico; com histórico, vale a ordem do Vitest
 * (falhos primeiro, depois os mais longos). A divisão em shards não muda: continua a do Vitest, por hash do caminho.
 */
export class PesadosPrimeiro extends BaseSequencer {
  async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const ordem = await super.sort(files);
    const raiz = this.ctx.config.root;
    const primeiro = (f: TestSpecification) =>
      !this.ctx.cache.getFileTestResults(`${f.project.name}:${relative(raiz, f.moduleId)}`) && ehPesado(f.moduleId);
    return [...ordem.filter(primeiro), ...ordem.filter((f) => !primeiro(f))];
  }
}

export default defineConfig({
  plugins: [react()],
  test: {
    globalSetup: ["./scripts/vitest-worktree-setup.mjs"],
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    // Forks: um processo por arquivo de teste, para que cada um tenha seu
    // próprio banco PGlite em memória (DATABASE_URL=pglite-memory: isolado).
    pool: "forks",
    // O primeiro boot do PGlite (WASM + migração) passa de 10s quando vários
    // forks competem por CPU; sem isto, beforeAll de testes de banco flakeia.
    hookTimeout: 60_000,
    // Sem maxWorkers: vale o padrão do Vitest, núcleos menos um. Em 22/10/2026, seis workers num contêiner de 4 vCPU cortaram
    // a parede de 255 s para 229 s, mas no runner de 4 vCPU do CI (run 1228) dobraram o tempo de CPU dos testes de dados:
    // obee-mobilidade e trabalho-renda-dados foram de 2,9 s para 5,5 s e estouraram os 5 s, e a parede caiu só 3 %.
    // Quatro workers não ganharam nada no contêiner (255 s contra 254,8 s com três).
    sequence: { sequencer: PesadosPrimeiro },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
