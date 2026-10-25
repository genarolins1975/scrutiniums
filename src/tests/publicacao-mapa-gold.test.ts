import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 25/10/2026: rankings-municipais-reflow-browser.test.ts entrou na main com o CI verde, mas lia
// a gold por nome dinâmico sem classificação, e o mapeador do portão abortou a publicação de todos
// os grupos de Crédito na rodada diária. Este teste roda o mesmo mapeador no PR.
const MAPEAR = `
import json, sys
from scripts.mapa_testes_gold import gerar
from scripts import publicar_gold as pg
mapa = gerar('.', sys.argv[2], pg.ler_json('config/gold-grupos.json'), json.load(open(sys.argv[1])))
print(len(mapa))
`;

describe("portão de publicação do Crédito", () => {
  it("o mapeador classifica todo teste que lê a gold publicada", () => {
    const pasta = mkdtempSync(join(tmpdir(), "mapa-gold-"));
    try {
      const inventario = join(pasta, "inventario.json");
      execFileSync("node", ["scripts/mapear-testes-gold.mjs", inventario], { stdio: "pipe" });
      const saida = execFileSync("python3", ["-c", MAPEAR, inventario, ["public", "obs", "data", "gold"].join("/")], {
        encoding: "utf8",
        stdio: "pipe",
      });
      expect(Number(saida.trim())).toBeGreaterThan(0);
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  }, 120_000);
});
