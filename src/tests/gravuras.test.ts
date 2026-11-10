import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRAVURAS, NOTA_GRAVURA } from "@/lib/observatorios/gravuras";
import { OBSERVATORIOS } from "@/lib/observatorios/lista";

/** Lê largura e altura de um WebP (VP8, VP8L ou VP8X) pelo cabeçalho, sem dependência. */
function tamanhoWebp(b: Buffer): [number, number] {
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tipo === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  const bits = b.readUInt32LE(21);
  return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
}

describe("gravuras dos observatórios: uma família, um formato, uma pasta", () => {
  const pasta = join(process.cwd(), "public", "arte", "observatorios");

  it("cada um dos seis observatórios tem a sua gravura, e a pasta não tem sobra", () => {
    expect(Object.keys(GRAVURAS).sort()).toEqual(OBSERVATORIOS.map((o) => o.id).sort());
    expect(readdirSync(pasta).sort()).toEqual(OBSERVATORIOS.map((o) => `${o.id}.webp`).sort());
  });

  it("todas no mesmo formato e tamanho declarado, com peso de página", () => {
    for (const [id, g] of Object.entries(GRAVURAS)) {
      const arquivo = join(process.cwd(), "public", g.src);
      expect(existsSync(arquivo), id).toBe(true);
      const b = readFileSync(arquivo);
      expect(b.toString("ascii", 0, 4) + b.toString("ascii", 8, 12), id).toBe("RIFFWEBP");
      expect(tamanhoWebp(b), id).toEqual([g.largura, g.altura]);
      expect([g.largura, g.altura], id).toEqual([1440, 720]);
      expect(b.length, `${id}: peso`).toBeLessThan(400 * 1024);
    }
  });

  it("o texto alternativo descreve a cena como gravura conceitual, sem dado nem lugar real", () => {
    for (const [id, g] of Object.entries(GRAVURAS)) {
      expect(g.alt, id).toMatch(/^Gravura conceitual/);
      expect(g.alt.length, id).toBeGreaterThan(60);
      expect(g.alt, id).not.toMatch(/\d/);
    }
    expect(NOTA_GRAVURA).toMatch(/não representa dados/i);
  });
});
