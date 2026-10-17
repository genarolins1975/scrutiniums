import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Reajustes from "@/app/saneamento/preco-regulado/reajustes/page";
import atos from "@/lib/saneamento/dados/atos.json";
import { prestador } from "@/lib/saneamento/gold";
import { TARIFAS, periodoConsultaTarifas, prestadorComTarifa, tarifa } from "@/lib/saneamento/tarifas";
import { calcularConta, leituras } from "@/lib/saneamento/conta";

/**
 * CASAN (SC), tabela em vigor desde 01/04/2026. Os valores esperados vêm da planilha oficial da CASAN
 * (calculadora_casan_tfdi e calculadora_casan_tarifa_social, 2026), recalculada em LibreOffice em 17/10/2026
 * para volumes de 0 a 60 m³ com uma unidade autônoma e atendimento água mais esgoto.
 */
const ID = "casan-2026";
const conta = (cat: string, c: number) => calcularConta(tarifa(ID)!.categorias[cat], c);
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("CASAN: conta igual à da planilha oficial", () => {
  it("residencial: TFDI mais cada faixa sobre o volume dentro dela, com o esgoto igual ao faturamento de água", () => {
    const oficial: Record<number, number> = { 0: 92.68, 5: 123.48, 10: 154.28, 11: 182.9, 20: 440.48, 25: 583.58, 30: 774.98, 50: 1540.58, 51: 1588.74, 60: 2022.18 };
    for (const [c, total] of Object.entries(oficial)) expect(conta("residencial", Number(c)).total, `${c} m³`).toBe(total);
  });

  it("o esgoto repete a água inteira, TFDI incluída", () => {
    const c = conta("residencial", 10);
    expect(c.agua).toBe(77.14); // 46,34 + 10 × 3,08
    expect(c.esgoto).toBe(77.14);
    expect(conta("residencial", 0).esgoto).toBe(46.34);
  });

  it("fronteiras das faixas: o 11º m³ custa a segunda faixa, o 26º a terceira e o 51º a quarta", () => {
    const passo = (c: number) => Math.round((conta("residencial", c).total - conta("residencial", c - 1).total) * 100) / 100;
    expect(passo(10)).toBe(6.16); // 2 × 3,08
    expect(passo(11)).toBe(28.62); // 2 × 14,31
    expect(passo(25)).toBe(28.62);
    expect(passo(26)).toBe(38.28); // 2 × 19,14
    expect(passo(50)).toBe(38.28);
    expect(passo(51)).toBe(48.16); // 2 × 24,08
  });

  it("social da Lei 14.898/2024: faixa de 0 a 15 m³ e demais faixas da residencial", () => {
    const oficial: Record<number, number> = { 0: 46.34, 10: 77.14, 15: 92.54, 16: 121.16, 20: 235.64, 25: 378.74, 30: 570.14, 50: 1335.74, 51: 1383.9, 60: 1817.34 };
    for (const [c, total] of Object.entries(oficial)) expect(conta("social", Number(c)).total, `${c} m³`).toBe(total);
    expect(conta("social", 10).total * 2).toBeCloseTo(conta("residencial", 10).total, 9); // metade da TFDI e da primeira faixa
  });

  it("social anterior: cálculo manual a partir da tabela, sem teto de consumo", () => {
    expect(conta("social_anterior", 10).total).toBe(28.86); // 2 × (8,63 + 10 × 0,58)
    expect(conta("social_anterior", 20).total).toBe(111.06); // 2 × (8,63 + 5,80 + 10 × 4,11)
    expect(leituras(tarifa(ID)!, "social", 15).m3Adicional).toBe(28.62);
  });

  it("nenhuma categoria da CASAN tem teto de consumo e o método não é marcado como não verificado", () => {
    const t = tarifa(ID)!;
    for (const c of Object.values(t.categorias)) expect(c.consumoMaximo).toBeUndefined();
    expect(t.metodoNaoVerificado).toBeUndefined();
    expect(TARIFAS.filter((x) => x.metodoNaoVerificado).map((x) => x.id)).toEqual(["saneago-2026", "corsan-2026"]);
  });
});

describe("CASAN: registro da tabela", () => {
  const t = tarifa(ID)!;

  it("fontes com sha256: tabela, as duas planilhas oficiais e as duas resoluções da ARESC", () => {
    for (const f of t.fontes) {
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(f.url).toMatch(/^https:\/\//);
    }
    for (const trecho of ["Tabela%20Tarif", "calculadora_casan_tfdi", "calculadora_casan_tarifa_social", "RESOLUCAO-ARESC-No-389", "RESOLUCAO-ARESC-No-321"]) {
      expect(t.fontes.some((f) => f.url.includes(trecho)), trecho).toBe(true);
    }
    expect(t.acessado).toBe("2026-10-17");
  });

  it("as observações declaram a divergência de data e o que não foi lido", () => {
    const obs = t.observacoes.join(" ");
    expect(obs).toContain("13/01/2026");
    expect(obs).toContain("12/02/2026");
    expect(obs).toContain("não foram lidos");
    expect(obs).toContain("Barracão (PR)");
    expect(t.ato).toContain("12/02/2026");
  });

  it("os municípios são os de Santa Catarina do vínculo SINISA 2024, sem Barracão (PR)", () => {
    const p = prestador("casan-companhia-catarinense-de-aguas-e-saneamento")!;
    const sc = p.municipios_agua.filter((m) => m.startsWith("42"));
    expect([...t.municipios].sort()).toEqual([...sc].sort());
    expect(p.municipios_agua).toContain("4102604");
    expect(prestadorComTarifa("4102604")).toBeNull();
    expect(prestadorComTarifa("4205407")).toBe(ID); // Florianópolis
  });

  it("o período de consulta das tabelas segue de 14/10/2026 a 17/10/2026", () => {
    expect(periodoConsultaTarifas()).toBe("14/10/2026 a 17/10/2026");
  });
});

describe("CASAN: atos e página de reajustes", () => {
  const lista = (atos as { atos: { prestador: string; verificado: boolean; ato: string; vigencia: string }[] }).atos;

  it("o catálogo traz os reajustes da ARESC de 2025 e 2026, lidos no texto oficial", () => {
    const c = lista.filter((a) => a.prestador === "CASAN");
    expect(c.map((a) => a.ato)).toEqual(["Resolução ARESC 321, 21/01/2025", "Resolução ARESC 389, 12/02/2026"]);
    expect(c.every((a) => a.verificado)).toBe(true);
  });

  it("a página de reajustes mostra os dois atos e a data de levantamento da CASAN", () => {
    const h = texto(renderToStaticMarkup(createElement(Reajustes)));
    expect(h).toContain("CASAN em 17/10/2026");
    expect(h).toContain("Resolução ARESC 389, 12/02/2026");
    expect(h).toContain(`${lista.length} atos de 2023 a 2026 de ${new Set(lista.map((a) => a.prestador)).size} prestadores`);
  });
});
