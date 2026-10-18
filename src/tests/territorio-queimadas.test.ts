import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lerQueimadas, recorte } from "@/lib/territorio/queimadas";
import { donoDaRota } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { escalaTerritorio, frentesTerritorio } from "@/lib/observatorios/entradas/territorio";

describe("queimadas do Território e Clima", () => {
  const g = lerQueimadas();

  it("série anual contínua desde 2003, só o satélite de referência e um único ano parcial", () => {
    expect(g.sateliteReferencia.id).toBe("AQUA_M-T");
    const anos = g.anual.map((a) => a.ano);
    expect(anos[0]).toBe(2003);
    anos.forEach((a, i) => i > 0 && expect(a - anos[i - 1]).toBe(1));
    expect(g.anual.filter((a) => a.parcial)).toHaveLength(1);
    for (const a of g.anual.filter((x) => !x.parcial)) expect(a.focos, String(a.ano)).toBeGreaterThan(0);
  });

  it("estados e biomas somam o total de cada recorte, e a comparação usa os mesmos recortes", () => {
    for (const r of g.recortes.filter((x) => x.focos !== null)) {
      expect(r.porUF!.reduce((s, x) => s + x.focos, 0), r.rotulo).toBe(r.focos);
      expect(r.porBioma!.reduce((s, x) => s + x.focos, 0), r.rotulo).toBe(r.focos);
    }
    const c = g.comparacao!;
    expect(c.focosAtual).toBe(recorte(g, "acumuladoAnoCorrente")!.focos);
    expect(c.focosAnterior).toBe(recorte(g, "mesmoPeriodoAnoAnterior")!.focos);
    expect(c.periodoAtual.inicio.slice(5)).toBe(c.periodoAnterior.inicio.slice(5));
    expect(c.periodoAtual.fim.slice(5)).toBe(c.periodoAnterior.fim.slice(5));
  });

  it("mês sem arquivo na fonte aparece como ausente, nunca como zero, e todo original tem sha256", () => {
    for (const meses of Object.values(g.mensal)) for (const m of meses ?? []) {
      if (m.motivo) expect(m.focos, m.mes).toBeNull();
    }
    for (const [url, o] of Object.entries(g.originais)) expect(o.sha256, url).toMatch(/^[0-9a-f]{64}$/);
    expect(g.areaQueimada?.maturidade).toMatch(/Provisório/);
  });

  it("o painel é fechado, pertence à coleção Fogo e queimadas e diz junto ao número que foco não é incêndio", () => {
    expect(ehRotaPublica("/territorio/queimadas")).toBe(false);
    expect(donoDaRota("/territorio/queimadas")).toMatchObject({ observatorio: "territorio-e-clima", colecao: "fogo", origem: null });
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "queimadas", "page.tsx"), "utf-8");
    expect(fonte).toContain("Foco de calor não é incêndio nem área queimada");
    expect(existsSync(join(process.cwd(), "src", "app", "territorio", "layout.tsx"))).toBe(true);
  });

  it("a entrada do observatório lê os focos da gold e não anuncia mais queimadas como lacuna", () => {
    const focos = escalaTerritorio().find((x) => x.href === "/territorio/queimadas");
    expect(focos?.valor).not.toBeNull();
    expect(frentesTerritorio().find((f) => f.id === "floresta")!.paineis.map((p) => p.href)).toContain("/territorio/queimadas");
    const frentes = readFileSync(join(process.cwd(), "src", "components", "observatorios", "FrentesTerritorio.tsx"), "utf-8");
    expect(frentes).not.toMatch(/queimadas e desastres da Defesa Civil ainda não/);
  });
});
