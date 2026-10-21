import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DESTINO_ABAS_CREDITO } from "@/lib/observatorios/registro";
import { OBSERVATORIOS, destinoObservatorio } from "@/lib/observatorios/lista";

const app = readFileSync(join(process.cwd(), "public/obs/app.js"), "utf-8");
const objeto = (nome: string): Record<string, string> => {
  const m = app.match(new RegExp(`const ${nome} = \\{([\\s\\S]*?)\\};`));
  if (!m) throw new Error(nome);
  return Object.fromEntries(Array.from(m[1].matchAll(/"?([\w-]+)"?: "([^"]+)"/g)).map((x) => [x[1], x[2]]));
};

describe("abas do Crédito que pertencem a outro observatório", () => {
  it("o cabeçalho da SPA marca exatamente as abas que o registro atribui a Famílias e a Contas Públicas", () => {
    const rotas = objeto("ROUTES");
    const marcadas = objeto("VIEW_OBSERVATORIO");
    for (const [view, caminho] of Object.entries(rotas)) {
      const destino = DESTINO_ABAS_CREDITO[caminho];
      if (!destino) continue;
      const esperado = destino[0] === "economia" ? undefined : destino[0];
      expect(marcadas[view], `${view} (${caminho})`).toBe(esperado);
    }
  });

  it("o destino de cada observatório marcado é o mesmo do registro", () => {
    for (const id of ["familias", "contas-publicas"] as const) {
      const o = OBSERVATORIOS.find((x) => x.id === id)!;
      expect(app).toContain(`["${o.nome}", "${destinoObservatorio(o)}"]`);
    }
  });
});
