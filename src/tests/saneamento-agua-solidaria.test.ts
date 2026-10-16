import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PrecoRegulado from "@/app/saneamento/preco-regulado/page";
import TarifaSocialPage from "@/app/saneamento/tarifa-social/page";
import { TARIFAS, tarifa } from "@/lib/saneamento/tarifas";
import { calcularConta } from "@/lib/saneamento/conta";
import { reais } from "@/lib/saneamento/formato";

/**
 * Água Solidária, programa estadual da SANEPAR mantido ao lado da tarifa social federal (revisão de 16/10/2026, achado 1.8).
 * Tabela do Anexo Único da Resolução AGEPAR 23/2026; esgoto a 50% da água pelo art. 3º, parágrafo único.
 * A elegibilidade não é verificada, e a divergência entre as fontes da Sanepar fica registrada nas observações.
 */
const IDS = ["sanepar-2026-curitiba", "sanepar-2026-demais"];
const cat = (id: string) => tarifa(id)!.categorias.agua_solidaria;
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("Água Solidária: tabela e cálculo", () => {
  it("água: R$ 14,74 até 5 m³, R$ 0,45 de 6 a 10 e R$ 1,70 acima de 10 (Anexo Único)", () => {
    for (const id of IDS) {
      const agua = (c: number) => calcularConta(cat(id), c).agua;
      expect(agua(5)).toBe(14.74);
      expect(agua(6)).toBe(15.19);
      expect(agua(10)).toBe(16.99);
      expect(agua(11)).toBe(18.69);
      expect(agua(20)).toBe(33.99);
    }
  });

  it("esgoto a 50% da água em Curitiba e nas demais localidades, não a 85% ou 80%", () => {
    for (const id of IDS) {
      expect(cat(id).esgoto).toEqual({ percentual: 50 });
      expect(calcularConta(cat(id), 10).total).toBe(25.49);
      expect(calcularConta(cat(id), 20).total).toBe(50.99);
    }
    expect(calcularConta(cat(IDS[0]), 10).total).toBe(calcularConta(cat(IDS[1]), 10).total);
  });

  it("em 10 m³ em Curitiba, fica abaixo da tarifa social federal e da residencial", () => {
    const t = tarifa(IDS[0])!;
    const solidaria = calcularConta(t.categorias.agua_solidaria, 10).total;
    const social = calcularConta(t.categorias.social, 10).total;
    const residencial = calcularConta(t.categorias.residencial, 10).total;
    expect(solidaria).toBeLessThan(social);
    expect(social).toBeLessThan(residencial);
  });

  it("só a SANEPAR tem a categoria", () => {
    for (const t of TARIFAS) expect("agua_solidaria" in t.categorias, t.id).toBe(IDS.includes(t.id));
  });
});

describe("Água Solidária: fontes e ressalvas registradas", () => {
  it("fontes do regulador e da Sanepar com sha256, e data de acesso própria", () => {
    for (const id of IDS) {
      const t = tarifa(id)!;
      const urls = t.fontes.map((f) => f.url);
      expect(urls.some((u) => u.includes("legislacao.pr.gov.br") && u.includes("12127"))).toBe(true);
      expect(urls.some((u) => u === "https://www.sanepar.com.br/tarifas")).toBe(true);
      expect(urls.filter((u) => u.includes("sanepar.com.br")).length).toBeGreaterThanOrEqual(4);
      for (const f of t.fontes) expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(t.acessado).toBe("2026-10-16");
    }
  });

  it("as observações declaram a divergência de critérios e que o enquadramento não é verificado", () => {
    for (const id of IDS) {
      const obs = tarifa(id)!.observacoes.join(" ");
      expect(obs).toContain("as fontes da Sanepar divergem");
      expect(obs).toContain("não verifica o enquadramento");
      expect(obs).toContain("não recebe a tarifa social federal");
    }
  });
});

describe("Água Solidária nas páginas", () => {
  it("o capítulo 6 mostra a conta nas três categorias, derivada da tabela, e a ressalva de elegibilidade", () => {
    const t = tarifa(IDS[0])!;
    const h = texto(renderToStaticMarkup(createElement(TarifaSocialPage)));
    expect(h).toContain("Água Solidária, o programa estadual da SANEPAR");
    for (const c of ["agua_solidaria", "social", "residencial"]) expect(h).toContain(reais(calcularConta(t.categorias[c], 10).total));
    expect(h).toContain("não foi lido e o enquadramento não foi verificado");
    expect(h).toContain("Água Solidária (programa estadual)");
  });

  it("o preço regulado registra o programa na linha da AGEPAR", () => {
    const h = texto(renderToStaticMarkup(createElement(PrecoRegulado)));
    expect(h).toContain("programa estadual Água Solidária mantido");
  });
});
