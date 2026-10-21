import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("inventaria o import() que executa o leitor real do boletim", { timeout: 30_000 }, () => {
  const pasta = mkdtempSync(join(tmpdir(), "gold-inventario-"));
  try {
    const destino = join(pasta, "inventario.json");
    execFileSync(process.execPath, ["scripts/mapear-testes-gold.mjs", destino]);
    const inventario = JSON.parse(readFileSync(destino, "utf-8"));
    expect(inventario["src/tests/boletim.test.ts"].imports).toContain("@/lib/boletim");
    expect(inventario["src/lib/assinaturaResumo.ts"].imports).toContain("./dadosPublicos");
  } finally { rmSync(pasta, { recursive: true, force: true }); }
});
