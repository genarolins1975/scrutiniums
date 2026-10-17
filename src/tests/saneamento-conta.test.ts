import { describe, expect, it } from "vitest";
import { TARIFAS, tarifa, prestadorComTarifa } from "@/lib/saneamento/tarifas";
import { calcularConta, leituras } from "@/lib/saneamento/conta";

const conta = (id: string, cat: string, c: number) => calcularConta(tarifa(id)!.categorias[cat], c).total;

describe("Saneamento: simulador de conta com tabelas verificadas", () => {
  it("reproduz os exemplos conferidos à mão em cada tabela", () => {
    for (const t of TARIFAS) {
      for (const exemplos of [t.exemplos, t.exemplosOficiais ?? {}]) {
        for (const [cat, ex] of Object.entries(exemplos)) {
          for (const [c, esperado] of Object.entries(ex)) expect(conta(t.id, cat, Number(c))).toBe(esperado);
        }
      }
    }
  });

  it("toda tabela tem ato, vigência, fonte com sha256 e municípios associados", () => {
    for (const t of TARIFAS) {
      expect(t.ato.length).toBeGreaterThan(10);
      expect(t.vigencia.length).toBeGreaterThan(5);
      expect(t.fontes.length).toBeGreaterThan(0);
      for (const f of t.fontes) {
        expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
        expect(f.url).toMatch(/^https:\/\//);
      }
      expect(t.municipios.length).toBeGreaterThan(0);
    }
  });

  it("COMPESA: valor mínimo cobre até 10 m³ e a faixa seguinte começa no 11º", () => {
    expect(conta("compesa-2025", "residencial", 0)).toBe(123.54);
    expect(conta("compesa-2025", "residencial", 10)).toBe(123.54);
    expect(conta("compesa-2025", "residencial", 11)).toBe(137.72); // (61,77 + 7,09) × 2
    expect(conta("compesa-2025", "residencial", 20)).toBe(265.34);
    expect(conta("compesa-2025", "residencial", 21)).toBe(282.18); // + 8,42 × 2
  });

  it("COMPESA, Tarifa Social Pernambucana: faixa de 10 a 15 m³ a preço zero; esgoto não simulado", () => {
    const c = calcularConta(tarifa("compesa-2025")!.categorias.social_pernambucana, 15);
    expect(c.total).toBe(27.5);
    expect(c.esgoto).toBeNull();
    expect(c.esgotoNaoVerificado).toBeTruthy();
    expect(conta("compesa-2025", "social_pernambucana", 16)).toBe(34.59);
  });

  it("COPASA: sem consumo mínimo; tarifa fixa cobrada mesmo com zero", () => {
    expect(conta("copasa-2026", "residencial", 0)).toBe(44.84); // 25,77 + 19,07
    expect(conta("copasa-2026", "residencial", 5)).toBe(68.19); // + 5 × (2,69 + 1,98)
    expect(conta("copasa-2026", "residencial", 6)).toBe(77.47); // + 5,334 + 3,948
  });

  it("SABESP: mínimo de 10 m³ e fronteiras 20 e 50 m³; Social II tem 50% até 15 m³", () => {
    expect(conta("sabesp-2026-t1", "residencial", 10)).toBe(80.84);
    expect(conta("sabesp-2026-t1", "residencial", 20)).toBe(208.84);
    expect(conta("sabesp-2026-t1", "residencial", 21)).toBe(240.74); // + 15,95 × 2
    expect(conta("sabesp-2026-t1", "residencial", 50)).toBe(1165.84);
    expect(conta("sabesp-2026-t1", "residencial", 51)).toBe(1200.98); // + 17,57 × 2
    expect(conta("sabesp-2026-t1", "social_2", 15)).toBe(72.42);
    expect(conta("sabesp-2026-t1", "residencial", 15) / 2).toBe(72.42);
  });

  it("SABESP: TRCF de 0,5% é linha separada e soma ao total", () => {
    const t = tarifa("sabesp-2026-t1")!;
    const c = calcularConta(t.categorias.residencial, 10, t.adicionais);
    expect(c.adicionais).toBe(0.4);
    expect(c.total).toBe(81.24);
  });

  it("SANEPAR: esgoto como percentual da fatura de água (85% em Curitiba, 80% nas demais)", () => {
    expect(conta("sanepar-2026-curitiba", "residencial", 10)).toBe(117.64);
    expect(conta("sanepar-2026-demais", "residencial", 10)).toBe(114.46);
    expect(conta("sanepar-2026-curitiba", "residencial", 5)).toBe(101.92); // 55,09 × 1,85
  });

  it("CAESB: faixas de 7, 13, 20, 30 e 45 m³", () => {
    expect(conta("caesb-2026", "residencial", 7)).toBe(83.44); // (11,62 + 30,10) × 2
    expect(conta("caesb-2026", "residencial", 13)).toBe(145.24); // + 6 × 5,15 × 2
    expect(conta("caesb-2026", "social", 10)).toBe(57.2);
  });

  it("leituras: preço médio e custo do m³ seguinte", () => {
    const l = leituras(tarifa("sabesp-2026-t1")!, "residencial", 20);
    expect(l.m3Adicional).toBe(31.9); // 15,95 de água + 15,95 de esgoto
    expect(l.precoMedio).toBeCloseTo(10.442, 3);
    expect(leituras(tarifa("compesa-2025")!, "residencial", 0).precoMedio).toBeNull();
  });

  it("associa municípios: Recife à COMPESA, Belo Horizonte à COPASA, São Paulo à Tabela 1", () => {
    expect(prestadorComTarifa("2611606")).toBe("compesa-2025");
    expect(prestadorComTarifa("3106200")).toBe("copasa-2026");
    expect(prestadorComTarifa("3550308")).toBe("sabesp-2026-t1");
    expect(prestadorComTarifa("4119954")).toBeNull(); // Pontal do Paraná: ajuste sazonal, fora
    expect(prestadorComTarifa("3155801")).toBeNull(); // Rio Pomba: tabela própria
  });
});
