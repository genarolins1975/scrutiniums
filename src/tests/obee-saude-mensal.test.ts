import { describe, expect, it } from "vitest";
import { goldSaude } from "@/lib/eficiencia/saude/dados";
import { compactarApsMensal, expandirApsMensal, mesesDoAno } from "@/lib/eficiencia/saude/mensal";

const dados = goldSaude()!.aps_mensal!;
describe("APS mensal: consulta e transporte sem perda", () => {
  it("preserva todas as medidas e estados com payload limitado", () => {
    const c = compactarApsMensal(dados);
    expect(expandirApsMensal(c).linhas).toEqual(dados.linhas);
    expect(JSON.stringify(c).length).toBeLessThan(300_000);
  });
  it("não inventa competências posteriores à captura", () => {
    const meses = mesesDoAno(dados, 3550308, "2026");
    expect(meses.map((r) => r.competencia)).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    expect(meses.at(-1)!.linha!.cobertura_pct).toBe(59.46);
  });
  it("mantém o mês sem registro entre dois meses observados", () => {
    const lacuna = { ...dados, linhas: dados.linhas.filter((r) => !(r.codigo_ibge === 3550308 && r.competencia === "2026-03")) };
    const meses = mesesDoAno(lacuna, 3550308, "2026");
    expect(meses).toHaveLength(7);
    expect(meses[2]).toEqual({ competencia: "2026-03", linha: null });
    expect(meses[3].linha).not.toBeNull();
  });
});
