import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A skill observatorio-layout vive em núcleo e anexos (decisão do dono de 23/10/2026, proposta 1 do ciclo,
 * docs/CICLO_PROPOSTAS_2026-10.md): o núcleo cabe em 15 KB e é lido em toda sessão; cada anexo diz quando
 * deve ser carregado e está no índice do topo do núcleo. Este teste impede o núcleo de voltar a crescer e o
 * índice de ficar defasado. A prova de que a divisão não perdeu texto é `node scripts/skill-cobertura.mjs <ref>`.
 */
const PASTA = join(process.cwd(), ".claude/skills/observatorio-layout");
const NUCLEO = join(PASTA, "SKILL.md");
const TETO_NUCLEO = 15 * 1024;

describe("skill observatorio-layout em núcleo e anexos", () => {
  const nucleo = readFileSync(NUCLEO, "utf8");
  const listados = [...nucleo.matchAll(/\| `anexos\/([a-z-]+\.md)` \|/g)].map((m) => m[1]).sort();

  it("o núcleo cabe no teto de 15 KB", () => {
    expect(statSync(NUCLEO).size).toBeLessThanOrEqual(TETO_NUCLEO);
  });

  it("o índice lista todo anexo existente, e todo anexo listado existe", () => {
    const existentes = readdirSync(join(PASTA, "anexos")).filter((f) => f.endsWith(".md")).sort();
    expect(listados.length).toBeGreaterThan(0);
    expect(listados).toEqual(existentes);
  });

  it("cada anexo diz quando deve ser carregado", () => {
    for (const a of listados) expect(readFileSync(join(PASTA, "anexos", a), "utf8"), a).toMatch(/^Carregar quando/m);
  });

  it("CLAUDE.md e AGENTS.md mandam ler o núcleo e os anexos do tema", () => {
    for (const f of ["CLAUDE.md", "AGENTS.md"]) expect(readFileSync(join(process.cwd(), f), "utf8"), f).toMatch(/anexos/);
  });
});
