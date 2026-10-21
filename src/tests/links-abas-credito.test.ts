import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ABAS_OBSERVATORIO } from "@/lib/data/observatorioAbas";

/** Subrotas da SPA do Crédito que não são abas do catálogo: ficha de município (presença). */
const SUBROTAS = new Set(["presenca"]);

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === "tests" ? [] : arquivos(caminho);
    return /\.(tsx?|mjs)$/.test(nome) ? [caminho] : [];
  });
}

describe("links internos para as abas do Crédito", () => {
  it("todo endereço /observatorio/<aba> escrito no código existe no catálogo de abas", () => {
    const abas = new Set(ABAS_OBSERVATORIO.map((a) => a.caminho.slice(1).split("/")[0]));
    const quebrados: string[] = [];
    for (const f of arquivos(join(process.cwd(), "src"))) {
      for (const m of readFileSync(f, "utf-8").matchAll(/["'`]\/observatorio\/([a-z0-9-]+)/g)) {
        if (!abas.has(m[1]) && !SUBROTAS.has(m[1])) quebrados.push(`${relative(process.cwd(), f)}: /observatorio/${m[1]}`);
      }
    }
    expect(quebrados).toEqual([]);
  });
});
