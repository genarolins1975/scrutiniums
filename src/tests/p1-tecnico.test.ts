/**
 * Travas do bloco P1 técnico da avaliação de 06/09/2026 (docs/AVALIACAO_PAINEIS_2026-09-06.md §13):
 * T5 auxiliares únicos de formatação (pipeline/fmt.py e fmt na SPA), T4 rescopado para política
 * de cache dos estáticos, e o corte de observações com data futura no SGS.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(RAIZ, p), "utf8");

describe("T5: um só lugar para _r, _share, _mes_menos, _mil e _dec no pipeline", () => {
  it("pipeline/fmt.py define os cinco e nenhum builder os redefine", () => {
    const fmt = read("pipeline/fmt.py");
    for (const h of ["_r", "_share", "_mes_menos", "_mil", "_dec"]) expect(fmt).toMatch(new RegExp(`^def ${h}\\(`, "m"));
    for (const f of readdirSync(join(RAIZ, "pipeline")).filter((f) => f.endsWith(".py") && f !== "fmt.py")) {
      expect(read(`pipeline/${f}`), f).not.toMatch(/^def (_r|_share|_mes_menos|_mil|_dec)\(/m);
    }
  });
  it("os auxiliares preservam ausência e fazem a aritmética de calendário certa", () => {
    const out = execFileSync("python3", ["-c", [
      "import sys, json; sys.path.insert(0, '.')",
      "from pipeline.fmt import _r, _share, _mes_menos, _mil, _dec",
      "print(json.dumps([_r(None), _r(1.23456), _share(None, 10), _share(5, 0), _share(5, 20), _mes_menos('2026-01', 1), _mes_menos('2026-07', 13), _mil(1234567), _dec(4.5678, 2)]))",
    ].join("\n")], { cwd: RAIZ, encoding: "utf8" });
    expect(JSON.parse(out.trim())).toEqual([null, 1.23, null, null, 25, "2025-12", "2025-06", "1.234.567", "4,57"]);
  });
  it("na SPA, pct, n0, brl e bi só existem no objeto fmt; os renderizadores delegam", () => {
    const app = read("public/obs/app.js");
    expect(app).toMatch(/\n  pct: \(v, d = 1\) => v == null \? "–" : fmt\.n\(v, d\) \+ "%",/);
    expect(app).toContain("brlBi: v =>");
    expect(app).toContain("brlBiDeMilhoes: v =>");
    // corpo de formatação inline fora do fmt: proibido
    expect((app.match(/const pct = \(v, d = \d\) => v == null/g) || []).length).toBe(0);
    expect((app.match(/const (n0|brl) = v => v == null/g) || []).length).toBe(0);
    expect((app.match(/const bi = v =>/g) || []).length).toBe(0);
    expect((app.match(/const bi = fmt\.brlBi(DeMilhoes)?;/g) || []).length).toBe(3);
  });
});

describe("T4 rescopado: cache dos estáticos do Observatório", () => {
  it("next.config dá uma hora aos golds e imutabilidade ao bundle e ao CSS versionados", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).toContain('source: "/obs/data/gold/:path*"');
    expect(cfg).toContain("public, max-age=3600, stale-while-revalidate=86400");
    expect(cfg).toContain("app.min.js|app-municipal.min.js|app-emergentes.min.js|styles.css");
    expect(cfg).toContain("public, max-age=31536000, immutable");
    // imutável só faz sentido com versão na URL
    expect(read("public/obs/index.html")).toMatch(/styles\.css\?v=\d+\.\d+\.\d+/);
    expect(read("public/obs/app.js")).toContain("/obs/app-${c}.min.js?v=${APP_VERSION}");
  });
});

describe("SGS: observação datada no futuro não entra no silver", () => {
  it("o coletor descarta datas depois de hoje e apaga as já gravadas", () => {
    const src = read("pipeline/sources/bcb_sgs.py");
    expect(src).toContain("if d > hoje:");
    expect(src).toContain("DELETE FROM series_obs WHERE key=? AND ref_date > ?");
  });
});
