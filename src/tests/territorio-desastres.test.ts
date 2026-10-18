import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GRUPOS, lerDesastres, serieReconhecida } from "@/lib/territorio/desastres";
import { donoDaRota } from "@/lib/observatorios/registro";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import { frentesTerritorio } from "@/lib/observatorios/entradas/territorio";

describe("desastres do Território e Clima", () => {
  const g = lerDesastres();

  it("reconhecimentos de 2003 em diante, com grupos que somam o total e nulos antes de 2003", () => {
    const serie = serieReconhecida(g);
    expect(serie[0].ano).toBe(2003);
    for (const a of serie) {
      expect(GRUPOS.reduce((s, gr) => s + a.por_grupo_reconhecidos[gr], 0), String(a.ano)).toBe(a.registros_reconhecidos);
      expect(a.municipios_distintos_com_reconhecimento).toBeLessThanOrEqual(a.registros_reconhecidos);
    }
    for (const a of g.serie_anual.filter((x) => x.ano < 2003)) expect(a.registros_reconhecidos, String(a.ano)).toBeNull();
  });

  it("os estados somam o total nacional do último ano completo e o ano corrente fora da base é indisponível, não zero", () => {
    const ult = g.por_uf.ultimo_ano_completo;
    const nacional = g.serie_anual.find((a) => a.ano === ult.ano)!;
    expect(Object.values(ult.ufs).reduce((s, u) => s + u.registros_reconhecidos, 0)).toBe(nacional.registros_reconhecidos);
    if (!g.por_uf.ano_corrente.disponivel) {
      expect(g.por_uf.ano_corrente.ufs).toBeNull();
      expect(g.por_uf.ano_corrente.motivo).toMatch(/não são zero/);
    }
  });

  it("danos humanos só de 2013 em diante e todo original com sha256", () => {
    for (const d of g.danos_humanos.serie) expect(d.publicavel, String(d.ano)).toBe(d.ano >= 2013);
    for (const [k, o] of Object.entries(g.originais)) expect(o.sha256, k).toMatch(/^[0-9a-f]{64}$/);
  });

  it("o painel é fechado, pertence à coleção Desastres e diz junto aos números o que a contagem conta", () => {
    expect(ehRotaPublica("/territorio/desastres")).toBe(false);
    expect(donoDaRota("/territorio/desastres")).toMatchObject({ observatorio: "territorio-e-clima", colecao: "desastres", origem: null });
    const fonte = readFileSync(join(process.cwd(), "src", "app", "territorio", "desastres", "page.tsx"), "utf-8");
    expect(fonte).toContain("A contagem é de registros municipais que obtiveram reconhecimento federal");
    expect(fonte).not.toMatch(/afetados<\/td>/);
  });

  it("a entrada liga o painel na frente das cidades e não anuncia mais desastres como lacuna", () => {
    const cidades = frentesTerritorio().find((f) => f.id === "cidades")!;
    expect(cidades.paineis.map((p) => p.href)).toContain("/territorio/desastres");
    expect(cidades.numeros.find((x) => x.href === "/territorio/desastres")?.valor).not.toBeNull();
    const frentes = readFileSync(join(process.cwd(), "src", "components", "observatorios", "FrentesTerritorio.tsx"), "utf-8");
    expect(frentes).not.toMatch(/desastres da Defesa Civil ainda não/);
  });
});
