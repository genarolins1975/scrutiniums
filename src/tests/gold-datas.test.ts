import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

// A função real da SPA recebe metadados sintéticos: nenhuma gold é alterada.
const app = readFileSync("public/obs/app.js", "utf-8");
const codigo = app.slice(app.indexOf("function metaDaPagina("), app.indexOf("/* Gold que falhou"));
function resolver(view: string, grupos: Record<string, unknown> | undefined) {
  const contexto = {
    state: { data: { meta: { gerado_em: "2026-09-24", grupos } } },
    currentView: () => view,
    VIEW_DATA: { consignado: ["consignado", "regulacao"], emprego: ["emprego"], pulse: ["regimes_series"] },
    OV_BLOCO_DATA: { npl: ["npl"] },
  };
  return runInNewContext(`${codigo}\nmetaDaPagina()`, contexto) as { gerado_em: string | null; vintages?: { caged: string } };
}
const grupos = {
  consignado: { arquivos: ["consignado.json"], gerado_em: "2026-09-24", meta: { vintages: { caged: "2026-07" } } },
  emprego: { arquivos: ["emprego.json"], gerado_em: "2026-10-18", meta: { vintages: { caged: "2026-08" } } },
  regulacao: { arquivos: ["regulacao.json"], gerado_em: "2026-10-18" },
  npl: { arquivos: ["npl.json"], gerado_em: "2026-09-24" },
};
describe("datas honestas da publicação seletiva", () => {
  it("consignado retido não recebe a data da regulação recém-publicada", () => {
    expect(resolver("consignado", grupos).gerado_em).toBe("2026-09-24");
    expect(resolver("consignado", grupos).vintages?.caged).toBe("2026-07");
  });
  it("emprego publicado usa a geração e o vintage do próprio grupo", () => {
    expect(resolver("emprego", grupos).gerado_em).toBe("2026-10-18");
    expect(resolver("emprego", grupos).vintages?.caged).toBe("2026-08");
  });
  it("a visão geral e leitores legados conservam o carimbo mais antigo", () => {
    expect(resolver("overview", grupos).gerado_em).toBe("2026-09-24");
    expect(resolver("consignado", undefined).gerado_em).toBe("2026-09-24");
  });
  it("inclui arquivos do núcleo usados por Pulso, Alertas e Perguntas rápidas", () => {
    expect(resolver("pulse", {
      pulse: { arquivos: ["pulse.json"], gerado_em: "2026-09-24" },
      regimes: { arquivos: ["regimes_series.json"], gerado_em: "2026-10-18" },
    }).gerado_em).toBe("2026-09-24");
    expect(resolver("alerts", {
      central: { arquivos: ["alertas_central.json"], gerado_em: "2026-09-24" },
      alerts: { arquivos: ["alerts.json"], gerado_em: "2026-10-18" },
    }).gerado_em).toBe("2026-09-24");
    expect(resolver("research", {
      pulse: { arquivos: ["pulse.json"], gerado_em: "2026-09-24" },
      overview: { arquivos: ["overview.json"], gerado_em: "2026-10-18" },
    }).gerado_em).toBe("2026-09-24");

  });
  it("data ausente segue ausente", () => {
    expect(resolver("emprego", { emprego: { arquivos: ["emprego.json"], gerado_em: null } }).gerado_em).toBeNull();
  });
});
